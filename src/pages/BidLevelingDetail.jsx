import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { supabase } from '@/api/supabaseClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/costUtils';

function fmt(val) {
  if (val == null) return '—';
  return formatCurrency(val, true);
}

function fmtDelta(delta) {
  if (delta == null || delta === 0) return null;
  const abs = Math.abs(delta);
  const sign = delta > 0 ? '+' : '-';
  return `${sign}${formatCurrency(abs, true)}`;
}

export default function BidLevelingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [perUnit, setPerUnit] = useState(false);

  const { data: bid, isLoading: bidLoading } = useQuery({
    queryKey: ['bid-leveling', id],
    queryFn: () => db.BidLeveling.get(id),
  });

  const { data: lineItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['bid-line-items', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bid_line_items')
        .select('*')
        .eq('bid_id', id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  if (bidLoading || itemsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!bid) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Bid comparison not found.
      </div>
    );
  }

  const bidders  = bid.bidders || [];
  const units    = bid.unit_count || null;
  const baseline = bidders[0];
  const comparisons = bidders.slice(1);

  const totalRows = lineItems.filter(i => i.row_type === 'total');
  const lastTotal = totalRows[totalRows.length - 1];

  function getVal(item, bidder) {
    const raw = item.amounts?.[bidder];
    if (raw == null) return null;
    return perUnit && units ? raw / units : raw;
  }

  function getDelta(item, bidder) {
    const base = item.amounts?.[baseline];
    const comp = item.amounts?.[bidder];
    if (base == null || comp == null) return null;
    const delta = comp - base;
    return perUnit && units ? delta / units : delta;
  }

  // Build flat column list: [baseline, gc1, delta1, gc2, delta2, ...]
  const columns = [{ key: baseline, type: 'amount', bidder: baseline }];
  comparisons.forEach(b => {
    columns.push({ key: `${b}-amt`,   type: 'amount', bidder: b });
    columns.push({ key: `${b}-delta`, type: 'delta',  bidder: b });
  });

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/bid-leveling')}>
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{bid.project_name}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {bidders.map(b => (
                <Badge key={b} variant="secondary">{b}</Badge>
              ))}
              {units && (
                <span className="text-xs text-muted-foreground">
                  {units.toLocaleString()} units
                </span>
              )}
              {bid.bid_date && (
                <span className="text-xs text-muted-foreground">
                  {new Date(bid.bid_date).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>
        {units && (
          <Button variant="outline" size="sm" onClick={() => setPerUnit(v => !v)} className="shrink-0">
            {perUnit ? 'Show Total $' : 'Show $/Unit'}
          </Button>
        )}
      </div>

      {/* Summary cards */}
      {lastTotal && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {bidders.map((b, i) => {
            const val   = lastTotal.amounts?.[b];
            const base  = lastTotal.amounts?.[baseline];
            const delta = i === 0 || val == null || base == null ? null : val - base;
            return (
              <div
                key={b}
                className={`rounded-xl border p-4 ${i === 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
              >
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">{b}</p>
                <p className="text-lg font-bold font-mono">
                  {val != null ? fmt(perUnit && units ? val / units : val) : '—'}
                </p>
                {i !== 0 && delta != null && (
                  <p className={`text-xs mt-1 font-mono ${delta > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {fmtDelta(perUnit && units ? delta / units : delta)} vs {baseline}
                  </p>
                )}
                {i === 0 && <p className="text-xs text-muted-foreground mt-1">Baseline</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <p className="text-sm font-semibold">
            Line Item Comparison {perUnit ? '($/Unit)' : '(Total $)'}
            {baseline && (
              <span className="text-muted-foreground font-normal ml-2">
                — deltas vs. {baseline}
              </span>
            )}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card z-10">
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground w-10">#</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground min-w-[180px]">Category</th>
                {columns.map(col => (
                  <th key={col.key} className="px-3 py-2.5 text-right font-medium text-muted-foreground text-xs whitespace-nowrap">
                    {col.type === 'delta' ? `vs ${baseline}` : col.bidder}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lineItems.map((item, idx) => {
                const isTotal    = item.row_type === 'total';
                const isSubtotal = item.row_type === 'subtotal';
                return (
                  <tr
                    key={item.id || idx}
                    className={`border-b border-border/50 transition-colors ${
                      isTotal    ? 'bg-muted/60 font-bold border-t-2 border-border' :
                      isSubtotal ? 'bg-muted/30 font-semibold' :
                      'hover:bg-muted/20'
                    }`}
                  >
                    <td className="px-3 py-2 text-muted-foreground text-xs font-mono">{item.code || ''}</td>
                    <td className="px-3 py-2">{item.category}</td>
                    {columns.map(col => {
                      if (col.type === 'amount') {
                        const val = getVal(item, col.bidder);
                        return (
                          <td key={col.key} className="px-3 py-2 text-right font-mono text-xs">
                            {val != null ? fmt(val) : '—'}
                          </td>
                        );
                      }
                      const delta = getDelta(item, col.bidder);
                      if (delta == null || delta === 0) {
                        return (
                          <td key={col.key} className="px-3 py-2 text-center text-muted-foreground text-xs">—</td>
                        );
                      }
                      const over = delta > 0;
                      return (
                        <td key={col.key} className={`px-3 py-2 text-right font-mono text-xs ${over ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                          <span className="flex items-center justify-end gap-1">
                            {over
                              ? <TrendingUp className="h-3 w-3 shrink-0" />
                              : <TrendingDown className="h-3 w-3 shrink-0" />
                            }
                            {fmtDelta(delta)}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
