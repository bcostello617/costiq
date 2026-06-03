import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Upload, Loader2, CheckCircle2, AlertTriangle, Pencil, Trash2 } from 'lucide-react';
import { formatCurrency } from '@/lib/costUtils';

async function parsePDFWithClaude(base64PDF, categories) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const categoryList = categories.map(c => c.category_name).join(', ');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
          },
          {
            type: 'text',
            text: `You are analyzing a GC construction bid or hard cost budget document.

Extract every cost line item and map each one to the CLOSEST matching category from this master list:
${categoryList}

Rules:
- Match as specifically as possible — prefer granular categories over broad ones
- If a line item covers multiple categories (e.g. "Mechanical" covers both Plumbing and HVAC), split it proportionally or use the best single match
- If nothing matches, use the closest name or create a short descriptive name
- Include ALL cost line items, even small ones
- Also extract project details if visible

Return ONLY valid JSON, no markdown, no explanation:
{
  "project_name": "project name or null",
  "unit_count": 180,
  "gross_sf": 298377,
  "city": "city or null",
  "state": "state abbreviation or null",
  "product_type": "Garden/Wrap/Podium/Mid-Rise/High-Rise/Townhome or null",
  "construction_type": "Wood Frame/Steel Frame/Concrete/Hybrid or null",
  "general_contractor": "GC name or null",
  "line_items": [
    {
      "original_description": "exact description from the document",
      "category_name": "matched category from master list",
      "amount": 7429921
    }
  ]
}`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API error: ${response.status} — ${err}`);
  }

  const data = await response.json();
  const text = data.content[0].text;
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found in response');
  return JSON.parse(text.slice(firstBrace, lastBrace + 1));
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PDFImport() {
  const [step, setStep] = useState('upload'); // upload | preview | done
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(null);
  const [editableItems, setEditableItems] = useState([]);
  const [selectedProject, setSelectedProject] = useState('new');
  const [newProjectName, setNewProjectName] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: () => db.CostCategory.list('sort_order', 200),
  });

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return;
    }
    setError(null);
    setParsing(true);
    try {
      const base64 = await fileToBase64(file);
      const result = await parsePDFWithClaude(base64, categories);
      setParsed(result);
      setEditableItems(result.line_items.map((item, i) => ({ ...item, id: i, enabled: true })));
      if (result.project_name) setNewProjectName(result.project_name);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Failed to parse PDF. Try again.');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, [categories]);

  const updateItem = (id, field, value) => {
    setEditableItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const removeItem = (id) => {
    setEditableItems(items => items.filter(item => item.id !== id));
  };

  const handleImport = async () => {
    setImporting(true);
    setError(null);
    try {
      // Get or create project — include all metadata Claude extracted
      let projectId;
      if (selectedProject === 'new') {
        const total = editableItems.filter(i => i.enabled).reduce((s, i) => s + (Number(i.amount) || 0), 0);
        const proj = await db.Project.create({
          project_name: newProjectName || 'Imported Project',
          city: parsed?.city || null,
          state: parsed?.state || null,
          unit_count: parsed?.unit_count || null,
          gross_sf: parsed?.gross_sf || null,
          product_type: parsed?.product_type || null,
          construction_type: parsed?.construction_type || null,
          general_contractor: parsed?.general_contractor || null,
          total_hard_cost: total,
        });
        projectId = proj.id;
      } else {
        projectId = selectedProject;
      }

      // Ensure categories exist
      const existingCats = await db.CostCategory.list('category_name', 500);
      const catMap = {};
      existingCats.forEach(c => { catMap[c.category_name] = c.id; });

      const activeItems = editableItems.filter(i => i.enabled);
      for (const item of activeItems) {
        if (!catMap[item.category_name]) {
          const newCat = await db.CostCategory.create({ category_name: item.category_name });
          catMap[item.category_name] = newCat.id;
        }
        await db.ProjectCost.create({
          project_id: projectId,
          category_id: catMap[item.category_name],
          category_name: item.category_name,
          total_cost: Number(item.amount) || 0,
          notes: item.notes || item.original_description,
          bid_gc: parsed?.general_contractor || null,
        });
      }

      await db.ImportLog.create({
        file_name: 'PDF Import',
        status: 'completed',
        projects_imported: 1,
        costs_imported: activeItems.length,
        import_summary: `PDF import: ${activeItems.length} line items into project`,
      });

      queryClient.invalidateQueries();
      setStep('done');
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const total = editableItems.filter(i => i.enabled).reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  if (step === 'done') {
    return (
      <div className="p-6 max-w-2xl mx-auto flex flex-col items-center text-center gap-4 mt-16">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
        <h2 className="text-2xl font-bold">Import Complete</h2>
        <p className="text-muted-foreground">{editableItems.filter(i => i.enabled).length} cost line items imported successfully.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => { setStep('upload'); setParsed(null); setEditableItems([]); }}>Import Another</Button>
          <Button onClick={() => window.location.href = '/projects'}>View Projects</Button>
        </div>
      </div>
    );
  }

  if (step === 'preview') {
    return (
      <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Review Extracted Data</h1>
            <p className="text-sm text-muted-foreground mt-1">{editableItems.length} line items found · {formatCurrency(total, true)} total</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
            <Button onClick={handleImport} disabled={importing}>
              {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</> : 'Import to Database'}
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Project selection */}
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-semibold mb-3">Assign to project</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedProject('new')}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selectedProject === 'new' ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
            >
              + New Project
            </button>
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProject(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selectedProject === p.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:bg-muted'}`}
              >
                {p.project_name}
              </button>
            ))}
          </div>
          {selectedProject === 'new' && (
            <input
              className="mt-3 w-full max-w-sm rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="Project name"
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
            />
          )}
        </div>

        {/* Line items */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground w-8"></th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Original Description</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {editableItems.map(item => (
                  <tr key={item.id} className={`border-b border-border ${!item.enabled ? 'opacity-40' : ''}`}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={item.enabled} onChange={e => updateItem(item.id, 'enabled', e.target.checked)} className="rounded" />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs max-w-xs truncate">{item.original_description}</td>
                    <td className="px-4 py-2">
                      <select
                        value={item.category_name}
                        onChange={e => updateItem(item.id, 'category_name', e.target.value)}
                        className="text-sm rounded border border-input bg-transparent px-2 py-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      >
                        {categories.map(c => <option key={c.id} value={c.category_name}>{c.category_name}</option>)}
                        <option value={item.category_name}>{item.category_name}</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right font-mono">
                      <input
                        type="number"
                        value={item.amount || ''}
                        onChange={e => updateItem(item.id, 'amount', e.target.value)}
                        className="w-32 text-right rounded border border-input bg-transparent px-2 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      />
                    </td>
                    <td className="px-4 py-2">
                      <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30">
                  <td colSpan={3} className="px-4 py-2 text-sm font-semibold">Total</td>
                  <td className="px-4 py-2 text-right font-mono font-bold">{formatCurrency(total, true)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import from PDF</h1>
        <p className="text-sm text-muted-foreground mt-1">Drop a GC bid or cost breakdown PDF — Claude will extract and map every line item automatically.</p>
      </div>

      <div
        className={`rounded-xl border-2 border-dashed p-16 text-center transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'} ${parsing ? 'opacity-60 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {parsing ? (
          <div className="space-y-4">
            <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
            <p className="text-sm font-medium">Claude is reading the PDF...</p>
            <p className="text-xs text-muted-foreground">Extracting line items and mapping to categories</p>
          </div>
        ) : (
          <>
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">Drag & drop a GC bid PDF here</p>
            <p className="text-xs text-muted-foreground mb-6">Works with bid tabulatations, cost breakdowns, trade scopes, and AIA documents</p>
            <label>
              <input type="file" accept="application/pdf" className="hidden" onChange={e => handleFile(e.target.files[0])} />
              <Button asChild><span><Upload className="h-4 w-4 mr-2" />Browse for PDF</span></Button>
            </label>
          </>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
