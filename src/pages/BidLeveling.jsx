import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, FileSpreadsheet, Loader2, AlertTriangle,
  ChevronRight, GitCompareArrows, Trash2, Building2
} from 'lucide-react';
import { formatCurrency } from '@/lib/costUtils';
import * as XLSX from 'xlsx';

// ─── Parser ───────────────────────────────────────────────────────────────────
// Finds every "Code / Category" header row in a sheet and parses the section
// below it into { sectionLabel, bidders, lineItems }.

function findCodeCol(row) {
  // Find which column index contains exactly 'Code' (case-insensitive)
  for (let c = 0; c < row.length; c++) {
    if (row[c] && String(row[c]).trim().toLowerCase() === 'code') return c;
  }
  return -1;
}

function parseSections(ws) {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
  const sections = [];

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;

    // Find 'Code' anywhere in the row, then check 'Category' is right after it
    const codeCol = findCodeCol(row);
    if (codeCol === -1) continue;
    const catCol = codeCol + 1;
    if (!row[catCol] || String(row[catCol]).trim().toLowerCase() !== 'category') continue;

    // Map column index → bidder name (skip delta / % / duplicate columns)
    const bidderCols = {};
    const seenNames = new Set();
    for (let c = catCol + 1; c < row.length; c++) {
      const v = row[c];
      if (v && typeof v === 'string') {
        const t = v.trim();
        const tl = t.toLowerCase();
        if (!t.includes('∆') && !t.includes('Δ') && !t.includes('%') &&
            !tl.includes('delta') && !tl.includes(' vs') &&
            !tl.includes('schedule') && !tl.startsWith('#') &&
            !seenNames.has(t)) {
          bidderCols[c] = t;
          seenNames.add(t);
        }
      }
    }

    const bidders = Object.values(bidderCols);
    if (!bidders.length) continue;

    const lineItems = [];
    let sortOrder = 0;

    for (let i = r + 1; i < rows.length; i++) {
      const dr = rows[i];
      if (!dr || dr.every(v => v === null || v === undefined)) continue;

      // Stop if we hit another Code/Category header
      if (findCodeCol(dr) !== -1 && dr[findCodeCol(dr) + 1] &&
          String(dr[findCodeCol(dr) + 1]).trim().toLowerCase() === 'category') break;

      const code     = dr[codeCol] != null ? String(dr[codeCol]).trim() : null;
      const category = dr[catCol]  != null ? String(dr[catCol]).trim()  : null;
      if (!category) continue;

      const amounts = {};
      for (const [ci, name] of Object.entries(bidderCols)) {
        const val = dr[parseInt(ci)];
        if (typeof val === 'number' && isFinite(val)) amounts[name] = val;
      }

      if (!Object.keys(amounts).length) continue;

      const upper = category.toUpperCase();
      let row_type = 'line_item';
      if (upper.startsWith('TOTAL') || upper.includes('TOTAL BUDGET')) row_type = 'total';
      else if (upper.includes('SUB-TOTAL') || upper.includes('SUBTOTAL')) row_type = 'subtotal';

      lineItems.push({ code, category, amounts, row_type, sort_order: sortOrder++ });
    }

    if (lineItems.length) {
      sections.push({ bidders, lineItems, startRow: r });
    }
  }

  return sections;
}

function parseWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const results = [];
        for (const sheetName of wb.SheetNames) {
          const sections = parseSections(wb.Sheets[sheetName]);
          sections.forEach((sec, si) => {
            results.push({
              label: sections.length > 1
                ? `${sheetName} — Section ${si + 1} (${sec.bidders.join(', ')})`
                : `${sheetName} (${sec.bidders.join(', ')})`,
              ...sec,
            });
          });
        }
        resolve(results);
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function BidLeveling() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [view, setView]           = useState('list'); // list | upload | preview
  const [dragOver, setDragOver]   = useState(false);
  const [parsing, setParsing]     = useState(false);
  const [parseError, setParseError] = useState(null);
  const [sections, setSections]   = useState([]);
  const [sectionIdx, setSectionIdx] = useState(0);
  const [fileName, setFileName]   = useState('');
  const [projectName, setProjectName] = useState('');
  const [linkedProjectId, setLinkedProjectId] = useState('');
  const [unitCount, setUnitCount] = useState('');
  const [saving, setSaving]       = useState(false);
  const [saveError, setSaveError] = useState(null);

  const { data: bids = [], isLoading } = useQuery({
    queryKey: ['bid-leveling'],
    queryFn: () => db.BidLeveling.list('-created_date', 200),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('project_name', 500),
  });

  const handleFile = async (file) => {
    if (!file) return;
    setParseError(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const parsed = await parseWorkbook(file);
      if (!parsed.length) throw new Error('No recognizable bid data found. Make sure your file has a "Code / Category" header row.');
      setSections(parsed);
      setSectionIdx(0);
      // Pre-fill project name from file name
      setProjectName(file.name.replace(/\.(xlsx?|csv)$/i, '').replace(/_v[\d.]+$/, '').trim());
      setView('preview');
    } catch (err) {
      setParseError(err.message);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  const handleSave = async () => {
    if (!projectName.trim()) return;
    const sec = sections[sectionIdx];
    setSaving(true);
    setSaveError(null);
    try {
      const bid = await db.BidLeveling.create({
        project_name:  projectName.trim(),
        project_id:    linkedProjectId || null,
        file_name:     fileName,
        bid_date:      new Date().toISOString().slice(0, 10),
        unit_count:    unitCount ? parseFloat(unitCount) : null,
        bidders:       sec.bidders,
      });

      // Insert line items in batches
      const rows = sec.lineItems.map(item => ({
        bid_id:     bid.id,
        sort_order: item.sort_order,
        code:       item.code,
        category:   item.category,
        amounts:    item.amounts,
        row_type:   item.row_type,
      }));

      const BATCH = 200;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabase.from('bid_line_items').insert(rows.slice(i, i + BATCH));
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['bid-leveling'] });
      navigate(`/bid-leveling/${bid.id}`);
    } catch (err) {
      setSaveError(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this bid comparison?')) return;
    await db.BidLeveling.delete(id);
    queryClient.invalidateQueries({ queryKey: ['bid-leveling'] });
  };

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-screen-lg mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Bid Leveling</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Upload your Best&amp;Final spreads to track and compare GC bids across projects.
            </p>
          </div>
          <Button onClick={() => setView('upload')}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Spread
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : bids.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border bg-card p-16 text-center">
            <GitCompareArrows className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium mb-1">No bid comparisons yet</p>
            <p className="text-xs text-muted-foreground mb-6">
              Upload your Best&amp;Final Excel spread to get started
            </p>
            <Button onClick={() => setView('upload')}>
              <Upload className="h-4 w-4 mr-2" />Upload Spread
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Project</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Bidders</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Units</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">File</th>
                  <th className="px-4 py-3 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {bids.map(bid => (
                  <tr
                    key={bid.id}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/bid-leveling/${bid.id}`)}
                  >
                    <td className="px-4 py-3 font-medium">{bid.project_name}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {(bid.bidders || []).map(b => (
                          <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bid.unit_count ? bid.unit_count.toLocaleString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bid.bid_date ? new Date(bid.bid_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[180px]">
                      {bid.file_name || '—'}
                    </td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      <button
                        onClick={(e) => handleDelete(bid.id, e)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  // ── UPLOAD VIEW ────────────────────────────────────────────────────────────
  if (view === 'upload') {
    return (
      <div className="p-4 lg:p-6 space-y-6 max-w-screen-lg mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setView('list')}>← Back</Button>
          <h1 className="text-2xl font-bold tracking-tight">Upload Bid Spread</h1>
        </div>

        <div
          className={`rounded-xl border-2 border-dashed p-16 text-center transition-all ${
            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-card'
          } ${parsing ? 'opacity-60 pointer-events-none' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {parsing ? (
            <div className="space-y-3">
              <Loader2 className="h-12 w-12 mx-auto text-primary animate-spin" />
              <p className="text-sm font-medium">Parsing your spread...</p>
            </div>
          ) : (
            <>
              <FileSpreadsheet className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm font-medium mb-1">Drag & drop your Best&Final Excel file here</p>
              <p className="text-xs text-muted-foreground mb-6">
                Works with your standard template — any sheet with a Code / Category header row
              </p>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={e => handleFile(e.target.files[0])}
                />
                <Button asChild>
                  <span><Upload className="h-4 w-4 mr-2" />Browse Files</span>
                </Button>
              </label>
            </>
          )}
        </div>

        {parseError && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/20 p-4 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">{parseError}</p>
          </div>
        )}
      </div>
    );
  }

  // ── PREVIEW VIEW ───────────────────────────────────────────────────────────
  const sec = sections[sectionIdx];

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setView('upload')}>← Back</Button>
          <h1 className="text-2xl font-bold tracking-tight">Review & Save</h1>
        </div>
        <Button onClick={handleSave} disabled={saving || !projectName.trim()}>
          {saving
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            : 'Save to CostIQ'}
        </Button>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />{saveError}
        </div>
      )}

      {/* Config row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="md:col-span-2">
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Project Name *</label>
          <input
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="e.g. La Sierra"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Units (optional)</label>
          <input
            type="number"
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={unitCount}
            onChange={e => setUnitCount(e.target.value)}
            placeholder="232"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">Link to Project</label>
          <select
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            value={linkedProjectId}
            onChange={e => setLinkedProjectId(e.target.value)}
          >
            <option value="">— None —</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Section selector */}
      {sections.length > 1 && (
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">
            {sections.length} sections found — choose which to import:
          </label>
          <div className="flex flex-wrap gap-2">
            {sections.map((s, i) => (
              <button
                key={i}
                onClick={() => setSectionIdx(i)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  sectionIdx === i
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border hover:bg-muted'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
          <p className="text-sm font-semibold">
            {sec.lineItems.length} line items · Bidders: {sec.bidders.join(', ')}
          </p>
          <p className="text-xs text-muted-foreground">{fileName}</p>
        </div>
        <div className="overflow-x-auto max-h-[55vh]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                {sec.bidders.map(b => (
                  <th key={b} className="px-3 py-2 text-right font-medium text-muted-foreground">{b}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sec.lineItems.map((item, idx) => {
                const isTotal = item.row_type === 'total';
                const isSubtotal = item.row_type === 'subtotal';
                return (
                  <tr
                    key={idx}
                    className={`border-b border-border/60 ${
                      isTotal ? 'bg-muted/50 font-bold' :
                      isSubtotal ? 'bg-muted/30 font-semibold' : ''
                    }`}
                  >
                    <td className="px-3 py-2 text-muted-foreground text-xs font-mono">{item.code || ''}</td>
                    <td className="px-3 py-2">{item.category}</td>
                    {sec.bidders.map(b => (
                      <td key={b} className="px-3 py-2 text-right font-mono text-xs">
                        {item.amounts[b] != null ? formatCurrency(item.amounts[b], true) : '—'}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
