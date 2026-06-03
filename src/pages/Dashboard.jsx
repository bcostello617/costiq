import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import KPICard from '@/components/shared/KPICard';
import CostTrendChart from '@/components/dashboard/CostTrendChart';
import CategoryBreakdownChart from '@/components/dashboard/CategoryBreakdownChart';
import DistributionChart from '@/components/dashboard/DistributionChart';
import { formatCurrency, formatNumber, calcCostPerUnit, calcCostPerSF, calcDuration, calcDensity, getAverage } from '@/lib/costUtils';
import { Building2, DollarSign, Ruler, Clock, MapPin, BarChart3 } from 'lucide-react';

export default function Dashboard() {
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 200),
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['project-costs'],
    queryFn: () => db.ProjectCost.list('-created_date', 5000),
  });

  const totalProjects = projects.length;
  const totalPortfolioCost = projects.reduce((sum, p) => sum + (p.total_hard_cost || 0), 0);
  
  const avgCostPerUnit = getAverage(
    projects.filter(p => p.total_hard_cost && p.unit_count).map(p => calcCostPerUnit(p.total_hard_cost, p.unit_count))
  );
  const avgCostPerSF = getAverage(
    projects.filter(p => p.total_hard_cost && p.gross_sf).map(p => calcCostPerSF(p.total_hard_cost, p.gross_sf))
  );
  const avgDuration = getAverage(
    projects.filter(p => p.start_date && p.completion_date).map(p => calcDuration(p.start_date, p.completion_date))
  );
  const avgDensity = getAverage(
    projects.filter(p => p.unit_count && p.site_acres).map(p => calcDensity(p.unit_count, p.site_acres))
  );

  return (
    <div className="p-4 lg:p-6 space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Portfolio overview and cost intelligence</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard title="Total Projects" value={totalProjects} icon={Building2} />
        <KPICard title="Portfolio Cost" value={formatCurrency(totalPortfolioCost, true)} icon={DollarSign} />
        <KPICard title="Avg Cost/Unit" value={formatCurrency(avgCostPerUnit, true)} icon={BarChart3} />
        <KPICard title="Avg Cost/SF" value={formatCurrency(avgCostPerSF)} icon={Ruler} />
        <KPICard title="Avg Duration" value={formatNumber(avgDuration) + ' mo'} icon={Clock} />
        <KPICard title="Avg Density" value={formatNumber(avgDensity, 1) + ' u/ac'} icon={MapPin} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Trends Over Time</h3>
          <CostTrendChart projects={projects} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Spend by Trade Category</h3>
          <CategoryBreakdownChart costs={costs} />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Cost Per Unit Distribution</h3>
          <DistributionChart projects={projects} />
        </div>
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold mb-4">Recent Projects</h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {projects.slice(0, 10).map(p => (
              <div key={p.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium">{p.project_name}</p>
                  <p className="text-xs text-muted-foreground">{p.city}{p.state ? `, ${p.state}` : ''} · {p.product_type || 'N/A'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatCurrency(p.total_hard_cost, true)}</p>
                  <p className="text-xs text-muted-foreground">{p.unit_count ? p.unit_count + ' units' : ''}</p>
                </div>
              </div>
            ))}
            {!projects.length && <p className="text-sm text-muted-foreground text-center py-8">No projects yet. Import data to get started.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}