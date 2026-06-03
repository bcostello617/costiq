import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Search, ArrowUpDown, Eye, Pencil, Trash2, Filter } from 'lucide-react';
import { formatCurrency, formatNumber } from '@/lib/costUtils';
import ProjectForm from '@/components/projects/ProjectForm';

const statusColors = {
  'Planning': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'Pre-Construction': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Under Construction': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'Completed': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'On Hold': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export default function Projects() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortField, setSortField] = useState('project_name');
  const [sortDir, setSortDir] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editProject, setEditProject] = useState(null);
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => db.Project.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });

  const filtered = useMemo(() => {
    let result = projects.filter(p => {
      if (search && !JSON.stringify(p).toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (typeFilter !== 'all' && p.product_type !== typeFilter) return false;
      return true;
    });
    result.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      if (typeof aVal === 'number') return (aVal - bVal) * sortDir;
      return String(aVal).localeCompare(String(bVal)) * sortDir;
    });
    return result;
  }, [projects, search, statusFilter, typeFilter, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d * -1);
    else { setSortField(field); setSortDir(1); }
  };

  const productTypes = [...new Set(projects.map(p => p.product_type).filter(Boolean))];

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-screen-2xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} of {projects.length} projects</p>
        </div>
        <Dialog open={formOpen} onOpenChange={(v) => { setFormOpen(v); if (!v) setEditProject(null); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Add Project</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editProject ? 'Edit Project' : 'New Project'}</DialogTitle>
            </DialogHeader>
            <ProjectForm project={editProject} onClose={() => { setFormOpen(false); setEditProject(null); }} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="Planning">Planning</SelectItem>
            <SelectItem value="Pre-Construction">Pre-Construction</SelectItem>
            <SelectItem value="Under Construction">Under Construction</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="On Hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Product Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {productTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                {[
                  { key: 'project_name', label: 'Project' },
                  { key: 'city', label: 'Location' },
                  { key: 'product_type', label: 'Type' },
                  { key: 'unit_count', label: 'Units' },
                  { key: 'gross_sf', label: 'Gross SF' },
                  { key: 'total_hard_cost', label: 'Total Cost' },
                  { key: 'status', label: 'Status' },
                ].map(col => (
                  <th key={col.key} className="px-4 py-3 text-left font-medium text-muted-foreground cursor-pointer hover:text-foreground transition-colors" onClick={() => toggleSort(col.key)}>
                    <div className="flex items-center gap-1">
                      {col.label}
                      <ArrowUpDown className="h-3 w-3" />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <tr key={i} className="border-b border-border animate-pulse">
                    {Array(8).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded w-20" /></td>)}
                  </tr>
                ))
              ) : filtered.map(p => (
                <tr key={p.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">
                    <Link to={`/projects/${p.id}`} className="hover:text-primary transition-colors">{p.project_name}</Link>
                    {p.project_number && <span className="text-xs text-muted-foreground ml-2">#{p.project_number}</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.city}{p.state ? `, ${p.state}` : ''}</td>
                  <td className="px-4 py-3">{p.product_type || '—'}</td>
                  <td className="px-4 py-3 font-mono">{formatNumber(p.unit_count)}</td>
                  <td className="px-4 py-3 font-mono">{formatNumber(p.gross_sf)}</td>
                  <td className="px-4 py-3 font-mono font-semibold">{formatCurrency(p.total_hard_cost, true)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="secondary" className={statusColors[p.status] || ''}>{p.status || 'N/A'}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Link to={`/projects/${p.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><Eye className="h-4 w-4" /></Button>
                      </Link>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditProject(p); setFormOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isLoading && !filtered.length && (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No projects found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}