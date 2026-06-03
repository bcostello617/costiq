import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';
import { formatCurrency } from '@/lib/costUtils';

export default function DistributionChart({ projects }) {
  const data = useMemo(() => {
    const values = projects
      .filter(p => p.total_hard_cost && p.unit_count)
      .map(p => p.total_hard_cost / p.unit_count);
    
    if (!values.length) return [];
    
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bucketSize = Math.ceil((max - min) / 8) || 10000;
    const buckets = {};
    
    values.forEach(v => {
      const bucket = Math.floor(v / bucketSize) * bucketSize;
      const label = formatCurrency(bucket, true) + '-' + formatCurrency(bucket + bucketSize, true);
      buckets[label] = (buckets[label] || 0) + 1;
    });

    return Object.entries(buckets).map(([range, count]) => ({ range, count }));
  }, [projects]);

  if (!data.length) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No distribution data</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="range" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
        <Bar dataKey="count" name="Projects" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}