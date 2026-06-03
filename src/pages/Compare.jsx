import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { formatCurrency, formatNumber, calcCostPerUnit, calcCostPerSF, calcDensity, calcDuration } from '@/lib/costUtils';
import { cn } from '@/lib/utils';
import { GitCompareArrows, X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const COLORS = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#ec4899'];

export default function Compare() {
  const [selectedIds, setSelectedIds] = useState([]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const { data: allCosts = [] } = useQuery({
    queryKey: ['project-costs'],
    queryFn: () => db.ProjectCost.list('-created_date', 5000),
  });

  const toggleProject = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 7 ? [...prev, id] : prev);
  };

  const selected = useMemo(() => projects.filter(p => selectedIds.includes(p.id)), [projects, selectedIds]);

  // Build trade comparison data
  const tradeData = useMemo(() => {
    if (selected.length < 2) return [];
    const categories = new Set();
    selected.forEach(p => {
      allCosts.filter(c => c.project_id === p.id).forEach(c => categories.add(c.category_name));
    });

    return [...categories].map(cat => {
      const row = { category: cat };
      selected.forEach((p, i) => {
        const cost = allCosts.find(c => c.project_id === p.id && c.category_name === cat);
        row[`project_${i}`] = cost && p.unit_count ? cost.total_cost / p.unit_count : 0;
      });
      return row;
    }).sort((a, b) => {
      const aMax = Math.max(...selected.map((_, i) => a[`project_${i}`] || 0));
      const bMax = Math.max(...selected.map((_, i) => b[`project_${i}`] || 0));
      return bMax - aMax;
    }).slice(0, 15);
  }, [selected, allCosts]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Comparison</h1>
        <p className="text-sm text-muted-foreground mt-1">Select up to 7 projects to compare side-by-side</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Project Selector */}
        <div className="rounded-xl border border-border bg-card p-4 lg:col-span-1 max-h-[600px] overflow-y-auto">
          <h3 className="text-sm font-semibold mb-3">Select Projects</h3>
          <div className="space-y-2">
            {projects.map(p => (
              <label key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox checked={selectedIds.includes(p.id)} onCheckedChange={() => toggleProject(p.id)} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.project_name}</p>
                  <p className="text-xs text-muted-foreground">{p.city}, {p.state} · {formatNumber(p.unit_count)} units</p>
                </div>
              </label>
            ))}
            {!projects.length && <p className="text-sm text-muted-foreground text-center py-4">No projects available</p>}
          </div>
        </div>

        {/* Comparison View */}
        <div className="lg:col-span-3 space-y-6">
          {selected.length < 2 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <GitCompareArrows className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Select at least 2 projects to compare</p>
            </div>
          ) : (
            <>
              {/* Metrics Table */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Metric</th>
                        {selected.map((p, i) => (
                          <th key={p.id} className="px-4 py-3 text-right font-medium" style={{ color: COLORS[i] }}>
                            <div className="flex items-center justify-end gap-2">
                              <span className="truncate max-w-[120px]">{p.project_name}</span>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => toggleProject(p.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: 'Total Cost', fn: p => formatCurrency(p.total_hard_cost, true) },
                        { label: 'Cost/Unit', fn: p => formatCurrency(calcCostPerUnit(p.total_hard_cost, p.unit_count), true) },
                        { label: 'Cost/SF', fn: p => formatCurrency(calcCostPerSF(p.total_hard_cost, p.gross_sf)) },
                        { label: 'Unit Count', fn: p => formatNumber(p.unit_count) },
                        { label: 'Gross SF', fn: p => formatNumber(p.gross_sf) },
                        { label: 'Density (u/ac)', fn: p => formatNumber(calcDensity(p.unit_count, p.site_acres), 1) },
                        { label: 'Duration (mo)', fn: p => formatNumber(calcDuration(p.start_date, p.completion_date)) },
                        { label: 'Product Type', fn: p => p.product_type || '—' },
                        { label: 'Construction', fn: p => p.construction_type || '—' },
                      ].map(row => (
                        <tr key={row.label} className="border-b border-border hover:bg-muted/30">
                          <td className="px-4 py-2.5 font-medium text-muted-foreground">{row.label}</td>
                          {selected.map(p => (
                            <td key={p.id} className="px-4 py-2.5 text-right font-mono">{row.fn(p)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Trade Comparison Chart */}
              {tradeData.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-semibold mb-4">Trade-by-Trade Comparison ($/Unit)</h3>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={tradeData} layout="vertical" margin={{ left: 100 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tickFormatter={v => formatCurrency(v, true)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis dataKey="category" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                      <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                      <Legend wrapperStyle={{ fontSize: '11px' }} />
                      {selected.map((p, i) => (
                        <Bar key={p.id} dataKey={`project_${i}`} name={p.project_name?.substring(0, 15)} fill={COLORS[i]} radius={[0, 2, 2, 0]} />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}