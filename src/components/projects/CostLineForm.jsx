import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function CostLineForm({ projectId, project, onClose }) {
  const [form, setForm] = useState({ project_id: projectId });
  const queryClient = useQueryClient();

  const { data: categories = [] } = useQuery({
    queryKey: ['cost-categories'],
    queryFn: () => db.CostCategory.list('sort_order', 200),
  });

  const mutation = useMutation({
    mutationFn: (data) => db.ProjectCost.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-costs'] });
      onClose();
    },
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const handleCategoryChange = (catId) => {
    const cat = categories.find(c => c.id === catId);
    set('category_id', catId);
    if (cat) set('category_name', cat.category_name);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalCost = form.total_cost || 0;
    const costPerUnit = project?.unit_count ? totalCost / project.unit_count : 0;
    const costPerSF = project?.gross_sf ? totalCost / project.gross_sf : 0;
    mutation.mutate({ ...form, cost_per_unit: costPerUnit, cost_per_sf: costPerSF });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label>Category</Label>
        <Select value={form.category_id || ''} onValueChange={handleCategoryChange}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.category_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Total Cost ($)</Label>
        <Input type="number" step="0.01" value={form.total_cost || ''} onChange={e => set('total_cost', +e.target.value)} required />
      </div>
      <div className="space-y-1.5">
        <Label>Cost Date</Label>
        <Input type="date" value={form.cost_date || ''} onChange={e => set('cost_date', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label>Notes</Label>
        <Textarea value={form.notes || ''} onChange={e => set('notes', e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Adding...' : 'Add Cost'}</Button>
      </div>
    </form>
  );
}