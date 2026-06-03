import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64PDF, categories } = await req.json();
    const categoryList = (categories as string[]).join(', ');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY')!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64PDF },
            },
            {
              type: 'text',
              text: `You are analyzing a GC construction bid or hard cost budget document.

Extract every cost line item and map each one to the CLOSEST matching category from this master list:
${categoryList}

Rules:
- Match as specifically as possible — prefer granular categories over broad ones
- If a line item covers multiple categories (e.g. "Mechanical" covers both Plumbing and HVAC), split it proportionally or use the best single match
- If nothing matches, use the closest name or create a short descriptive name
- Include ALL cost line items, even small ones
- Also extract project details if visible

Return ONLY valid JSON, no markdown, no explanation:
{
  "project_name": "project name or null",
  "unit_count": 180,
  "gross_sf": 298377,
  "city": "city or null",
  "state": "state abbreviation or null",
  "product_type": "Garden/Wrap/Podium/Mid-Rise/High-Rise/Townhome or null",
  "construction_type": "Wood Frame/Steel Frame/Concrete/Hybrid or null",
  "general_contractor": "GC name or null",
  "line_items": [
    {
      "original_description": "exact description from the document",
      "category_name": "matched category from master list",
      "amount": 7429921
    }
  ]
}`,
            },
          ],
        }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Anthropic API error: ${response.status} — ${err}`);
    }

    const data = await response.json();
    const text = data.content[0].text;

    const firstBrace = text.indexOf('{');
    const lastBrace  = text.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1) throw new Error('No JSON found in response');
    const parsed = JSON.parse(text.slice(firstBrace, lastBrace + 1));

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
