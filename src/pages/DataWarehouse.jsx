import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/api/supabaseClient';
import { db } from '@/api/db';
import { formatCurrency, formatPSF } from '@/lib/costUtils';
import { Search, Database, ChevronDown, Building2, MapPin, Shuffle, X, Loader2, CheckCircle2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

// ─── CSI Division mapping ────────────────────────────────────────────────────
const DIVISIONS = [
  { id: '01', label: 'Division 1 - General Conditions', keywords: ['general condition', 'supervision', 'temporary', 'mobilization', 'permit', 'insurance', 'bond', 'contingency', 'preconstruction', 'closeout', 'overhead', 'profit', 'project management', 'safety', 'cleaning', 'dumpster', 'porta'] },
  { id: '02', label: 'Division 2 - Site Work',          keywords: ['site work', 'earthwork', 'grading', 'excavat', 'paving', 'asphalt', 'landscap', 'irrigation', 'storm drain', 'storm water', 'sewer', 'domestic water', 'fire line', 'underground', 'demolit', 'clearing', 'grub', 'retaining wall', 'curb', 'sidewalk', 'parking lot', 'site util'] },
  { id: '03', label: 'Division 3 - Concrete',           keywords: ['concrete', 'foundation', 'slab', 'footing', 'post-tension', 'rebar', 'formwork', 'cast-in-place', 'precast', 'tilt-up'] },
  { id: '04', label: 'Division 4 - Masonry',            keywords: ['masonry', 'brick', 'block', 'stone', 'cmu'] },
  { id: '05', label: 'Division 5 - Metals',             keywords: ['structural steel', 'misc metal', 'metal deck', 'steel stair', 'ornamental', 'cold-formed'] },
  { id: '06', label: 'Division 6 - Wood & Plastics',    keywords: ['carpentry', 'rough carpentry', 'finish carpentry', 'millwork', 'framing', 'sheathing', 'cabinets', 'casework', 'lumber', 'wood'] },
  { id: '07', label: 'Division 7 - Thermal & Moisture', keywords: ['insulation', 'roofing', 'waterproof', 'weather barrier', 'stucco', 'eifs', 'envelope', 'flashin', 'sealant', 'caulk', 'exterior skin', 'air barrier', 'vapor'] },
  { id: '08', label: 'Division 8 - Doors & Windows',    keywords: ['door', 'window', 'glazing', 'storefront', 'curtain wall', 'hardware', 'hollow metal', 'overhead door', 'gate', 'entry system'] },
  { id: '09', label: 'Division 9 - Finishes',           keywords: ['drywall', 'flooring', 'tile', 'carpet', 'paint', 'finish', 'ceiling', 'plaster', 'gypsum', 'vinyl', 'hardwood', 'epoxy', 'acoustic', 'lvt', 'lvp'] },
  { id: '10', label: 'Division 10 - Specialties',       keywords: ['specialt', 'signage', 'sign', 'mailbox', 'locker', 'toilet partition', 'fire extinguisher', 'canopy', 'awning', 'postal', 'bath accessor'] },
  { id: '11', label: 'Division 11 - Equipment',         keywords: ['appliance', 'fitness', 'laundry', 'trash chute', 'compactor', 'commercial kitchen'] },
  { id: '12', label: 'Division 12 - Furnishings',       keywords: ['furnish', 'blind', 'shade', 'furniture', 'window treatment'] },
  { id: '14', label: 'Division 14 - Conveying',         keywords: ['elevator', 'escalator', 'conveying', 'lift'] },
  { id: '15', label: 'Division 15 - Mechanical',        keywords: ['mechanical', 'hvac', 'plumbing', 'fire protection', 'sprinkler', 'piping', 'ductwork', 'boiler', 'chiller', 'cooling', 'heating', 'ventilat', 'fire suppression'] },
  { id: '16', label: 'Division 16 - Electrical',        keywords: ['electrical', 'electric', 'wiring', 'lighting', 'panel', 'transformer', 'generator', 'low voltage', 'data', 'telecom', 'security system', 'fire alarm', 'av system', 'solar'] },
];

function getDivision(categoryName) {
  if (!categoryName) return 'Other';
  const lower = categoryName.toLowerCase();
  for (const div of DIVISIONS) {
    if (div.keywords.some(k => lower.includes(k))) return div.label;
  }
  return 'Other';
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function DataWarehouse() {
  const [searchParams]                             = useSearchParams();
  const [selectedDivision, setSelectedDivision]   = useState('All');
  const [selectedProject, setSelectedProject]     = useState('All');
  const [selectedGC, setSelectedGC]               = useState('All');
  const [search, setSearch]                        = useState('');
  const [sortBy, setSortBy]                        = useState('category_name');
  const [sortDir, setSortDir]                      = useState('asc');

  // Budget builder state
  const [pickedIds, setPickedIds]                  = useState(new Set());
  const [builderOpen, setBuilderOpen]              = useState(false);
  const [newProjectName, setNewProjectName]        = useState('');
  const [saving, setSaving]                        = useState(false);
  const [saved, setSaved]                          = useState(false);
  const queryClient                                = useQueryClient();

  // Sync division filter from URL param (?div=02)
  useEffect(() => {
    const divId = searchParams.get('div');
    if (divId) {
      const match = DIVISIONS.find(d => d.id === divId);
      setSelectedDivision(match ? match.label : 'All');
    } else {
      setSelectedDivision('All');
    }
  }, [searchParams]);

  // Fetch all project_costs joined with their project
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['warehouse-costs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_costs')
        .select('*, projects(*)')
        .order('category_name', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Row lookup by id (for builder)
  const rowById = useMemo(() => {
    const map = {};
    rows.forEach(r => { map[r.id] = r; });
    return map;
  }, [rows]);

  // Unique projects
  const projects = useMemo(() => {
    const seen = new Set();
    return rows
      .map(r => r.projects)
      .filter(p => p && !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || ''));
  }, [rows]);

  // Resolve the effective GC for a row: bid_gc wins, falls back to project-level GC
  const rowGC = (r) => r.bid_gc || r.projects?.general_contractor || null;

  // Unique GCs (scoped to selected project) — built from per-row GC
  const gcs = useMemo(() => {
    const names = new Set(
      rows
        .filter(r => selectedProject === 'All' || r.project_id === selectedProject)
        .map(rowGC)
        .filter(Boolean)
    );
    return [...names].sort();
  }, [rows, selectedProject]);

  // Active divisions with data
  const activeDivisions = useMemo(() => {
    const set = new Set(rows.map(r => getDivision(r.category_name)));
    return DIVISIONS.filter(d => set.has(d.label));
  }, [rows]);

  // Filter + sort
  const filtered = useMemo(() => {
    let result = rows.filter(r => {
      if (selectedDivision !== 'All' && getDivision(r.category_name) !== selectedDivision) return false;
      if (selectedProject !== 'All' && r.project_id !== selectedProject) return false;
      if (selectedGC !== 'All' && rowGC(r) !== selectedGC) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.category_name?.toLowerCase().includes(s) &&
          !r.notes?.toLowerCase().includes(s) &&
          !rowGC(r)?.toLowerCase().includes(s) &&
          !r.projects?.project_name?.toLowerCase().includes(s)
        ) return false;
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      let va, vb;
      if (sortBy === 'category_name')      { va = a.category_name || ''; vb = b.category_name || ''; }
      else if (sortBy === 'total_cost')    { va = a.total_cost || 0; vb = b.total_cost || 0; }
      else if (sortBy === 'cost_per_sf')   { va = a.projects?.gross_sf ? a.total_cost / a.projects.gross_sf : -1; vb = b.projects?.gross_sf ? b.total_cost / b.projects.gross_sf : -1; }
      else if (sortBy === 'cost_per_unit') { va = a.projects?.unit_count ? a.total_cost / a.projects.unit_count : -1; vb = b.projects?.unit_count ? b.total_cost / b.projects.unit_count : -1; }
      else if (sortBy === 'project')       { va = a.projects?.project_name || ''; vb = b.projects?.project_name || ''; }
      else if (sortBy === 'division')      { va = getDivision(a.category_name); vb = getDivision(b.category_name); }
      const cmp = typeof va === 'string' ? va.localeCompare(vb) : va - vb;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [rows, selectedDivision, selectedProject, selectedGC, search, sortBy, sortDir]);

  const totalCost  = filtered.reduce((s, r) => s + (r.total_cost || 0), 0);
  const projectCnt = new Set(filtered.map(r => r.project_id)).size;

  // Builder helpers
  const pickedRows   = useMemo(() => [...pickedIds].map(id => rowById[id]).filter(Boolean), [pickedIds, rowById]);
  const pickedTotal  = pickedRows.reduce((s, r) => s + (r.total_cost || 0), 0);

  const toggleRow = useCallback((id) => {
    setPickedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  // Select-all for currently visible rows
  const visibleIds      = filtered.map(r => r.id);
  const allVisiblePicked = visibleIds.length > 0 && visibleIds.every(id => pickedIds.has(id));
  const someVisiblePicked = visibleIds.some(id => pickedIds.has(id));

  function toggleAllVisible() {
    setPickedIds(prev => {
      const next = new Set(prev);
      if (allVisiblePicked) {
        visibleIds.forEach(id => next.delete(id));
      } else {
        visibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  async function saveAsProject() {
    if (!newProjectName.trim()) return;
    setSaving(true);
    try {
      const proj = await db.Project.create({
        project_name: newProjectName.trim(),
        total_hard_cost: pickedTotal,
      });
      // Ensure categories exist and create cost lines
      const existingCats = await db.CostCategory.list('category_name', 500);
      const catMap = {};
      existingCats.forEach(c => { catMap[c.category_name] = c.id; });

      for (const item of pickedRows) {
        if (!catMap[item.category_name]) {
          const nc = await db.CostCategory.create({ category_name: item.category_name });
          catMap[item.category_name] = nc.id;
        }
        await db.ProjectCost.create({
          project_id: proj.id,
          category_id: catMap[item.category_name],
          category_name: item.category_name,
          total_cost: item.total_cost,
          notes: item.notes,
        });
      }
      queryClient.invalidateQueries();
      setSaved(true);
      setTimeout(() => {
        setBuilderOpen(false);
        setPickedIds(new Set());
        setNewProjectName('');
        setSaved(false);
      }, 1500);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(col); setSortDir('asc'); }
  }

  const SortIcon = ({ col }) => {
    if (sortBy !== col) return <span className="ml-1 text-muted-foreground/40">↕</span>;
    return <span className="ml-1 text-primary">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-2xl mx-auto pb-28">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6 text-primary" />
            Data Warehouse
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse unit cost data across all imported GC bids — filter by division or project
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <select
            value={selectedDivision}
            onChange={e => setSelectedDivision(e.target.value)}
            className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-[220px]"
          >
            <option value="All">All Divisions</option>
            {activeDivisions.map(d => (
              <option key={d.id} value={d.label}>{d.label}</option>
            ))}
            {rows.some(r => getDivision(r.category_name) === 'Other') && (
              <option value="Other">Other</option>
            )}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedProject}
            onChange={e => { setSelectedProject(e.target.value); setSelectedGC('All'); }}
            className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-[200px]"
          >
            <option value="All">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.project_name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={selectedGC}
            onChange={e => setSelectedGC(e.target.value)}
            className="appearance-none h-9 pl-3 pr-8 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer min-w-[180px]"
          >
            <option value="All">All GCs</option>
            {gcs.map(gc => (
              <option key={gc} value={gc}>{gc}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search categories, descriptions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Line Items', value: filtered.length.toLocaleString() },
          { label: 'Total Cost', value: formatCurrency(totalCost) },
          { label: 'Projects',   value: projectCnt.toString() },
        ].map(stat => (
          <div key={stat.label} className="rounded-xl border border-border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{stat.label}</p>
            <p className="text-lg font-bold tracking-tight mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin mr-2" />
            Loading warehouse data...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-2">
            <Database className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-medium">No data found</p>
            <p className="text-xs text-muted-foreground">
              {rows.length === 0 ? 'Import a PDF bid to populate the warehouse.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  {/* Select-all checkbox */}
                  <th className="px-3 py-2.5 w-8">
                    <input
                      type="checkbox"
                      checked={allVisiblePicked}
                      ref={el => { if (el) el.indeterminate = someVisiblePicked && !allVisiblePicked; }}
                      onChange={toggleAllVisible}
                      className="rounded cursor-pointer"
                    />
                  </th>
                  <th onClick={() => toggleSort('division')} className="px-4 py-2.5 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    Division <SortIcon col="division" />
                  </th>
                  <th onClick={() => toggleSort('category_name')} className="px-4 py-2.5 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    Category <SortIcon col="category_name" />
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Description</th>
                  <th onClick={() => toggleSort('total_cost')} className="px-4 py-2.5 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    Amount <SortIcon col="total_cost" />
                  </th>
                  <th onClick={() => toggleSort('cost_per_unit')} className="px-4 py-2.5 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    $/Unit <SortIcon col="cost_per_unit" />
                  </th>
                  <th onClick={() => toggleSort('cost_per_sf')} className="px-4 py-2.5 text-right font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    $/SF <SortIcon col="cost_per_sf" />
                  </th>
                  <th onClick={() => toggleSort('project')} className="px-4 py-2.5 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground whitespace-nowrap">
                    Project <SortIcon col="project" />
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">GC</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Location</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const project  = row.projects;
                  const perUnit  = project?.unit_count ? row.total_cost / project.unit_count : null;
                  const perSF    = project?.gross_sf   ? row.total_cost / project.gross_sf   : null;
                  const division = getDivision(row.category_name);
                  const divShort = division.match(/Division (\d+)/)?.[0] ?? division;
                  const location = [project?.city, project?.state].filter(Boolean).join(', ');
                  const isPicked = pickedIds.has(row.id);

                  return (
                    <tr
                      key={row.id}
                      onClick={() => toggleRow(row.id)}
                      className={`border-b border-border transition-colors cursor-pointer
                        ${isPicked
                          ? 'bg-primary/8 hover:bg-primary/12'
                          : idx % 2 === 0 ? 'hover:bg-muted/30' : 'bg-muted/10 hover:bg-muted/30'
                        }`}
                    >
                      <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isPicked}
                          onChange={() => toggleRow(row.id)}
                          className="rounded cursor-pointer"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center rounded-md bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium whitespace-nowrap">
                          {divShort}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-medium max-w-[180px]">
                        <span className="line-clamp-2">{row.category_name}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs max-w-[220px]">
                        <span className="line-clamp-2">{row.notes || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(row.total_cost)}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                        {perUnit != null ? formatCurrency(perUnit) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-muted-foreground">
                        {perSF != null ? formatPSF(perSF) : '—'}
                      </td>
                      <td className="px-4 py-2.5 max-w-[160px]">
                        <span className="line-clamp-1 text-xs font-medium">{project?.project_name || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        {rowGC(row) ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Building2 className="h-3 w-3 shrink-0" />
                            <span className="line-clamp-1">{rowGC(row)}</span>
                          </span>
                        ) : <span className="text-muted-foreground/50 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {location ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {location}
                          </span>
                        ) : <span className="text-muted-foreground/50 text-xs">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Floating Budget Builder Bar ── */}
      {pickedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-3 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 border border-primary/80">
          <Shuffle className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-bold">{pickedIds.size}</span> line item{pickedIds.size !== 1 ? 's' : ''} selected
            <span className="mx-2 opacity-60">·</span>
            <span className="font-bold">{formatCurrency(pickedTotal)}</span> total
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setBuilderOpen(true)}
            className="ml-2 bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
          >
            Build Budget →
          </Button>
          <button
            onClick={() => setPickedIds(new Set())}
            className="ml-1 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Budget Builder Dialog ── */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shuffle className="h-5 w-5 text-primary" />
              Budget Builder — {pickedIds.size} line items
            </DialogTitle>
          </DialogHeader>

          {saved ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <CheckCircle2 className="h-14 w-14 text-green-500" />
              <p className="text-lg font-semibold">Project saved!</p>
              <p className="text-sm text-muted-foreground">"{newProjectName}" is now in your Projects.</p>
            </div>
          ) : (
            <>
              {/* Project name input */}
              <div className="mt-2">
                <label className="text-sm font-medium mb-1.5 block">Project name</label>
                <input
                  type="text"
                  placeholder="e.g. Mission Grove — Frankenstein Budget"
                  value={newProjectName}
                  onChange={e => setNewProjectName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  autoFocus
                />
              </div>

              {/* Selected items list */}
              <div className="flex-1 overflow-y-auto mt-3 rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                    <tr className="border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Category</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Source</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Amount</th>
                      <th className="px-3 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pickedRows.map(row => (
                      <tr key={row.id} className="border-b border-border hover:bg-muted/20">
                        <td className="px-3 py-2 font-medium max-w-[140px]">
                          <span className="line-clamp-1">{row.category_name}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px]">
                          <span className="line-clamp-1">{row.notes || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[120px]">
                          <span className="line-clamp-1">{row.projects?.project_name || '—'}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatCurrency(row.total_cost)}</td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => toggleRow(row.id)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/30">
                      <td colSpan={3} className="px-3 py-2 font-semibold text-sm">Total</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-sm">{formatCurrency(pickedTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Save button */}
              <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-border">
                <Button variant="outline" onClick={() => setBuilderOpen(false)}>Cancel</Button>
                <Button onClick={saveAsProject} disabled={saving || !newProjectName.trim()}>
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : 'Save as Project'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
