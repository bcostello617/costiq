import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';

// Map common spreadsheet column names to our schema field names
const FIELD_ALIASES = {
  project_name: ['project name', 'name', 'project'],
  project_number: ['project number', 'project #', 'number', '#'],
  city: ['city'],
  state: ['state', 'st'],
  market: ['market', 'market area'],
  address: ['address', 'street'],
  product_type: ['product type', 'type', 'product'],
  construction_type: ['construction type', 'construction', 'struct type'],
  podium_type: ['podium type', 'podium'],
  unit_count: ['unit count', 'units', '# units', 'number of units'],
  building_count: ['building count', 'buildings', '# buildings'],
  site_acres: ['site acres', 'acres', 'site size'],
  gross_sf: ['gross sf', 'gross sqft', 'gross square feet', 'gba', 'gross area'],
  net_rentable_sf: ['net rentable sf', 'net sf', 'nra', 'rentable sf', 'rentable area'],
  start_date: ['start date', 'start', 'construction start'],
  completion_date: ['completion date', 'completion', 'end date', 'finish date'],
  developer: ['developer', 'owner'],
  general_contractor: ['general contractor', 'gc', 'contractor'],
  architect: ['architect', 'arch'],
  status: ['status'],
  total_hard_cost: ['total hard cost', 'hard cost', 'total cost', 'construction cost', 'contract value'],
  notes: ['notes', 'comments', 'remarks'],
};

function normalizeHeader(h) {
  return String(h).toLowerCase().trim().replace(/\s+/g, ' ');
}

function buildHeaderMap(headers) {
  const map = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (aliases.includes(norm)) { map[header] = field; break; }
    }
  }
  return map;
}

function parseSpreadsheet(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { raw: false, defval: '' });
        if (!rows.length) { resolve([]); return; }

        const headers = Object.keys(rows[0]);
        const headerMap = buildHeaderMap(headers);

        const projects = rows.map(row => {
          const proj = {};
          for (const [col, field] of Object.entries(headerMap)) {
            const val = row[col];
            if (val !== '' && val !== null && val !== undefined) {
              // Numeric fields
              if (['unit_count','building_count','gross_sf','net_rentable_sf','total_hard_cost','site_acres'].includes(field)) {
                const num = parseFloat(String(val).replace(/[$,]/g, ''));
                if (!isNaN(num)) proj[field] = num;
              } else {
                proj[field] = String(val).trim();
              }
            }
          }
          return proj;
        }).filter(p => p.project_name);

        resolve(projects);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

export default function Import() {
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const queryClient = useQueryClient();

  const { data: logs = [] } = useQuery({
    queryKey: ['import-logs'],
    queryFn: () => db.ImportLog.list('-created_date', 50),
  });

  const processFile = async (file) => {
    setError(null);
    setResult(null);
    setProcessing(true);
    try {
      const projectsData = await parseSpreadsheet(file);

      if (!projectsData.length) {
        setError('No projects found. Make sure your spreadsheet has a "Project Name" column and at least one data row.');
        setProcessing(false);
        return;
      }

      let projectsCreated = 0, costsCreated = 0, categoriesCreated = 0;
      const existingCats = await db.CostCategory.list('category_name', 500);
      const catNames = new Set(existingCats.map(c => c.category_name));

      for (const pData of projectsData) {
        const costBreakdown = pData.cost_breakdown || [];
        delete pData.cost_breakdown;

        const created = await db.Project.create(pData);
        projectsCreated++;

        for (const cost of costBreakdown) {
          if (!cost.category_name || !cost.total_cost) continue;
          if (!catNames.has(cost.category_name)) {
            await db.CostCategory.create({ category_name: cost.category_name });
            catNames.add(cost.category_name);
            categoriesCreated++;
          }
          const allCats = await db.CostCategory.filter({ category_name: cost.category_name });
          await db.ProjectCost.create({
            project_id: created.id,
            category_id: allCats[0]?.id || '',
            category_name: cost.category_name,
            total_cost: cost.total_cost,
          });
          costsCreated++;
        }
      }

      await db.ImportLog.create({
        file_name: file.name,
        status: 'completed',
        projects_imported: projectsCreated,
        costs_imported: costsCreated,
        categories_imported: categoriesCreated,
        import_summary: `Imported ${projectsCreated} projects, ${costsCreated} cost lines, ${categoriesCreated} new categories`,
      });

      setResult({ projects: projectsCreated, costs: costsCreated, categories: categoriesCreated });
      queryClient.invalidateQueries();
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload Excel or CSV files to import project data. Columns are matched by name — see the field list below.
        </p>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-12 text-center transition-all ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'
        } ${processing ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {processing ? (
          <div className="space-y-3">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">Importing data...</p>
          </div>
        ) : (
          <>
            <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">Drag & drop your file here</p>
            <p className="text-xs text-muted-foreground mb-4">Supports Excel (.xlsx, .xls) and CSV files</p>
            <label>
              <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileSelect} />
              <Button asChild><span><Upload className="h-4 w-4 mr-2" />Browse Files</span></Button>
            </label>
          </>
        )}
      </div>

      {result && (
        <div className="rounded-xl border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-900/20 p-5">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-800 dark:text-green-400">Import Complete</p>
              <p className="text-sm mt-1">
                {result.projects} projects, {result.costs} cost lines, {result.categories} new categories imported successfully.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800 dark:text-red-400">Import Error</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card p-5 text-sm">
        <p className="font-semibold mb-2">Recognized column names</p>
        <p className="text-muted-foreground text-xs">Column headers are matched case-insensitively. Use any of these names in your spreadsheet:</p>
        <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {Object.entries(FIELD_ALIASES).map(([field, aliases]) => (
            <div key={field}><span className="font-mono text-primary">{field}</span>: {aliases.join(', ')}</div>
          ))}
        </div>
      </div>

      {logs.length > 0 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="text-sm font-semibold">Import History</h3>
          </div>
          <div className="divide-y divide-border">
            {logs.map(log => (
              <div key={log.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium">{log.file_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{log.import_summary}</p>
                </div>
                <Badge variant="outline" className={
                  log.status === 'completed' ? 'border-green-300 text-green-700' :
                  log.status === 'failed' ? 'border-red-300 text-red-700' : ''
                }>{log.status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
