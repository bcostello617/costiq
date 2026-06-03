import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '@/api/db';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Brain, Send, Loader2, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { formatCurrency, formatNumber, getAverage, getMedian, calcCostPerUnit } from '@/lib/costUtils';

const EXAMPLE_QUESTIONS = [
  "What is the average framing cost per unit in Texas?",
  "Which trades are escalating fastest?",
  "What are the lowest cost projects?",
  "Show me a summary of my portfolio",
  "Which projects have the highest concrete costs?",
  "Compare Garden vs Wrap product types",
];

export default function Copilot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => db.Project.list('-created_date', 500),
  });

  const { data: costs = [] } = useQuery({
    queryKey: ['project-costs'],
    queryFn: () => db.ProjectCost.list('-created_date', 5000),
  });

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildContext = () => {
    const summary = projects.map(p => ({
      name: p.project_name,
      city: p.city,
      state: p.state,
      product_type: p.product_type,
      construction_type: p.construction_type,
      units: p.unit_count,
      gross_sf: p.gross_sf,
      total_cost: p.total_hard_cost,
      cost_per_unit: p.unit_count ? Math.round(p.total_hard_cost / p.unit_count) : null,
      status: p.status,
      completion: p.completion_date,
    }));

    const costSummary = {};
    costs.forEach(c => {
      if (!costSummary[c.category_name]) costSummary[c.category_name] = [];
      const proj = projects.find(p => p.id === c.project_id);
      costSummary[c.category_name].push({
        project: proj?.project_name,
        total: c.total_cost,
        per_unit: proj?.unit_count ? Math.round(c.total_cost / proj.unit_count) : null,
      });
    });

    return `PORTFOLIO DATA (${projects.length} projects):\n${JSON.stringify(summary, null, 1)}\n\nCOST DATA BY CATEGORY:\n${JSON.stringify(costSummary, null, 1)}`;
  };

  const handleSend = async (question) => {
    const q = question || input.trim();
    if (!q) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setLoading(true);

    try {
      const context = buildContext();
      const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;

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
          system: 'You are a construction cost analyst with expertise in multifamily and commercial development. Answer questions concisely using the portfolio data provided. Format numbers clearly (e.g., $125,000/unit). Use markdown for structure when helpful.',
          messages: [
            { role: 'user', content: `${context}\n\nQuestion: ${q}` }
          ],
        }),
      });

      const data = await response.json();
      const responseContent = data.content?.[0]?.text ?? 'No response received.';
      setMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] max-w-screen-lg mx-auto">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Brain className="h-16 w-16 text-primary/30 mb-6" />
            <h2 className="text-xl font-bold mb-2">CostIQ Copilot</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-md">Ask questions about your construction cost portfolio and get data-driven answers.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {EXAMPLE_QUESTIONS.map(q => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-left text-sm p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {m.role === 'assistant' && (
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                <Brain className="h-4 w-4 text-primary" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-card border border-border'
            }`}>
              {m.role === 'user' ? (
                <p className="text-sm">{m.content}</p>
              ) : (
                <ReactMarkdown className="text-sm prose prose-sm prose-slate dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {m.content}
                </ReactMarkdown>
              )}
            </div>
            {m.role === 'user' && (
              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0 mt-0.5">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Loader2 className="h-4 w-4 text-primary animate-spin" />
            </div>
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-sm text-muted-foreground">Analyzing your portfolio...</p>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card/50 backdrop-blur-sm">
        <form
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex gap-2 max-w-screen-lg mx-auto"
        >
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about your construction costs..."
            className="flex-1"
            disabled={loading}
          />
          <Button type="submit" disabled={loading || !input.trim()} size="icon">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}