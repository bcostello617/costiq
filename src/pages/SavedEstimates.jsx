import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { db } from '@/api/db';
import { formatCurrency } from '@/lib/costUtils';
import { ClipboardList, Plus, Pencil, Trash2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Re-use the calc engine for total ────────────────────────────────────────
function calcTotal(data = {}) {
  if (!data) return 0;
  const units = Number(data.total_units) || 0;
  const nrsf  = Number(data.total_nrsf)  || 0;
  const acres = Number(data.net_site_acres) || 0;

  const direct = (Number(data.direct_cost_per_nrsf) || 0) *
    (1 + (Number(data.direct_adjustment_pct) || 0) / 100) * nrsf;

  const amenity = ((Number(data.amenity_cost_per_sf) || 0) *
    (1 + (Number(data.amenity_adjustment_pct) || 0) / 100)) * (Number(data.amenity_sf) || 0);

  const sitework = ((Number(data.sitework_per_acre) || 0) *
    (1 + (Number(data.sitework_adjustment_pct) || 0) / 100)) * acres;

  const offsites = Number(data.offsites_cost)  || 0;
  const vims     = (Number(data.vims_per_unit) || 0) * units;

  const solar = (data.solar_plans || []).reduce((s, p) => {
    return s + (Number(p.units) || 0) * (Number(p.kwdc_per_unit) || 0) *
      1000 * (Number(data.solar_rate_per_w) || 0);
  }, 0);

  const gc = ((Number(data.gc_monthly_rate) || 0) *
    (1 + (Number(data.gc_adjustment_pct) || 0) / 100)) * (Number(data.gc_duration_months) || 0);

  return direct + amenity + sitework + offsites + vims + solar + gc;
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_STYLES = {
  not_started: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  completed:   'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
};
const STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  completed:   'Completed',
};

function StatusBadge({ status }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.not_started}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${
        status === 'completed' ? 'bg-green-500' :
        status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-400'
      }`} />
      {STATUS_LABELS[status] || 'Not Started'}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SavedEstimates() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [filterStatus, setFilterStatus] = useState('all');
  const [deleting, setDeleting]         = useState(null);

  const { data: estimates = [], isLoading } = useQuery({
    queryKey: ['estimates'],
    queryFn: () => db.Estimate.list('-created_at', 500),
  });

  const filtered = filterStatus === 'all'
    ? estimates
    : estimates.filter(e => e.status === filterStatus);

  async function handleDelete(e, id) {
    e.stopPropagation();
    if (!confirm('Delete this estimate? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await db.Estimate.delete(id);
      queryClient.invalidateQueries(['estimates']);
    } finally {
      setDeleting(null);
    }
  }

  async function handleStatusChange(e, est) {
    e.stopPropagation();
    await db.Estimate.update(est.id, { status: e.target.value, updated_at: new Date().toISOString() });
    queryClient.invalidateQueries(['estimates']);
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Saved Estimates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {estimates.length} estimate{estimates.length !== 1 ? 's' : ''} saved
          </p>
        </div>
        <Button onClick={() => navigate('/estimator/new')} size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Estimate
        </Button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2">
        {[
          { key: 'all',         label: 'All' },
          { key: 'not_started', label: 'Not Started' },
          { key: 'in_progress', label: 'In Progress' },
          { key: 'completed',   label: 'Completed' },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              filterStatus === f.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            {f.label}
            <span className="ml-1.5 text-xs opacity-70">
              {f.key === 'all' ? estimates.length : estimates.filter(e => e.status === f.key).length}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading estimates...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 text-center gap-3 rounded-xl border border-dashed border-border">
          <ClipboardList className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm font-medium">No estimates yet</p>
          <p className="text-xs text-muted-foreground">Create your first estimate to see it here</p>
          <Button size="sm" variant="outline" onClick={() => navigate('/estimator/new')}>
            <Plus className="h-4 w-4 mr-2" /> New Estimate
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(est => {
            const total = calcTotal(est.data);
            const units = est.data?.total_units;
            const perUnit = (total && units) ? total / Number(units) : null;
            const updatedAt = new Date(est.updated_at || est.created_at);

            return (
              <div
                key={est.id}
                onClick={() => navigate(`/estimator/${est.id}`)}
                className="rounded-xl border border-border bg-card px-5 py-4 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold truncate">{est.project_name}</h3>
                      {est.scenario_name && (
                        <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">
                          {est.scenario_name}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                      <span className="font-mono font-semibold text-foreground">{total > 0 ? formatCurrency(total) : '—'}</span>
                      {perUnit && <span>{formatCurrency(perUnit)} / unit</span>}
                      {units && <span>{Number(units).toLocaleString()} units</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <StatusBadge status={est.status} />
                    {/* Inline status changer */}
                    <select
                      value={est.status || 'not_started'}
                      onChange={e => handleStatusChange(e, est)}
                      className="h-7 px-2 rounded-md border border-input bg-card text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                    <button
                      onClick={e => { e.stopPropagation(); navigate(`/estimator/${est.id}`); }}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={e => handleDelete(e, est.id)}
                      className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                    >
                      {deleting === est.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  Last updated {updatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
