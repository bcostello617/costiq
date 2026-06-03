import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency, formatNumber, getAverage, calcCostPerUnit, calcCostPerSF } from '@/lib/costUtils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ScatterChart, Scatter, ZAxis, Cell, Legend, LineChart, Line } from 'recharts';

const COLORS = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1'];

export default function Analytics() {
  const [groupBy, setGroupBy] = useState('product_type');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['project-costs'],
    queryFn: () => db.ProjectCost.list('-created_date', 5000),
  });

  // Group avg cost per unit by selected dimension
  const groupedData = useMemo(() => {
    const groups = {};
    projects.filter(p => p.total_hard_cost && p.unit_count).forEach(p => {
      const key = p[groupBy] || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(p.total_hard_cost / p.unit_count);
    });
    return Object.entries(groups)
      .map(([name, vals]) => ({ name, avg: Math.round(getAverage(vals)), count: vals.length }))
      .sort((a, b) => b.avg - a.avg);
  }, [projects, groupBy]);

  // Top/bottom projects
  const rankedProjects = useMemo(() => {
    return projects
      .filter(p => p.total_hard_cost && p.unit_count)
      .map(p => ({ ...p, costPerUnit: p.total_hard_cost / p.unit_count }))
      .sort((a, b) => a.costPerUnit - b.costPerUnit);
  }, [projects]);

  // Trade escalation by year
  const escalationData = useMemo(() => {
    const byYear = {};
    costs.forEach(c => {
      const project = projects.find(p => p.id === c.project_id);
      if (!project?.completion_date || !project?.unit_count) return;
      const year = new Date(project.completion_date).getFullYear();
      const cat = c.category_name;
      if (!cat) return;
      if (!byYear[year]) byYear[year] = {};
      if (!byYear[year][cat]) byYear[year][cat] = [];
      byYear[year][cat].push(c.total_cost / project.unit_count);
    });

    const years = Object.keys(byYear).sort();
    const topCategories = new Set();
    costs.forEach(c => topCategories.add(c.category_name));
    const top5 = [...topCategories].slice(0, 5);

    return years.map(year => {
      const row = { year };
      top5.forEach(cat => {
        const vals = byYear[year]?.[cat] || [];
        row[cat] = vals.length ? Math.round(getAverage(vals)) : null;
      });
      return row;
    });
  }, [costs, projects]);

  const topCategories = useMemo(() => {
    const cats = new Set();
    costs.forEach(c => cats.add(c.category_name));
    return [...cats].slice(0, 5);
  }, [costs]);

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cost Intelligence</h1>
          <p className="text-sm text-muted-foreground mt-1">Advanced analytics across your portfolio</p>
        </div>
      </div>

      {/* Average Cost by Dimension */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="text-sm font-semibold">Average Cost Per Unit by</h3>
          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="product_type">Product Type</SelectItem>
              <SelectItem value="construction_type">Construction Type</SelectItem>
              <SelectItem value="state">State</SelectItem>
              <SelectItem value="city">City</SelectItem>
              <SelectItem value="market">Market</SelectItem>
              <SelectItem value="developer">Developer</SelectItem>
              <SelectItem value="general_contractor">GC</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {groupedData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={groupedData} margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tickFormatter={v => formatCurrency(v, true)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={v => [formatCurrency(v), 'Avg $/Unit']} />
              <Bar dataKey="avg" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]}>
                {groupedData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top & Bottom Projects */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Projects Ranked by Cost/Unit</h3>
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {rankedProjects.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-muted-foreground w-6">{i + 1}</span>
                  <div>
                    <p className="text-sm font-medium">{p.project_name}</p>
                    <p className="text-xs text-muted-foreground">{p.product_type} · {p.city}, {p.state}</p>
                  </div>
                </div>
                <span className="text-sm font-mono font-semibold">{formatCurrency(p.costPerUnit, true)}</span>
              </div>
            ))}
            {!rankedProjects.length && <p className="text-sm text-muted-foreground text-center py-4">No projects with cost data</p>}
          </div>
        </div>

        {/* Trade Escalation */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Trade Escalation Trends ($/Unit by Year)</h3>
          {escalationData.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={escalationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tickFormatter={v => formatCurrency(v, true)} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} formatter={v => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                {topCategories.map((cat, i) => (
                  <Line key={cat} type="monotone" dataKey={cat} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[350px] flex items-center justify-center text-sm text-muted-foreground">Need projects with dates and costs for trends</div>
          )}
        </div>
      </div>
    </div>
  );
}