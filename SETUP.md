# CostIQ — Local Setup (Supabase)

## 1. Create the database tables

Go to your Supabase project → **SQL Editor** → paste and run `supabase_schema.sql`.

That creates the 4 tables (projects, project_costs, cost_categories, import_logs), enables Row Level Security, and seeds default cost categories.

## 2. Install dependencies

```bash
cd costiq
npm install
```

## 3. Add the shadcn/ui components

The `src/components/ui/` folder needs to be populated. Run:

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add accordion alert alert-dialog aspect-ratio avatar badge \
  breadcrumb button calendar card carousel chart checkbox collapsible command \
  context-menu dialog drawer dropdown-menu form hover-card input input-otp label \
  menubar navigation-menu pagination popover progress radio-group resizable \
  scroll-area select separator sheet sidebar skeleton slider sonner switch table \
  tabs textarea toast toaster toggle toggle-group tooltip
```

## 4. Configure environment

Your `.env` file is already created with your Supabase URL and anon key.

## 5. Run locally

```bash
npm run dev
```

App runs at `http://localhost:5173`. Log in or register, then your data lives in Supabase.

---

## What was changed from Base44

| Area | Before | After |
|------|--------|-------|
| Database | Base44 entities | Supabase Postgres |
| Auth | Base44 auth SDK | Supabase Auth |
| Data client | `@base44/sdk` | `src/api/db.js` adapter |
| File import | AI-powered extraction | Client-side SheetJS parsing |
| AI features | Base44 InvokeLLM | Stubbed (see below) |

## Enabling AI features (Copilot + Project Insights)

Two features use an LLM: the **Copilot** chat and **Project Insights** tab.
They're currently stubbed with a placeholder message.

To enable them, create a [Supabase Edge Function](https://supabase.com/docs/guides/functions)
that proxies your OpenAI or Anthropic API call, then replace the stub in:
- `src/pages/Copilot.jsx` (line ~76)
- `src/components/projects/ProjectInsightsTab.jsx` (line ~46)

## Import spreadsheet format

The import page uses client-side parsing. Column headers are matched by name
(case-insensitive). Supported field names are shown on the Import page itself.
