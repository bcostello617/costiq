import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { db } from '@/api/db';
import { formatCurrency, formatPSF } from '@/lib/costUtils';
import { Button } from '@/components/ui/button';
import {
  Calculator, Save, Loader2, CheckCircle2, Plus, Trash2,
  ChevronDown, ChevronRight, ClipboardList, BarChart2,
  Link2, Check, X
} from 'lucide-react';

// ─── Keyword sets for category matching per section ───────────────────────────
const SECTION_KEYWORDS = {
  direct_building: [
    'rough carpentry', 'framing', 'wood frame', 'direct building',
    'structural', 'lumber', 'sheathing', 'metal stud', 'light gauge',
    'building cost', 'building frame', 'concrete', 'foundation', 'slab',
    'masonry', 'steel', 'building shell',
  ],
  sitework: [
    'sitework', 'site work', 'earthwork', 'grading', 'excavat', 'paving',
    'asphalt', 'landscap', 'underground', 'storm drain', 'sewer',
    'domestic water', 'fire line', 'retaining wall', 'curb', 'sidewalk',
    'parking lot', 'site util', 'clearing',
  ],
  amenity: [
    'amenity', 'clubhouse', 'leasing', 'community', 'gym', 'fitness',
    'pool', 'recreation', 'common area',
  ],
};

// ─── BidSourcePicker ─────────────────────────────────────────────────────────
function BidSourcePicker({ section, nrsf, onApply }) {
  const [open, setOpen]             = useState(false);
  const [projectId, setProjectId]   = useState('');
  const [gcFilter, setGcFilter]     = useState('');
  const [checkedIds, setCheckedIds] = useState(new Set());

  // All projects + their costs (joined)
  const { data: rows = [] } = useQuery({
    queryKey: ['warehouse-costs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_costs')
        .select('*, projects(*)')
        .order('category_name');
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });

  // Unique projects
  const projects = useMemo(() => {
    const seen = new Set();
    return rows.map(r => r.projects).filter(p => p && !seen.has(p.id) && seen.add(p.id))
      .sort((a, b) => (a.project_name || '').localeCompare(b.project_name || ''));
  }, [rows]);

  // GCs for selected project
  const gcs = useMemo(() => {
    if (!projectId) return [];
    const names = new Set(rows.filter(r => r.project_id === projectId).map(r => r.projects?.general_contractor).filter(Boolean));
    return [...names].sort();
  }, [rows, projectId]);

  // Costs for selected project (+gc filter)
  const projectCosts = useMemo(() => {
    if (!projectId) return [];
    return rows.filter(r =>
      r.project_id === projectId &&
      (!gcFilter || r.projects?.general_contractor === gcFilter)
    );
  }, [rows, projectId, gcFilter]);

  // Auto-check relevant categories when project loads
  useEffect(() => {
    const keywords = SECTION_KEYWORDS[section] || [];
    const auto = new Set(
      projectCosts
        .filter(r => keywords.some(k => (r.category_name || '').toLowerCase().includes(k)))
        .map(r => r.id)
    );
    setCheckedIds(auto);
  }, [projectCosts, section]);

  const selectedCosts = projectCosts.filter(r => checkedIds.has(r.id));
  const selectedTotal = selectedCosts.reduce((s, r) => s + (r.total_cost || 0), 0);
  const project       = projects.find(p => p.id === projectId);
  const baseNRSF      = project?.net_rentable_sf || project?.gross_sf || 0;
  const costPerNRSF   = baseNRSF > 0 ? selectedTotal / baseNRSF : null;

  function apply() {
    if (!costPerNRSF) return;
    onApply({
      costPerNRSF,
      notes: `${project?.project_name}${project?.general_contractor ? ' — ' + project.general_contractor : ''}`,
    });
    setOpen(false);
  }

  function reset() {
    setProjectId(''); setGcFilter(''); setCheckedIds(new Set()); setOpen(false);
  }

  const SELECT = 'appearance-none h-8 pl-3 pr-8 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer';

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <Link2 className="h-3.5 w-3.5" />
        Pull from bid
      </button>
    );
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <Link2 className="h-3.5 w-3.5" /> Pull from existing bid
        </span>
        <button onClick={reset} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Project + GC selectors */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <select value={projectId} onChange={e => { setProjectId(e.target.value); setGcFilter(''); }}
            className={`${SELECT} min-w-[200px]`}>
            <option value="">Select project...</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
          </select>
          <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
        </div>
        {gcs.length > 0 && (
          <div className="relative">
            <select value={gcFilter} onChange={e => setGcFilter(e.target.value)}
              className={`${SELECT} min-w-[180px]`}>
              <option value="">All GCs</option>
              {gcs.map(gc => <option key={gc} value={gc}>{gc}</option>)}
            </select>
            <ChevronDown className="absolute right-2 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>

      {/* Category checklist */}
      {projectCosts.length > 0 && (
        <div className="rounded-md border border-border bg-card max-h-48 overflow-y-auto">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/30">
            <span className="text-xs text-muted-foreground">
              Select categories to include
            </span>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setCheckedIds(new Set(projectCosts.map(r => r.id)))}
                className="text-primary hover:underline">All</button>
              <button onClick={() => setCheckedIds(new Set())}
                className="text-muted-foreground hover:underline">None</button>
            </div>
          </div>
          {projectCosts.map(cost => (
            <label key={cost.id}
              className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted/20 cursor-pointer border-b border-border/50 last:border-0">
              <input
                type="checkbox"
                checked={checkedIds.has(cost.id)}
                onChange={() => setCheckedIds(prev => {
                  const next = new Set(prev);
                  next.has(cost.id) ? next.delete(cost.id) : next.add(cost.id);
                  return next;
                })}
                className="rounded shrink-0"
              />
              <span className="text-xs flex-1 min-w-0 truncate">{cost.category_name}</span>
              <span className="text-xs font-mono text-muted-foreground shrink-0">{formatCurrency(cost.total_cost)}</span>
            </label>
          ))}
        </div>
      )}

      {/* Preview + Apply */}
      {selectedTotal > 0 && (
        <div className="flex items-center justify-between bg-card rounded-md px-3 py-2 border border-border">
          <div className="text-xs space-y-0.5">
            <div><span className="text-muted-foreground">Selected total: </span><span className="font-mono font-semibold">{formatCurrency(selectedTotal)}</span></div>
            {costPerNRSF != null ? (
              <div><span className="text-muted-foreground">÷ {Number(baseNRSF).toLocaleString()} SF = </span>
                <span className="font-mono font-bold text-primary">${costPerNRSF.toFixed(2)}/SF</span></div>
            ) : (
              <div className="text-muted-foreground text-xs">
                {nrsf ? `÷ ${Number(nrsf).toLocaleString()} NRSF (from your inputs)` : 'No NRSF on source project — enter manually'}
              </div>
            )}
          </div>
          <Button size="sm" onClick={apply} disabled={!costPerNRSF}>
            <Check className="h-3.5 w-3.5 mr-1.5" /> Apply
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Default blank estimate ──────────────────────────────────────────────────
const BLANK = {
  // 1. Project Info
  total_units: '',
  total_nrsf: '',
  net_site_acres: '',
  construction_start: '',
  distribution_date: new Date().toISOString().split('T')[0],
  // 2. Direct Building
  direct_cost_per_nrsf: '',
  direct_adjustment_pct: 0,
  direct_notes: 'RDO U/W Assumption',
  // 3. Amenity Building
  amenity_sf: '',
  amenity_cost_per_sf: '',
  amenity_adjustment_pct: 0,
  amenity_notes: '',
  // 4. Sitework
  sitework_per_acre: '',
  sitework_adjustment_pct: 0,
  sitework_notes: '',
  // 5. Other Costs
  offsites_cost: '',
  offsites_notes: 'Undergrounding powerlines',
  vims_per_unit: '',
  // 6. Solar
  solar_rate_per_w: 2.7,
  solar_plans: [
    { plan_type: 'P1', units: '', kwdc_per_unit: 4.0 },
  ],
  // 7. General Conditions
  gc_monthly_rate: '',
  gc_duration_months: '',
  gc_adjustment_pct: 0,
  gc_notes: '',
};

// ─── Calculation engine ───────────────────────────────────────────────────────
function calcSummary(d) {
  const units   = Number(d.total_units)   || 0;
  const nrsf    = Number(d.total_nrsf)    || 0;
  const acres   = Number(d.net_site_acres)|| 0;

  // Direct Building
  const directBase      = Number(d.direct_cost_per_nrsf) || 0;
  const directAdj       = directBase * (Number(d.direct_adjustment_pct) / 100);
  const directAdjCostPSF= directBase + directAdj;
  const directTotal     = directAdjCostPSF * nrsf;

  // Amenity Building
  const amenBase        = Number(d.amenity_cost_per_sf) || 0;
  const amenAdj         = amenBase * (Number(d.amenity_adjustment_pct) / 100);
  const amenSF          = Number(d.amenity_sf) || 0;
  const amenTotal       = (amenBase + amenAdj) * amenSF;

  // Sitework
  const swBase          = Number(d.sitework_per_acre) || 0;
  const swAdj           = swBase * (Number(d.sitework_adjustment_pct) / 100);
  const swTotal         = (swBase + swAdj) * acres;

  // Offsites & VIMS
  const offsitesTotal   = Number(d.offsites_cost) || 0;
  const vimsPerUnit     = Number(d.vims_per_unit) || 0;
  const vimsTotal       = vimsPerUnit * units;
  const otherTotal      = offsitesTotal + vimsTotal;

  // Solar
  const solarRate       = Number(d.solar_rate_per_w) || 0;
  const solarTotal      = (d.solar_plans || []).reduce((sum, p) => {
    const u    = Number(p.units) || 0;
    const kwdc = Number(p.kwdc_per_unit) || 0;
    return sum + (u * kwdc * 1000 * solarRate);
  }, 0);

  // General Conditions
  const gcRate          = Number(d.gc_monthly_rate) || 0;
  const gcMonths        = Number(d.gc_duration_months) || 0;
  const gcAdj           = gcRate * (Number(d.gc_adjustment_pct) / 100);
  const gcTotal         = (gcRate + gcAdj) * gcMonths;

  const grandTotal = directTotal + amenTotal + swTotal + otherTotal + solarTotal + gcTotal;

  const perUnit = (v) => units > 0 ? v / units : null;
  const perNRSF = (v) => nrsf  > 0 ? v / nrsf  : null;

  return {
    directTotal, amenTotal, swTotal, offsitesTotal,
    vimsTotal, otherTotal, solarTotal, gcTotal, grandTotal,
    directAdjCostPSF,
    lines: [
      { label: 'Direct Building',        cost: directTotal,   notes: d.direct_notes   },
      { label: 'Amenity Building',        cost: amenTotal,     notes: d.amenity_notes  },
      { label: 'Sitework',               cost: swTotal,       notes: d.sitework_notes },
      { label: 'Offsites',               cost: offsitesTotal, notes: d.offsites_notes },
      { label: 'VIMS System',            cost: vimsTotal,     notes: vimsPerUnit > 0 ? `$${vimsPerUnit.toLocaleString()}/unit` : '' },
      { label: 'Solar (gross)',           cost: solarTotal,    notes: `$${solarRate}/W` },
      { label: 'General Conditions',     cost: gcTotal,       notes: d.gc_notes       },
    ],
    perUnit, perNRSF,
    units, nrsf,
  };
}

// ─── Shared input style ───────────────────────────────────────────────────────
const INPUT  = 'w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring';
const LABEL  = 'text-xs font-medium text-muted-foreground mb-1 block';
const FIELD  = 'space-y-1';

function Field({ label, children }) {
  return (
    <div className={FIELD}>
      <label className={LABEL}>{label}</label>
      {children}
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-3.5 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {Icon && <Icon className="h-4 w-4 text-primary shrink-0" />}
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto">{open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}</span>
      </button>
      {open && <div className="p-5">{children}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Estimator() {
  const { id } = useParams();               // present when editing a saved estimate
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [tab, setTab]               = useState('inputs');
  const [projectName, setProjectName] = useState('');
  const [scenarioName, setScenarioName] = useState('Scenario A');
  const [status, setStatus]         = useState('not_started');
  const [inputs, setInputs]         = useState(BLANK);
  const [saving, setSaving]         = useState(false);
  const [savedOk, setSavedOk]       = useState(false);

  // Load existing estimate when editing
  const { data: existing } = useQuery({
    queryKey: ['estimate', id],
    queryFn: () => db.Estimate.get(id),
    enabled: !!id,
  });

  useEffect(() => {
    if (existing) {
      setProjectName(existing.project_name || '');
      setScenarioName(existing.scenario_name || 'Scenario A');
      setStatus(existing.status || 'not_started');
      setInputs({ ...BLANK, ...(existing.data || {}) });
    }
  }, [existing]);

  // ── helpers ──
  function set(field, value) {
    setInputs(prev => ({ ...prev, [field]: value }));
  }

  function setSolarPlan(idx, field, value) {
    setInputs(prev => {
      const plans = [...(prev.solar_plans || [])];
      plans[idx] = { ...plans[idx], [field]: value };
      return { ...prev, solar_plans: plans };
    });
  }

  function addSolarPlan() {
    setInputs(prev => ({
      ...prev,
      solar_plans: [...(prev.solar_plans || []), { plan_type: '', units: '', kwdc_per_unit: '' }],
    }));
  }

  function removeSolarPlan(idx) {
    setInputs(prev => ({
      ...prev,
      solar_plans: prev.solar_plans.filter((_, i) => i !== idx),
    }));
  }

  const summary = useMemo(() => calcSummary(inputs), [inputs]);

  async function handleSave() {
    if (!projectName.trim()) { alert('Please enter a project name.'); return; }
    setSaving(true);
    try {
      const payload = {
        project_name: projectName.trim(),
        scenario_name: scenarioName,
        status,
        data: inputs,
        updated_at: new Date().toISOString(),
      };
      if (id) {
        await db.Estimate.update(id, payload);
      } else {
        const created = await db.Estimate.create(payload);
        navigate(`/estimator/${created.id}`, { replace: true });
      }
      queryClient.invalidateQueries(['estimates']);
      setSavedOk(true);
      setTimeout(() => setSavedOk(false), 2500);
    } catch (err) {
      alert('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ── Render ──
  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50 shrink-0 gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Calculator className="h-5 w-5 text-primary shrink-0" />
          <input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Project name..."
            className="text-lg font-bold bg-transparent border-none outline-none focus:ring-0 placeholder:text-muted-foreground/50 min-w-0 flex-1"
          />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Scenario */}
          <input
            value={scenarioName}
            onChange={e => setScenarioName(e.target.value)}
            placeholder="Scenario A"
            className="h-8 px-3 rounded-md border border-input bg-transparent text-sm focus:outline-none focus:ring-1 focus:ring-ring w-32"
          />
          {/* Status */}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="h-8 px-3 rounded-md border border-input bg-card text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
          {/* Save */}
          <Button onClick={handleSave} disabled={saving} size="sm">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            ) : savedOk ? (
              <><CheckCircle2 className="h-4 w-4 mr-2 text-green-400" />Saved</>
            ) : (
              <><Save className="h-4 w-4 mr-2" />Save</>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-6 shrink-0 bg-card/30">
        {[
          { key: 'inputs',  label: 'Inputs',  icon: ClipboardList },
          { key: 'summary', label: 'Summary', icon: BarChart2 },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'inputs' ? (
          <div className="p-6 space-y-4 max-w-4xl mx-auto">

            {/* 1. Project Information */}
            <Section title="1 — Project Information" icon={Calculator}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Total Units">
                  <input type="number" className={INPUT} value={inputs.total_units} onChange={e => set('total_units', e.target.value)} placeholder="114" />
                </Field>
                <Field label="Total NRSF (SF)">
                  <input type="number" className={INPUT} value={inputs.total_nrsf} onChange={e => set('total_nrsf', e.target.value)} placeholder="158,239" />
                </Field>
                <Field label="Net Site Area (acres)">
                  <input type="number" className={INPUT} value={inputs.net_site_acres} onChange={e => set('net_site_acres', e.target.value)} placeholder="4.65" step="0.01" />
                </Field>
                <Field label="Construction Start Date">
                  <input type="text" className={INPUT} value={inputs.construction_start} onChange={e => set('construction_start', e.target.value)} placeholder="TBD" />
                </Field>
                <Field label="Distribution Date">
                  <input type="date" className={INPUT} value={inputs.distribution_date} onChange={e => set('distribution_date', e.target.value)} />
                </Field>
              </div>
            </Section>

            {/* 2. Direct Building */}
            <Section title="2 — Direct Building">
              <div className="mb-4">
                <BidSourcePicker
                  section="direct_building"
                  nrsf={inputs.total_nrsf}
                  onApply={({ costPerNRSF, notes }) => {
                    set('direct_cost_per_nrsf', costPerNRSF.toFixed(2));
                    set('direct_notes', notes);
                  }}
                />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <Field label="Cost / NRSF ($/SF)">
                  <input type="number" className={INPUT} value={inputs.direct_cost_per_nrsf} onChange={e => set('direct_cost_per_nrsf', e.target.value)} placeholder="157.30" step="0.01" />
                </Field>
                <Field label="Adjustment (%)">
                  <input type="number" className={INPUT} value={inputs.direct_adjustment_pct} onChange={e => set('direct_adjustment_pct', e.target.value)} placeholder="0" step="0.1" />
                </Field>
                <Field label="Notes">
                  <input type="text" className={INPUT} value={inputs.direct_notes} onChange={e => set('direct_notes', e.target.value)} />
                </Field>
              </div>
              {(Number(inputs.direct_cost_per_nrsf) > 0) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm grid grid-cols-3 gap-4">
                  <div><span className="text-muted-foreground">Adjusted $/SF </span><span className="font-mono font-semibold">${summary.directAdjCostPSF.toFixed(2)}</span></div>
                  <div><span className="text-muted-foreground">Total </span><span className="font-mono font-semibold">{formatCurrency(summary.directTotal)}</span></div>
                </div>
              )}
            </Section>

            {/* 3. Amenity Building */}
            <Section title="3 — Amenity Building">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <Field label="Amenity SF">
                  <input type="number" className={INPUT} value={inputs.amenity_sf} onChange={e => set('amenity_sf', e.target.value)} placeholder="2,500" />
                </Field>
                <Field label="Cost / SF ($/SF)">
                  <input type="number" className={INPUT} value={inputs.amenity_cost_per_sf} onChange={e => set('amenity_cost_per_sf', e.target.value)} placeholder="372.00" step="0.01" />
                </Field>
                <Field label="Adjustment (%)">
                  <input type="number" className={INPUT} value={inputs.amenity_adjustment_pct} onChange={e => set('amenity_adjustment_pct', e.target.value)} placeholder="0" step="0.1" />
                </Field>
                <Field label="Notes">
                  <input type="text" className={INPUT} value={inputs.amenity_notes} onChange={e => set('amenity_notes', e.target.value)} />
                </Field>
              </div>
              {(Number(inputs.amenity_cost_per_sf) > 0) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Total </span><span className="font-mono font-semibold">{formatCurrency(summary.amenTotal)}</span>
                </div>
              )}
            </Section>

            {/* 4. Sitework */}
            <Section title="4 — Sitework">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <Field label="Sitework Bid ($/acre)">
                  <input type="number" className={INPUT} value={inputs.sitework_per_acre} onChange={e => set('sitework_per_acre', e.target.value)} placeholder="1,281,324" />
                </Field>
                <Field label="Adjustment (%)">
                  <input type="number" className={INPUT} value={inputs.sitework_adjustment_pct} onChange={e => set('sitework_adjustment_pct', e.target.value)} placeholder="0" step="0.1" />
                </Field>
                <Field label="Apply to (acres)">
                  <input type="number" className={INPUT} value={inputs.net_site_acres} disabled className={`${INPUT} opacity-50`} />
                </Field>
                <Field label="Notes">
                  <input type="text" className={INPUT} value={inputs.sitework_notes} onChange={e => set('sitework_notes', e.target.value)} />
                </Field>
              </div>
              {(Number(inputs.sitework_per_acre) > 0) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Total </span><span className="font-mono font-semibold">{formatCurrency(summary.swTotal)}</span>
                </div>
              )}
            </Section>

            {/* 5. Other Costs */}
            <Section title="5 — Other Costs">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <Field label="Offsites Cost ($)">
                  <input type="number" className={INPUT} value={inputs.offsites_cost} onChange={e => set('offsites_cost', e.target.value)} placeholder="500,000" />
                </Field>
                <Field label="Offsites Notes">
                  <input type="text" className={INPUT} value={inputs.offsites_notes} onChange={e => set('offsites_notes', e.target.value)} />
                </Field>
                <Field label="VIMS System ($/unit)">
                  <input type="number" className={INPUT} value={inputs.vims_per_unit} onChange={e => set('vims_per_unit', e.target.value)} placeholder="8,000" />
                </Field>
              </div>
              {(Number(inputs.vims_per_unit) > 0 || Number(inputs.offsites_cost) > 0) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm mt-4 grid grid-cols-3 gap-4">
                  <div><span className="text-muted-foreground">Offsites </span><span className="font-mono font-semibold">{formatCurrency(summary.offsitesTotal)}</span></div>
                  <div><span className="text-muted-foreground">VIMS Total </span><span className="font-mono font-semibold">{formatCurrency(summary.vimsTotal)}</span></div>
                </div>
              )}
            </Section>

            {/* 6. Solar */}
            <Section title="6 — Solar">
              <div className="mb-4">
                <Field label="Solar Rate ($/W)">
                  <input type="number" className={`${INPUT} max-w-[160px]`} value={inputs.solar_rate_per_w} onChange={e => set('solar_rate_per_w', e.target.value)} placeholder="2.70" step="0.01" />
                </Field>
              </div>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Plan Type</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">Units</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">kWdc / Unit</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Total kWdc</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cost ($)</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(inputs.solar_plans || []).map((plan, idx) => {
                      const u    = Number(plan.units) || 0;
                      const kwdc = Number(plan.kwdc_per_unit) || 0;
                      const totalKwdc = u * kwdc;
                      const cost = totalKwdc * 1000 * (Number(inputs.solar_rate_per_w) || 0);
                      return (
                        <tr key={idx} className="border-b border-border">
                          <td className="px-3 py-1.5">
                            <input type="text" className={INPUT} value={plan.plan_type} onChange={e => setSolarPlan(idx, 'plan_type', e.target.value)} placeholder="P1" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" className={INPUT} value={plan.units} onChange={e => setSolarPlan(idx, 'units', e.target.value)} placeholder="20" />
                          </td>
                          <td className="px-3 py-1.5">
                            <input type="number" className={INPUT} value={plan.kwdc_per_unit} onChange={e => setSolarPlan(idx, 'kwdc_per_unit', e.target.value)} placeholder="4.0" step="0.01" />
                          </td>
                          <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">{totalKwdc > 0 ? totalKwdc.toFixed(2) : '—'}</td>
                          <td className="px-3 py-1.5 text-right font-mono">{cost > 0 ? formatCurrency(cost) : '—'}</td>
                          <td className="px-3 py-1.5">
                            <button onClick={() => removeSolarPlan(idx)} className="text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border bg-muted/20">
                      <td colSpan={4} className="px-3 py-2 text-sm font-semibold">TOTAL Solar</td>
                      <td className="px-3 py-2 text-right font-mono font-bold">{formatCurrency(summary.solarTotal)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <button onClick={addSolarPlan} className="mt-3 flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add plan type
              </button>
            </Section>

            {/* 7. General Conditions */}
            <Section title="7 — General Conditions">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                <Field label="Monthly GC Rate ($/mo)">
                  <input type="number" className={INPUT} value={inputs.gc_monthly_rate} onChange={e => set('gc_monthly_rate', e.target.value)} placeholder="184,068" />
                </Field>
                <Field label="Duration (months)">
                  <input type="number" className={INPUT} value={inputs.gc_duration_months} onChange={e => set('gc_duration_months', e.target.value)} placeholder="24" />
                </Field>
                <Field label="Adjustment (%)">
                  <input type="number" className={INPUT} value={inputs.gc_adjustment_pct} onChange={e => set('gc_adjustment_pct', e.target.value)} placeholder="0" step="0.1" />
                </Field>
                <Field label="Notes">
                  <input type="text" className={INPUT} value={inputs.gc_notes} onChange={e => set('gc_notes', e.target.value)} />
                </Field>
              </div>
              {(Number(inputs.gc_monthly_rate) > 0) && (
                <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Total </span><span className="font-mono font-semibold">{formatCurrency(summary.gcTotal)}</span>
                </div>
              )}
            </Section>

          </div>
        ) : (
          /* ── SUMMARY TAB ── */
          <div className="p-6 max-w-3xl mx-auto space-y-5">
            <div>
              <h2 className="text-lg font-bold">{projectName || 'Unnamed Estimate'} — Hard Cost Summary</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{scenarioName} · {inputs.distribution_date || '—'}</p>
            </div>

            {/* Assumptions */}
            <div className="rounded-xl border border-border bg-card p-4 grid grid-cols-3 gap-4 text-sm">
              {[
                { label: 'Total Units', value: inputs.total_units || '—' },
                { label: 'Total NRSF', value: inputs.total_nrsf ? Number(inputs.total_nrsf).toLocaleString() + ' SF' : '—' },
                { label: 'Site Area',  value: inputs.net_site_acres ? inputs.net_site_acres + ' acres' : '—' },
                { label: 'Const. Start', value: inputs.construction_start || '—' },
              ].map(a => (
                <div key={a.label}>
                  <p className="text-xs text-muted-foreground">{a.label}</p>
                  <p className="font-medium mt-0.5">{a.value}</p>
                </div>
              ))}
            </div>

            {/* Cost table */}
            <div className="rounded-xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cost Category</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Gross Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">$/Unit</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">$/NRSF</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lines.map((line, idx) => (
                    <tr key={line.label} className={`border-b border-border ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3 font-medium">{line.label}</td>
                      <td className="px-4 py-3 text-right font-mono">{line.cost > 0 ? formatCurrency(line.cost) : <span className="text-muted-foreground/50">—</span>}</td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {summary.perUnit(line.cost) != null && line.cost > 0 ? formatCurrency(summary.perUnit(line.cost)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                        {summary.perNRSF(line.cost) != null && line.cost > 0 ? formatPSF(summary.perNRSF(line.cost)) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{line.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-primary/5">
                    <td className="px-4 py-3 font-bold">TOTAL — Hard Cost (before escalation)</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-primary">{formatCurrency(summary.grandTotal)}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-muted-foreground">
                      {summary.perUnit(summary.grandTotal) != null ? formatCurrency(summary.perUnit(summary.grandTotal)) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-muted-foreground">
                      {summary.perNRSF(summary.grandTotal) != null ? formatPSF(summary.perNRSF(summary.grandTotal)) : '—'}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
