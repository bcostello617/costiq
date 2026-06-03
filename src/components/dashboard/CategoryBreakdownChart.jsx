import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '@/lib/costUtils';
import { useMemo } from 'react';

const COLORS = [
  'hsl(221, 83%, 53%)', 'hsl(32, 95%, 44%)', 'hsl(142, 71%, 45%)', 'hsl(262, 83%, 58%)',
  'hsl(0, 84%, 60%)', 'hsl(190, 80%, 45%)', 'hsl(340, 75%, 55%)', 'hsl(50, 90%, 45%)',
  'hsl(280, 60%, 50%)', 'hsl(160, 60%, 40%)', 'hsl(20, 80%, 55%)', 'hsl(200, 70%, 50%)',
];

const CustomContent = (props) => {
  const { x, y, width, height, name, value, index } = props;
  if (width < 40 || height < 30) return null;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} rx={4} opacity={0.85} stroke="hsl(var(--background))" strokeWidth={2} />
      {width > 60 && height > 40 && (
        <>
          <text x={x + 8} y={y + 18} fill="#fff" fontSize={11} fontWeight={600}>{name?.substring(0, Math.floor(width / 7))}</text>
          <text x={x + 8} y={y + 33} fill="rgba(255,255,255,0.8)" fontSize={10}>{formatCurrency(value, true)}</text>
        </>
      )}
    </g>
  );
};

export default function CategoryBreakdownChart({ costs }) {
  const data = useMemo(() => {
    const grouped = {};
    costs.forEach(c => {
      const name = c.category_name || 'Unknown';
      grouped[name] = (grouped[name] || 0) + (c.total_cost || 0);
    });
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);
  }, [costs]);

  if (!data.length) return <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">No cost data available</div>;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <Treemap data={data} dataKey="value" nameKey="name" content={<CustomContent />}>
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }}
          formatter={(val) => [formatCurrency(val), 'Total Spend']}
        />
      </Treemap>
    </ResponsiveContainer>
  );
}