/**
 * Database adapter — mirrors the Base44 entity API so pages need minimal changes.
 * Usage: db.Project.list(), db.ProjectCost.filter({ project_id: id }), etc.
 */
import { supabase } from './supabaseClient';

const parseSort = (sortStr) => {
  if (!sortStr) return { column: 'created_at', ascending: false };
  const ascending = !sortStr.startsWith('-');
  const raw = sortStr.replace(/^-/, '');
  // Base44 uses 'created_date'; Supabase uses 'created_at'
  const column = raw === 'created_date' ? 'created_at' : raw;
  return { column, ascending };
};

const makeEntity = (tableName) => ({
  list: async (sortStr = '-created_date', limit = 1000) => {
    const { column, ascending } = parseSort(sortStr);
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .order(column, { ascending })
      .limit(limit);
    if (error) throw error;
    return data ?? [];
  },

  get: async (id) => {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  // filter({ field: value, field2: value2 }) — all conditions are ANDed
  filter: async (conditions) => {
    let query = supabase.from(tableName).select('*');
    for (const [key, value] of Object.entries(conditions)) {
      query = query.eq(key, value);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data ?? [];
  },

  create: async (data) => {
    const { data: created, error } = await supabase
      .from(tableName)
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return created;
  },

  update: async (id, data) => {
    const { data: updated, error } = await supabase
      .from(tableName)
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  },

  delete: async (id) => {
    const { error } = await supabase.from(tableName).delete().eq('id', id);
    if (error) throw error;
  },
});

export const db = {
  Project: makeEntity('projects'),
  ProjectCost: makeEntity('project_costs'),
  CostCategory: makeEntity('cost_categories'),
  ImportLog: makeEntity('import_logs'),
  Estimate: makeEntity('estimates'),
  BidLeveling: makeEntity('bid_leveling'),
  BidLineItem: makeEntity('bid_line_items'),
};
