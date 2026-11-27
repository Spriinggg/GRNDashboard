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
