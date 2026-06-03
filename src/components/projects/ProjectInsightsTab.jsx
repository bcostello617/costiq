import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Brain, Loader2, Sparkles, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/costUtils';
import ReactMarkdown from 'react-markdown';

export default function ProjectInsightsTab({ project, costs, allProjects, allCosts }) {
  const [insights, setInsights] = useState(null);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const projectSummary = {
        name: project.project_name,
        city: project.city,
        state: project.state,
        product_type: project.product_type,
        construction_type: project.construction_type,
        unit_count: project.unit_count,
        gross_sf: project.gross_sf,
        site_acres: project.site_acres,
        total_hard_cost: project.total_hard_cost,
        cost_per_unit: project.unit_count ? project.total_hard_cost / project.unit_count : 0,
        cost_per_sf: project.gross_sf ? project.total_hard_cost / project.gross_sf : 0,
      };

      const costBreakdown = costs.map(c => ({
        category: c.category_name,
        total_cost: c.total_cost,
        cost_per_unit: project.unit_count ? c.total_cost / project.unit_count : 0,
      }));

      const comparables = allProjects
        .filter(p => p.id !== project.id && p.total_hard_cost && p.unit_count)
        .slice(0, 20)
        .map(p => ({
          name: p.project_name,
          product_type: p.product_type,
          construction_type: p.construction_type,
          state: p.state,
          unit_count: p.unit_count,
          cost_per_unit: p.total_hard_cost / p.unit_count,
        }));

      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
      const prompt = `You are a construction cost analyst. Analyze this project against portfolio comparables and return a JSON object with exactly these keys:
- summary: string (2-3 sentence executive summary)
- insights: array of objects with keys: title (string), description (string), type ("favorable"|"unfavorable"|"neutral"), impact ("high"|"medium"|"low")
- recommendations: array of strings (actionable recommendations)
- risk_areas: array of strings (potential risk factors)

PROJECT:
${JSON.stringify(projectSummary, null, 1)}

COST BREAKDOWN:
${JSON.stringify(costBreakdown, null, 1)}

COMPARABLES (${comparables.length} projects):
${JSON.stringify(comparables, null, 1)}

Respond with ONLY valid JSON — no markdown, no code fences.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1024,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      const data = await response.json();
      const text = data.content?.[0]?.text ?? '{}';
      return JSON.parse(text);
    },
    onSuccess: (data) => setInsights(data),
  });

  const iconMap = {
    favorable: <TrendingDown className="h-4 w-4 text-green-600" />,
    unfavorable: <TrendingUp className="h-4 w-4 text-red-500" />,
    neutral: <Sparkles className="h-4 w-4 text-blue-500" />,
  };

  return (
    <div className="space-y-6">
      {!insights && (
        <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">AI Cost Intelligence</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Generate AI-powered insights comparing this project against your portfolio benchmarks.
          </p>
          <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} size="lg">
            {generateMutation.isPending ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Insights</>}
          </Button>
        </div>
      )}

      {insights && (
        <>
          {/* Summary */}
          <div className="rounded-xl border border-border bg-gradient-to-r from-primary/5 to-accent/5 p-6">
            <div className="flex items-start gap-3">
              <Brain className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div>
                <h3 className="text-sm font-semibold mb-2">Executive Summary</h3>
                <p className="text-sm leading-relaxed">{insights.summary}</p>
              </div>
            </div>
          </div>

          {/* Insights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {insights.insights?.map((insight, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  {iconMap[insight.type] || iconMap.neutral}
                  <div>
                    <p className="text-sm font-semibold">{insight.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                    <span className={cn_impact(insight.impact)}>{insight.impact} impact</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold mb-3">Recommendations</h3>
            <ul className="space-y-2">
              {insights.recommendations?.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-primary font-bold mt-0.5">{i + 1}.</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Risk Areas */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h3 className="text-sm font-semibold">Risk Areas</h3>
            </div>
            <ul className="space-y-2">
              {insights.risk_areas?.map((risk, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-destructive">•</span>
                  <span>{risk}</span>
                </li>
              ))}
            </ul>
          </div>

          <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
            {generateMutation.isPending ? 'Regenerating...' : 'Regenerate Insights'}
          </Button>
        </>
      )}
    </div>
  );
}

function cn_impact(impact) {
  const base = "inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ";
  if (impact === 'high') return base + "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (impact === 'medium') return base + "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return base + "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
}