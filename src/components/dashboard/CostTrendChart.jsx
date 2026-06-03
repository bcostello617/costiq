import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '@/lib/costUtils';

export default function CostTrendChart({ projects }) {
  const data = projects
    .filter(p => p.completion_date && p.total_hard_cost && p.unit_count)
    .sort((a, b) => new Date(a.completion_date) - new Date(b.completion_date))
    .map(p => ({
      name: p.project_name?.substring(0, 15),
      date: new Date(p.completion_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      costPerUnit: Math.round(p.total_hard_cost / p.unit_count),
      costPerSF: p.gross_sf ? Math.round(p.total_hard_cost / p.gross_sf) : 0,
    }));

  if (!data.length) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No trend data available</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => formatCurrency(v, true)} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => '$' + v} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
          formatter={(val, name) => [formatCurrency(val), name === 'costPerUnit' ? 'Cost/Unit' : 'Cost/SF']}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Line yAxisId="left" type="monotone" dataKey="costPerUnit" name="Cost/Unit" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3 }} />
        <Line yAxisId="right" type="monotone" dataKey="costPerSF" name="Cost/SF" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}