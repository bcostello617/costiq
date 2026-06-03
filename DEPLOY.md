# CostIQ — Deployment Guide

## Overview
- **Frontend**: Vercel (free)
- **Backend**: Supabase (already running, free tier)
- **AI**: Anthropic API via Supabase Edge Function (key stays server-side)

---

## Step 1 — Push to GitHub

1. Go to [github.com](https://github.com) → sign in → click **New repository**
2. Name it `costiq`, set to **Private**, click **Create repository**
3. Open **Terminal** on your Mac and run:

```bash
cd "/Users/brendan/Documents/Claude/Projects/Hard Cost Database/costiq"
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/costiq.git
git push -u origin main
```
Replace `YOUR_USERNAME` with your GitHub username.

---

## Step 2 — Deploy the Supabase Edge Function

The PDF parsing runs on Supabase so your Anthropic key never touches the browser.

1. Install the Supabase CLI if you don't have it:
```bash
brew install supabase/tap/supabase
```

2. Log in and link your project:
```bash
supabase login
supabase link --project-ref nwzyfbtstuclzfwcbzpd
```

3. Set your Anthropic API key as a Supabase secret (replace with your actual key from your .env file):
```bash
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key-here
```

4. Deploy the function:
```bash
supabase functions deploy parse-pdf --no-verify-jwt
```

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → sign up with your GitHub account
2. Click **Add New → Project**
3. Import your `costiq` repo
4. Vercel auto-detects Vite. Leave all build settings as-is.
5. Under **Environment Variables**, add:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://nwzyfbtstuclzfwcbzpd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_ngbl0MOI-8GZ6bCzH-wp6w_D8-dlKTi` |

> **Do NOT add** `VITE_ANTHROPIC_API_KEY` — the key now lives in Supabase, not the browser.

6. Click **Deploy**. Vercel gives you a URL like `costiq.vercel.app`.

---

## Step 4 — Update Supabase Auth Callback

1. Go to [supabase.com](https://supabase.com) → your project → **Authentication → URL Configuration**
2. Add your Vercel URL to **Redirect URLs**:
```
https://costiq.vercel.app/**
```
3. Set **Site URL** to `https://costiq.vercel.app`

---

## Step 5 — Invite your team

Each person visits your Vercel URL and registers an account. Since RLS is set to "any authenticated user," everyone shares the same data automatically.

To restrict who can register (optional), go to Supabase → Authentication → Settings and disable "Enable email confirmations" or add an email domain allowlist.

---

## Ongoing deployments

Every time you push to GitHub (`git push`), Vercel automatically rebuilds and redeploys. No manual steps needed.

---

## Cost estimate

| Service | Cost |
|---------|------|
| Vercel | $0/month (free tier) |
| Supabase | $0/month (free tier) |
| Anthropic API | ~$0.50–$1.50 per large PDF import |

Light use (a few PDFs/week) stays well under $20/month.
