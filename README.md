# US Pizza Food Control

Next.js (App Router, TypeScript) dashboard for daily inventory and food cost variance. Excel files are parsed in the browser and the results are saved to Supabase (`datasets` table).

## Run

```bash
npm install
cp .env.example .env.local   # then fill in the two values
npm run dev                  # http://localhost:3000
npm run build && npm start   # production
```

## Environment variables

| Name | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API > anon public key |

`NEXT_PUBLIC_` values are bundled into the browser by design, so the anon key is only safe when Row Level Security is on for `datasets`. Never put the `service_role` key in a `NEXT_PUBLIC_` variable or commit `.env.local`.

## Structure

Same stack and patterns as Provena: Next.js App Router, Tailwind 4, shadcn/Base UI, lucide icons, Recharts and a Leaflet map.

- `src/app/` routes: Dashboard, Food variance (`?st=` and `?cat=` filters), Count & GRN, Outlets (map and list), Upload.
- `src/components/` shell (sidebar, top bar), data provider (state and Supabase sync), charts, outlet map, item detail sheet, `ui/` primitives.
- `src/lib/` Excel parsing, variance and food cost maths, outlet locations, Supabase client, sample data.
- `index.html` is the earlier single-file version, kept for reference.

Design follows the Provena design guide (DESIGN.md) with a US Pizza theme: warm cream neutrals in `src/app/globals.css`, blue as the brand and "okay" colour, green, yellow and red for status only. Outlet pins on the map are approximate positions in `src/lib/outlet-locations.ts`.

## How data is loaded (stage 1)

Files are parsed in the browser and each outlet-day is saved as one JSON row in `datasets`. The app does **not** pull every saved day when it opens:

1. It reads an **index** of what is saved (`id`, `outlet_key`, `date_iso`, no data). This gives the first and last day and the number of days for each outlet.
2. It then loads the **latest week** as one range query, the **latest day of each outlet** (so Outlets is right for an outlet that has not uploaded this week) and the Treeams row.
3. A page that needs other dates calls `ensureRange(span)` from `useData()`. Only the days not loaded yet are fetched: by id when there are few, as one date-range query when there are many.
4. Upload loads every saved day before it reads a file, so a day is never saved over with only part of what it had. This goes away in stage 2, where each kind of file has its own rows.

`date_iso` was added by `supabase/migrations/20261128_add_datasets_date_iso.sql`. `supabase/stage2_schema_draft.sql` is a **draft, not applied**, for plain tables per file type and a rollup the pages read.

## CI and deployment

`.github/workflows/ci.yml` runs on every push to `main` and every pull request into `main`.

1. **check** (always): `npm ci`, `npm run typecheck`, `npm run build` on Node 22. The Supabase values are optional here; without them the app builds in local-only mode, which proves it compiles.
2. **deploy** (only when the Vercel secrets exist): a **preview** deployment for a pull request and a **production** deployment for a push to `main`, with the Vercel CLI. The deployment URL is written to the run summary. Pull requests from forks never deploy, because they cannot read secrets.

### One-time setup

| Where | What |
|---|---|
| Vercel project, Settings, General | **Framework Preset: Next.js** (the project was a static `index.html`, so it may still say Other) |
| Vercel project, Settings, Environment Variables | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` for Production and Preview. These are the same public values the old `index.html` had inside it. Never the `service_role` key |
| GitHub repo, Settings, Secrets and variables, Actions | `VERCEL_TOKEN` (Vercel, Account Settings, Tokens), `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` (both in `.vercel/project.json` after running `npx vercel link` once locally; do not commit that folder) |
| GitHub repo, optional secrets | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, only if you want the CI build to use them |
| GitHub repo, Settings, Branches | Protect `main` and require the **Type check and build** check before merging |

**Do not deploy twice.** If the Vercel project is also connected to this repository through Vercel's Git integration, every push is deployed by both Vercel and this workflow. Use one: keep the Git integration and delete the `deploy` job, or keep the job and turn the Git integration off (Vercel project, Settings, Git, Ignored Build Step, or `"git": { "deploymentEnabled": false }` in `vercel.json`).

### Merging into `main`

`main` still has the single-file `index.html`. Merge `main` into the branch first, resolve `index.html` by deleting it (the latest copy of main's file is kept in `reference/main-latest/`), run the checks, then open the pull request.
