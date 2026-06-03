import { formatCurrency, formatNumber, calcDensity, calcDuration } from '@/lib/costUtils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useMemo } from 'react';

const COLORS = ['#3b82f6','#f59e0b','#10b981','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16','#f97316','#6366f1'];

export default function ProjectOverviewTab({ project, costs }) {
  const pieData = useMemo(() => {
    return costs
      .filter(c => c.total_cost > 0)
      .sort((a, b) => b.total_cost - a.total_cost)
      .slice(0, 10)
      .map(c => ({ name: c.category_name, value: c.total_cost }));
  }, [costs]);

  const infoFields = [
    { label: 'Developer', value: project.developer },
    { label: 'General Contractor', value: project.general_contractor },
    { label: 'Architect', value: project.architect },
    { label: 'Market', value: project.market },
    { label: 'Product Type', value: project.product_type },
    { label: 'Construction Type', value: project.construction_type },
    { label: 'Podium Type', value: project.podium_type },
    { label: 'Unit Count', value: formatNumber(project.unit_count) },
    { label: 'Building Count', value: formatNumber(project.building_count) },
    { label: 'Site Acres', value: formatNumber(project.site_acres, 2) },
    { label: 'Density', value: formatNumber(calcDensity(project.unit_count, project.site_acres), 1) + ' u/ac' },
    { label: 'Gross SF', value: formatNumber(project.gross_sf) },
    { label: 'Net Rentable SF', value: formatNumber(project.net_rentable_sf) },
    { label: 'Start Date', value: project.start_date },
    { label: 'Completion Date', value: project.completion_date },
    { label: 'Duration', value: formatNumber(calcDuration(project.start_date, project.completion_date)) + ' months' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Project Info */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Project Information</h3>
        <div className="grid grid-cols-2 gap-3">
          {infoFields.map(f => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className="text-sm font-medium mt-0.5">{f.value || '—'}</p>
            </div>
          ))}
        </div>
        {project.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">Notes</p>
            <p className="text-sm">{project.notes}</p>
          </div>
        )}
      </div>

      {/* Cost Breakdown Pie */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="text-sm font-semibold mb-4">Cost Distribution (Top 10)</h3>
        {pieData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name?.substring(0, 12)} ${(percent*100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={v => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">No cost data yet</div>
        )}
      </div>
    </div>
  );
}