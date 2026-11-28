# US Pizza · Food Control

A daily inventory and **food-cost variance** dashboard for US Pizza outlets, modelled on the Domino's Pulse "Daily Inventory Usage" report. It reads the four daily reports an outlet already produces, joins them, and shows — for one outlet, one day — how much stock *should* have been used versus how much *actually* was, item by item.

**Live app:** https://grn-dashboard-seven.vercel.app

> Built as part of an industrial-training (LI) project. Currently live for the **Ampang** outlet; designed to scale to all 44 HQ outlets.

---

## What it does

- **Food-cost variance** — compares *ideal* usage (sales × recipe, from POS) against *actual* usage (opening + delivered − closing, from the physical count), per raw-material item.
- **GRN auto-check** — reads the goods-received note (GRN) PDF and cross-checks every item against the Stock Movement "IN" records, flagging what was received but **not** recorded in the system.
- **Daily Summary + Week-to-Date + Actual-vs-Ideal chart** — the headline numbers at a glance.
- **Drill-down** — click any item to see its full movement timeline (deliveries, POS deductions, stock-count adjustments).
- **Cloud sync** — every outlet-day is saved to Supabase, so the history is shared across devices and users.

## The four files to upload (per outlet, per day)

| File | Source | Gives |
|------|--------|-------|
| **Product Sales Listing** | POS (Zeoniq) | *Ideal* (recipe) usage |
| **Stock Count — Raw Materials (AM & PM)** | Codemax | *Physical* stock on the shelf |
| **Stock Movement — Raw Materials** | Codemax | IN (received) and OUT (sales) per item |
| **GRN — Goods Received Note** | Supplier delivery | The receiving record, cross-checked against the system |

All files are parsed **in the browser** — they are never uploaded to any server except the computed result, which is saved to the project's own Supabase.

## Roles

| Role | Can do |
|------|--------|
| **Admin** | View, upload, delete any day directly, approve/reject staff delete requests |
| **Staff** | View, upload, and *request* a delete — an admin approves before anything is removed |

Roles are set in Supabase (`profiles.role`). New sign-ups default to **Staff**.

---

## Tech

- Single-file HTML app — no build step.
- [SheetJS](https://sheetjs.com/) — parses the Excel reports.
- [pdf.js](https://mozilla.github.io/pdf.js/) — parses the GRN PDFs.
- [Supabase](https://supabase.com/) — authentication + cloud storage (Postgres + row-level security).
- Hosted on [Vercel](https://vercel.com/).

## Setup (for a fresh deployment)

1. **Supabase** — create a project. In the SQL Editor, run `supabase_auth_setup.sql` (creates the `datasets`, `profiles`, and `delete_requests` tables and their security policies).
2. Under **Authentication → Sign In / Providers → Email**, turn **off** "Confirm email" so accounts work immediately.
3. In `index.html`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY` (near the top of the `<script>` block) to your project's values.
4. **Vercel** — import the GitHub repo and deploy. Pushing to the repo auto-redeploys.
5. Create your account in the app, then make yourself an admin:
   ```sql
   insert into public.profiles (id, email, role)
   select id, email, 'admin' from auth.users where email = 'your@email.com'
   on conflict (id) do update set role = 'admin';
   ```

---

*Maintained by Amirul — US Pizza industrial training project.*
