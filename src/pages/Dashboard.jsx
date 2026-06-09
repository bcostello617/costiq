import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/api/supabaseClient';
import { formatCurrency, formatPSF } from '@/lib/costUtils';
import { Building2, TrendingUp } from 'lucide-react';

// ── Bucket a category_name into one of 5 summary buckets ──────────────────────
function bucket(catName) {
  if (!catName) return 'direct';
  const s = catName.toLowerCase();
  if (s.includes('solar'))                                       return 'solar';
  if (s.includes('general condition'))                           return 'gen';
  if (s.includes('sitework') || s.includes('site work') ||
      s.includes('horizontal') || s.includes('land develop') ||
      s.includes('earthwork') || s.includes('grading') ||
      s.includes('paving') || s.includes('landscap') ||
      s.includes('underground') || s.includes('site util'))      return 'site';
  if (s.includes('rec.') || s.includes('clubhouse') ||
      s.includes('recreation') || s.includes('amenity'))         return 'rec';
  if (s.includes('other'))                                       return 'other';
  return 'direct';
}

export default function Dashboard() {
  const { data: projects = [], isLoading: loadingP } = useQuery({
    queryKey: ['projects'],
    queryFn: () => supabase.from('projects').select('*').order('project_name').then(r => r.data ?? []),
  });

  const { data: costs = [], isLoading: loadingC } = useQuery({
    queryKey: ['all-costs'],
    queryFn: () => supabase.from('project_costs').select('*').then(r => r.data ?? []),
  });

  // Build per-project cost buckets
  const costMap = useMemo(() => {
    const map = {};
    costs.forEach(c => {
      if (!map[c.project_id]) map[c.project_id] = { site: 0, direct: 0, rec: 0, gen: 0, solar: 0, other: 0 };
      map[c.project_id][bucket(c.category_name)] += c.total_cost || 0;
    });
    return map;
  }, [costs]);

  const loading = loadingP || loadingC;

  // Portfolio totals
  const portfolioTotal = projects.reduce((s, p) => s + (p.total_hard_cost || 0), 0);
  const avgPerUnit = useMemo(() => {
    const valid = projects.filter(p => p.total_hard_cost && p.unit_count);
    if (!valid.length) return 0;
    return valid.reduce((s, p) => s + p.total_hard_cost / p.unit_count, 0) / valid.length;
  }, [projects]);
  const avgPerSF = useMemo(() => {
    const valid = projects.filter(p => p.total_hard_cost && p.gross_sf);
    if (!valid.length) return 0;
    return valid.reduce((s, p) => s + p.total_hard_cost / p.gross_sf, 0) / valid.length;
  }, [projects]);

  const rows = [
    // ── Project Info ──
    { section: 'PROJECT DETAILS', id: '_hdr1', label: '', isHeader: true },
    { id: 'city',    label: 'City',          fmt: (p)      => p.city ? `${p.city}, ${p.state || 'CA'}` : '—', align: 'left' },
    { id: 'units',   label: 'Units',         fmt: (p)      => p.unit_count?.toLocaleString() ?? '—',         align: 'right' },
    { id: 'gsf',     label: 'Gross SF',      fmt: (p)      => p.gross_sf ? Math.round(p.gross_sf).toLocaleString() : '—', align: 'right' },
    { id: 'nrsf',    label: 'NRSF',          fmt: (p)      => p.nrsf ? Math.round(p.nrsf).toLocaleString() : '—', align: 'right' },
    { id: 'gc',      label: 'GC',            fmt: (p)      => p.general_contractor || '—',                   align: 'left' },

    // ── Construction Costs ──
    { section: 'CONSTRUCTION COSTS', id: '_hdr2', label: '', isHeader: true },
    { id: 'site',    label: 'Sitework',      fmt: (p, c)   => c?.site    ? formatCurrency(c.site,    true) : '—', align: 'right', cost: true },
    { id: 'direct',  label: 'Direct Bldg.',  fmt: (p, c)   => c?.direct  ? formatCurrency(c.direct,  true) : '—', align: 'right', cost: true, highlight: true },
    { id: 'rec',     label: 'Rec / Club',    fmt: (p, c)   => c?.rec     ? formatCurrency(c.rec,     true) : '—', align: 'right', cost: true },
    { id: 'gen',     label: 'Gen. Cond.',    fmt: (p, c)   => c?.gen     ? formatCurrency(c.gen,     true) : '—', align: 'right', cost: true },
    { id: 'solar',   label: 'Solar',         fmt: (p, c)   => c?.solar   ? formatCurrency(c.solar,   true) : '—', align: 'right', cost: true },
    { id: 'other',   label: 'Other',         fmt: (p, c)   => c?.other   ? formatCurrency(c.other,   true) : '—', align: 'right', cost: true },
    { id: 'total',   label: 'TOTAL',         fmt: (p)      => p.total_hard_cost ? formatCurrency(p.total_hard_cost, true) : '—', align: 'right', cost: true, bold: true },

    // ── Per Unit ──
    { section: '$/UNIT', id: '_hdr3', label: '', isHeader: true },
    { id: 'pu_total',  label: 'Total / Unit',        fmt: (p, c)  => p.total_hard_cost && p.unit_count ? formatCurrency(p.total_hard_cost / p.unit_count, true) : '—', align: 'right', bold: true },
    { id: 'pu_direct', label: 'Direct Bldg. / Unit', fmt: (p, c)  => c?.direct && p.unit_count ? formatCurrency(c.direct / p.unit_count, true) : '—', align: 'right' },
    { id: 'pu_site',   label: 'Sitework / Unit',     fmt: (p, c)  => c?.site && p.unit_count ? formatCurrency(c.site / p.unit_count, true) : '—', align: 'right' },

    // ── Per SF ──
    { section: '$/NRSF', id: '_hdr4', label: '', isHeader: true },
    { id: 'sf_total',  label: 'Total / NRSF',        fmt: (p)     => p.total_hard_cost && p.gross_sf ? formatPSF(p.total_hard_cost / p.gross_sf) : '—', align: 'right', bold: true },
    { id: 'sf_direct', label: 'Direct Bldg. / NRSF', fmt: (p, c)  => c?.direct && p.gross_sf ? formatPSF(c.direct / p.gross_sf) : '—', align: 'right' },
    { id: 'sf_site',   label: 'Sitework / NRSF',     fmt: (p, c)  => c?.site && p.gross_sf ? formatPSF(c.site / p.gross_sf) : '—', align: 'right' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" />
        Loading portfolio...
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-2xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Portfolio Summary
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{projects.length} active projects</p>
        </div>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Portfolio Hard Cost</p>
          <p className="text-2xl font-bold tracking-tight mt-1">{formatCurrency(portfolioTotal, true)}</p>
          <p className="text-xs text-muted-foreground mt-1">{projects.length} projects</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg. Cost / Unit</p>
          <p className="text-2xl font-bold tracking-tight mt-1">{formatCurrency(avgPerUnit, true)}</p>
          <p className="text-xs text-muted-foreground mt-1">portfolio average</p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Avg. Cost / SF</p>
          <p className="text-2xl font-bold tracking-tight mt-1">{formatPSF(avgPerSF)}</p>
          <p className="text-xs text-muted-foreground mt-1">gross SF basis</p>
        </div>
      </div>

      {/* Side-by-side matrix table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="text-sm border-collapse" style={{ minWidth: `${200 + projects.length * 160}px` }}>
            <thead>
              <tr className="border-b border-border bg-muted/60">
                {/* Label col */}
                <th className="sticky left-0 z-10 bg-muted/60 px-4 py-3 text-left text-xs font-semibold text-muted-foreground w-44 min-w-[11rem]"></th>
                {projects.map(p => (
                  <th key={p.id} className="px-3 py-3 text-center text-xs font-semibold text-foreground whitespace-nowrap min-w-[150px]">
                    <div className="font-bold">{p.project_name}</div>
                    <div className="text-muted-foreground font-normal mt-0.5">{p.city}{p.state ? `, ${p.state}` : ''}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                if (row.isHeader) {
                  return (
                    <tr key={row.id} className="bg-primary/8">
                      <td
                        colSpan={projects.length + 1}
                        className="sticky left-0 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-primary"
                      >
                        {row.section}
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border/60 ${ri % 2 === 0 ? '' : 'bg-muted/10'} hover:bg-muted/20 transition-colors`}
                  >
                    <td className={`sticky left-0 z-10 px-4 py-2.5 text-xs font-medium whitespace-nowrap
                      ${ri % 2 === 0 ? 'bg-card' : 'bg-muted/10'}
                      ${row.bold ? 'text-foreground font-semibold border-t border-border' : 'text-muted-foreground'}
                    `}>
                      {row.label}
                    </td>
                    {projects.map(p => {
                      const c = costMap[p.id];
                      const val = row.fmt(p, c);
                      return (
                        <td
                          key={p.id}
                          className={`px-3 py-2.5 text-xs whitespace-nowrap
                            ${row.align === 'right' ? 'text-right font-mono' : 'text-left'}
                            ${row.bold ? 'font-bold border-t border-border' : ''}
                            ${row.highlight ? 'text-primary font-semibold' : ''}
                            ${val === '—' ? 'text-muted-foreground/40' : ''}
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
