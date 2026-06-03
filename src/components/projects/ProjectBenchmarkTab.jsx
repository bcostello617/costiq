import { useMemo } from 'react';
import { formatCurrency, formatPercent, getAverage, getMedian, getPercentile } from '@/lib/costUtils';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

export default function ProjectBenchmarkTab({ project, costs, allProjects, allCosts }) {
  const comparables = useMemo(() => {
    return allProjects.filter(p =>
      p.id !== project.id && p.total_hard_cost && p.unit_count &&
      (p.product_type === project.product_type || p.construction_type === project.construction_type || p.state === project.state)
    );
  }, [project, allProjects]);

  const benchmarks = useMemo(() => {
    if (!comparables.length) return [];

    // Get all cost categories from this project
    return costs.map(cost => {
      const categoryName = cost.category_name;
      const compCosts = allCosts.filter(c =>
        comparables.some(p => p.id === c.project_id) && c.category_name === categoryName
      );

      if (!compCosts.length) return null;

      // Calculate per-unit costs for comparables
      const perUnitValues = compCosts.map(c => {
        const proj = comparables.find(p => p.id === c.project_id);
        return proj?.unit_count ? c.total_cost / proj.unit_count : 0;
      }).filter(v => v > 0);

      if (!perUnitValues.length) return null;

      const projPerUnit = project.unit_count ? cost.total_cost / project.unit_count : 0;
      const avg = getAverage(perUnitValues);
      const median = getMedian(perUnitValues);
      const p25 = getPercentile(perUnitValues, 25);
      const p75 = getPercentile(perUnitValues, 75);
      const diff = projPerUnit - avg;
      const diffPct = avg ? (diff / avg) * 100 : 0;

      return {
        category: categoryName,
        projectCostPerUnit: projPerUnit,
        avgCostPerUnit: avg,
        medianCostPerUnit: median,
        p25,
        p75,
        diff,
        diffPct,
        compCount: perUnitValues.length,
      };
    }).filter(Boolean);
  }, [costs, comparables, allCosts, project]);

  const projectCostPerUnit = project.unit_count ? (project.total_hard_cost || 0) / project.unit_count : 0;
  const compAvgCPU = getAverage(comparables.filter(p => p.unit_count).map(p => p.total_hard_cost / p.unit_count));
  const overallDiff = compAvgCPU ? ((projectCostPerUnit - compAvgCPU) / compAvgCPU) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Comparable Projects</p>
          <p className="text-2xl font-bold mt-1">{comparables.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Matched by type, construction, or market</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">Your Cost/Unit</p>
          <p className="text-2xl font-bold mt-1">{formatCurrency(projectCostPerUnit, true)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <p className="text-xs text-muted-foreground">vs. Comparable Avg</p>
          <div className="flex items-center gap-2 mt-1">
            <p className={cn("text-2xl font-bold", overallDiff > 0 ? "text-red-500" : overallDiff < 0 ? "text-green-600" : "")}>
              {overallDiff > 0 ? '+' : ''}{formatPercent(overallDiff)}
            </p>
          </div>
        </div>
      </div>

      {/* Trade Benchmarks */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Trade-by-Trade Benchmark</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Your $/Unit</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Avg $/Unit</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Median</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">25th Pctl</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">75th Pctl</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Variance</th>
                <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">Comps</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map(b => (
                <tr key={b.category} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{b.category}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.projectCostPerUnit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.avgCostPerUnit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.medianCostPerUnit)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.p25)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.p75)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                      b.diffPct > 5 ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                      b.diffPct < -5 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                      "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    )}>
                      {b.diffPct > 0 ? <ArrowUp className="h-3 w-3" /> : b.diffPct < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                      {Math.abs(b.diffPct).toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{b.compCount}</td>
                </tr>
              ))}
              {!benchmarks.length && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Need more projects with cost data to generate benchmarks</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}