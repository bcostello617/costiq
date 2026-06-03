import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Trash2, Building2 } from 'lucide-react';
import { formatCurrency, formatNumber, formatPercent, formatPSF } from '@/lib/costUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import CostLineForm from '@/components/projects/CostLineForm';

export default function ProjectCostsTab({ project, costs }) {
  const [addOpen, setAddOpen] = useState(false);
  const [selectedGC, setSelectedGC] = useState('all');
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => db.ProjectCost.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['project-costs', project.id] }),
  });

  // Collect unique GCs that have at least one tagged cost line
  const gcOptions = [...new Set(costs.map(c => c.bid_gc).filter(Boolean))].sort();
  const hasMultipleGCs = gcOptions.length > 1;

  // Filter costs by selected GC
  const visibleCosts = selectedGC === 'all'
    ? costs
    : costs.filter(c => c.bid_gc === selectedGC);

  const totalCost   = visibleCosts.reduce((s, c) => s + (c.total_cost || 0), 0);
  const sortedCosts = [...visibleCosts].sort((a, b) => (b.total_cost || 0) - (a.total_cost || 0));

  const chartData = sortedCosts.slice(0, 15).map(c => ({
    name: c.category_name?.substring(0, 15) || 'Unknown',
    cost: c.total_cost || 0,
  }));

  return (
    <div className="space-y-6">

      {/* GC toggle — only shown when multiple GCs exist */}
      {hasMultipleGCs && (
        <div className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-3 flex-wrap">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-muted-foreground">GC Bid:</span>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedGC('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedGC === 'all'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border hover:bg-muted text-muted-foreground'
              }`}
            >
              All bids ({costs.length})
            </button>
            {gcOptions.map(gc => {
              const count = costs.filter(c => c.bid_gc === gc).length;
              return (
                <button
                  key={gc}
                  onClick={() => setSelectedGC(gc)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    selectedGC === gc
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {gc} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bar Chart */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Cost by Category</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tickFormatter={v => formatCurrency(v, true)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={80} />
              <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="cost" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">No cost data</div>
        )}
      </div>

      {/* Cost Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">
            Line Items ({sortedCosts.length}
            {selectedGC !== 'all' && <span className="text-muted-foreground font-normal"> · {selectedGC}</span>}
            )
          </h3>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" />Add Cost</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Cost Line</DialogTitle></DialogHeader>
              <CostLineForm projectId={project.id} project={project} onClose={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Total Cost</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cost/Unit</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Cost/SF</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">% of Total</th>
                {selectedGC === 'all' && gcOptions.length > 0 && (
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">GC</th>
                )}
                <th className="px-4 py-2.5 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sortedCosts.map(c => {
                const perUnit = project.unit_count ? c.total_cost / project.unit_count : 0;
                const perSF   = project.gross_sf   ? c.total_cost / project.gross_sf   : 0;
                const pct     = totalCost ? (c.total_cost / totalCost) * 100 : 0;
                return (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5 font-medium">{c.category_name || '—'}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(c.total_cost)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(perUnit)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatPSF(perSF)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{formatPercent(pct)}</td>
                    {selectedGC === 'all' && gcOptions.length > 0 && (
                      <td className="px-4 py-2.5">
                        {c.bid_gc
                          ? <span className="text-xs text-muted-foreground">{c.bid_gc}</span>
                          : <span className="text-xs text-muted-foreground/40">—</span>
                        }
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                        onClick={() => deleteMutation.mutate(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {sortedCosts.length > 0 && (
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(totalCost)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(project.unit_count ? totalCost / project.unit_count : 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatPSF(project.gross_sf ? totalCost / project.gross_sf : 0)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">100.0%</td>
                  {selectedGC === 'all' && gcOptions.length > 0 && <td></td>}
                  <td></td>
                </tr>
              )}
              {!sortedCosts.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No cost data for this GC.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
