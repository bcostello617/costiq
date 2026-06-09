import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { formatCurrency, formatPSF } from '@/lib/costUtils';
import { Building2 } from 'lucide-react';

// ── Map a category_name to a summary bucket ───────────────────────────────────
function bucket(catName) {
  if (!catName) return 'direct';
  const s = catName.toLowerCase();
  if (s.includes('solar'))                                          return 'solar';
  if (s.includes('general condition'))                              return 'gen';
  if (s.includes('sitework') || s.includes('site work') ||
      s.includes('horizontal') || s.includes('land develop') ||
      s.includes('earthwork') || s.includes('grading') ||
      s.includes('paving') || s.includes('landscap') ||
      s.includes('underground') || s.includes('site util'))         return 'site';
  if (s.includes('rec.') || s.includes('clubhouse') ||
      s.includes('recreation') || s.includes('amenity'))            return 'rec';
  if (s.includes('other'))                                          return 'other';
  return 'direct';
}

// ── Row definitions ───────────────────────────────────────────────────────────
const ROWS = [
  // Project Details
  { section: 'PROJECT DETAILS' },
  { id: 'units',     label: 'Units',              fmt: (p)    => p.unit_count?.toLocaleString() ?? '—',                                              align: 'right' },
  { id: 'gsf',       label: 'Gross SF',           fmt: (p)    => p.gross_sf ? Math.round(p.gross_sf).toLocaleString() : '—',                         align: 'right' },
  { id: 'gc',        label: 'GC',                 fmt: (p)    => p.general_contractor || '—',                                                        align: 'left'  },

  // Construction Costs
  { section: 'CONSTRUCTION COSTS' },
  { id: 'site',      label: 'Sitework',           fmt: (p, c) => c?.site   ? formatCurrency(c.site,   true) : '—',  align: 'right' },
  { id: 'direct',    label: 'Direct Bldg.',       fmt: (p, c) => c?.direct ? formatCurrency(c.direct, true) : '—',  align: 'right', accent: true },
  { id: 'rec',       label: 'Rec / Club',         fmt: (p, c) => c?.rec    ? formatCurrency(c.rec,    true) : '—',  align: 'right' },
  { id: 'gen',       label: 'Gen. Conditions',    fmt: (p, c) => c?.gen    ? formatCurrency(c.gen,    true) : '—',  align: 'right' },
  { id: 'solar',     label: 'Solar',              fmt: (p, c) => c?.solar  ? formatCurrency(c.solar,  true) : '—',  align: 'right' },
  { id: 'other',     label: 'Other',              fmt: (p, c) => c?.other  ? formatCurrency(c.other,  true) : '—',  align: 'right' },
  { id: 'total',     label: 'Total Hard Cost',    fmt: (p)    => p.total_hard_cost ? formatCurrency(p.total_hard_cost, true) : '—', align: 'right', bold: true },

  // $/Unit
  { section: '$ / UNIT' },
  { id: 'pu_total',  label: 'Total / Unit',       fmt: (p)    => p.total_hard_cost && p.unit_count ? formatCurrency(p.total_hard_cost / p.unit_count, true) : '—', align: 'right', bold: true },
  { id: 'pu_direct', label: 'Direct Bldg. / Unit',fmt: (p, c) => c?.direct && p.unit_count ? formatCurrency(c.direct / p.unit_count, true) : '—',                align: 'right' },
  { id: 'pu_site',   label: 'Sitework / Unit',    fmt: (p, c) => c?.site   && p.unit_count ? formatCurrency(c.site   / p.unit_count, true) : '—',                align: 'right' },

  // $/SF
  { section: '$ / GROSS SF' },
  { id: 'sf_total',  label: 'Total / SF',         fmt: (p)    => p.total_hard_cost && p.gross_sf ? formatPSF(p.total_hard_cost / p.gross_sf) : '—', align: 'right', bold: true },
  { id: 'sf_direct', label: 'Direct Bldg. / SF',  fmt: (p, c) => c?.direct && p.gross_sf ? formatPSF(c.direct / p.gross_sf) : '—',                align: 'right' },
  { id: 'sf_site',   label: 'Sitework / SF',      fmt: (p, c) => c?.site   && p.gross_sf ? formatPSF(c.site   / p.gross_sf) : '—',                align: 'right' },
];

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingP } = useQuery({
    queryKey: ['projects'],
    queryFn: () => supabase.from('projects').select('*').order('project_name').then(r => r.data ?? []),
  });

  const { data: costs = [], isLoading: loadingC } = useQuery({
    queryKey: ['all-costs'],
    queryFn: () => supabase.from('project_costs').select('*').then(r => r.data ?? []),
  });

  const costMap = useMemo(() => {
    const map = {};
    costs.forEach(c => {
      if (!map[c.project_id]) map[c.project_id] = { site: 0, direct: 0, rec: 0, gen: 0, solar: 0, other: 0 };
      map[c.project_id][bucket(c.category_name)] += c.total_cost || 0;
    });
    return map;
  }, [costs]);

  const portfolioTotal = projects.reduce((s, p) => s + (p.total_hard_cost || 0), 0);
  const avgPerUnit = useMemo(() => {
    const v = projects.filter(p => p.total_hard_cost && p.unit_count);
    return v.length ? v.reduce((s, p) => s + p.total_hard_cost / p.unit_count, 0) / v.length : 0;
  }, [projects]);
  const avgPerSF = useMemo(() => {
    const v = projects.filter(p => p.total_hard_cost && p.gross_sf);
    return v.length ? v.reduce((s, p) => s + p.total_hard_cost / p.gross_sf, 0) / v.length : 0;
  }, [projects]);

  if (loadingP || loadingC) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
        Loading portfolio...
      </div>
    );
  }

  // Flatten ROWS into segments: section headers interspersed with data rows
  // Track data-row index separately for striping
  let dataRowIdx = 0;

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-2xl mx-auto">

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Portfolio Summary
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{projects.length} active projects</p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Portfolio Hard Cost', value: formatCurrency(portfolioTotal, true), sub: `${projects.length} projects` },
          { label: 'Avg. Cost / Unit',    value: formatCurrency(avgPerUnit, true),     sub: 'portfolio average' },
          { label: 'Avg. Cost / SF',      value: formatPSF(avgPerSF),                  sub: 'gross SF basis' },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-border bg-card px-5 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">{k.label}</p>
            <p className="text-2xl font-bold tracking-tight mt-1">{k.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Matrix table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse w-full" style={{ minWidth: `${180 + projects.length * 155}px` }}>

            {/* Column headers — one per project */}
            <thead>
              <tr className="border-b-2 border-border">
                <th className="sticky left-0 z-20 bg-card w-44 min-w-[11rem] px-4 py-3" />
                {projects.map(p => (
                  <th key={p.id} className="bg-card px-3 py-3 text-center min-w-[148px]">
                    <div className="text-xs font-bold text-foreground leading-snug">{p.project_name}</div>
                    <div className="text-[11px] text-muted-foreground font-normal mt-0.5">
                      {[p.city, p.state].filter(Boolean).join(', ')}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {ROWS.map((row) => {
                // Section header row
                if (row.section) {
                  dataRowIdx = 0; // reset stripe within section
                  return (
                    <tr key={row.section}>
                      <td
                        colSpan={projects.length + 1}
                        className="sticky left-0 bg-muted/40 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary border-t border-border"
                      >
                        {row.section}
                      </td>
                    </tr>
                  );
                }

                const stripe = dataRowIdx++ % 2 === 1;
                const bg = stripe ? 'bg-muted/20' : 'bg-card';

                return (
                  <tr key={row.id} className={`${bg} border-b border-border/50 hover:bg-primary/5 transition-colors`}>
                    {/* Label */}
                    <td className={`sticky left-0 z-10 ${bg} px-4 py-2.5 text-xs whitespace-nowrap
                      ${row.bold ? 'font-semibold text-foreground' : 'font-medium text-muted-foreground'}`}>
                      {row.label}
                    </td>
                    {/* Values */}
                    {projects.map(p => {
                      const c = costMap[p.id];
                      const val = row.fmt(p, c);
                      const isEmpty = val === '—';
                      return (
                        <td
                          key={p.id}
                          className={`px-3 py-2.5 text-xs whitespace-nowrap
                            ${row.align === 'right' ? 'text-right font-mono' : 'text-left'}
                            ${row.bold ? 'font-semibold text-foreground' : ''}
                            ${row.accent && !isEmpty ? 'text-primary font-semibold' : ''}
                            ${isEmpty ? 'text-muted-foreground/30' : ''}
                          `}
                        >
                          {val}
                        </td>
                      );
                    })}
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
