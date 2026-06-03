import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, getAverage, getMedian, getPercentile } from '@/lib/costUtils';

export default function Benchmarks() {
  const [filterType, setFilterType] = useState('all');
  const [filterConstruction, setFilterConstruction] = useState('all');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['project-costs'],
    queryFn: () => db.ProjectCost.list('-created_date', 5000),
  });

  const benchmarks = useMemo(() => {
    const filteredProjects = projects.filter(p => {
      if (filterType !== 'all' && p.product_type !== filterType) return false;
      if (filterConstruction !== 'all' && p.construction_type !== filterConstruction) return false;
      return p.total_hard_cost && p.unit_count;
    });

    const categories = new Set();
    costs.forEach(c => { if (c.category_name) categories.add(c.category_name); });

    return [...categories].map(cat => {
      const values = costs
        .filter(c => c.category_name === cat && filteredProjects.some(p => p.id === c.project_id))
        .map(c => {
          const proj = filteredProjects.find(p => p.id === c.project_id);
          return proj?.unit_count ? c.total_cost / proj.unit_count : 0;
        })
        .filter(v => v > 0);

      if (!values.length) return null;

      return {
        category: cat,
        avg: getAverage(values),
        median: getMedian(values),
        p25: getPercentile(values, 25),
        p75: getPercentile(values, 75),
        min: Math.min(...values),
        max: Math.max(...values),
        count: values.length,
      };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);
  }, [projects, costs, filterType, filterConstruction]);

  const productTypes = [...new Set(projects.map(p => p.product_type).filter(Boolean))];
  const constructionTypes = [...new Set(projects.map(p => p.construction_type).filter(Boolean))];

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Benchmarking Engine</h1>
        <p className="text-sm text-muted-foreground mt-1">Dynamic cost benchmarks across your portfolio ($/Unit)</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Product Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Product Types</SelectItem>
            {productTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterConstruction} onValueChange={setFilterConstruction}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Construction Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Construction Types</SelectItem>
            {constructionTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Cost Category</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Avg $/Unit</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Median</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">25th Pctl</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">75th Pctl</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Min</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Max</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Projects</th>
              </tr>
            </thead>
            <tbody>
              {benchmarks.map(b => (
                <tr key={b.category} className="border-b border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium">{b.category}</td>
                  <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatCurrency(b.avg)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.median)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.p25)}</td>
                  <td className="px-4 py-2.5 text-right font-mono">{formatCurrency(b.p75)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-green-600">{formatCurrency(b.min)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-red-500">{formatCurrency(b.max)}</td>
                  <td className="px-4 py-2.5 text-right text-muted-foreground">{b.count}</td>
                </tr>
              ))}
              {!benchmarks.length && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No benchmark data. Import projects with cost breakdowns to see benchmarks.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}