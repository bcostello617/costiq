import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PRODUCT_TYPES = ['Garden', 'Wrap', 'Podium', 'Mid-Rise', 'High-Rise', 'Townhome', 'Mixed-Use', 'Senior Living', 'Student Housing', 'Affordable', 'Other'];
const CONSTRUCTION_TYPES = ['Wood Frame', 'Steel Frame', 'Concrete', 'Hybrid', 'Modular', 'Tilt-Wall', 'Other'];
const PODIUM_TYPES = ['None', 'Concrete Podium', 'Steel Podium', 'PT Slab', 'Other'];
const STATUSES = ['Planning', 'Pre-Construction', 'Under Construction', 'Completed', 'On Hold'];

export default function ProjectForm({ project, onClose }) {
  const [form, setForm] = useState(project || {});
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data) => project?.id
      ? db.Project.update(project.id, data)
      : db.Project.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onClose();
    },
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Project Name *</Label>
          <Input value={form.project_name || ''} onChange={e => set('project_name', e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Project Number</Label>
          <Input value={form.project_number || ''} onChange={e => set('project_number', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={form.status || ''} onValueChange={v => set('status', v)}>
            <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>City</Label>
          <Input value={form.city || ''} onChange={e => set('city', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>State</Label>
          <Input value={form.state || ''} onChange={e => set('state', e.target.value)} placeholder="e.g. TX" />
        </div>
        <div className="space-y-1.5">
          <Label>Market</Label>
          <Input value={form.market || ''} onChange={e => set('market', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Address</Label>
          <Input value={form.address || ''} onChange={e => set('address', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Product Type</Label>
          <Select value={form.product_type || ''} onValueChange={v => set('product_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{PRODUCT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Construction Type</Label>
          <Select value={form.construction_type || ''} onValueChange={v => set('construction_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{CONSTRUCTION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Podium Type</Label>
          <Select value={form.podium_type || ''} onValueChange={v => set('podium_type', v)}>
            <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>{PODIUM_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Unit Count</Label>
          <Input type="number" value={form.unit_count || ''} onChange={e => set('unit_count', +e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Building Count</Label>
          <Input type="number" value={form.building_count || ''} onChange={e => set('building_count', +e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Site Acres</Label>
          <Input type="number" step="0.01" value={form.site_acres || ''} onChange={e => set('site_acres', +e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Gross SF</Label>
          <Input type="number" value={form.gross_sf || ''} onChange={e => set('gross_sf', +e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Net Rentable SF</Label>
          <Input type="number" value={form.net_rentable_sf || ''} onChange={e => set('net_rentable_sf', +e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Total Hard Cost ($)</Label>
          <Input type="number" value={form.total_hard_cost || ''} onChange={e => set('total_hard_cost', +e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Start Date</Label>
          <Input type="date" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Completion Date</Label>
          <Input type="date" value={form.completion_date || ''} onChange={e => set('completion_date', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Developer</Label>
          <Input value={form.developer || ''} onChange={e => set('developer', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>General Contractor</Label>
          <Input value={form.general_contractor || ''} onChange={e => set('general_contractor', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Architect</Label>
          <Input value={form.architect || ''} onChange={e => set('architect', e.target.value)} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Notes</Label>
          <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={3} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : (project?.id ? 'Update' : 'Create')}
        </Button>
      </div>
    </form>
  );
}