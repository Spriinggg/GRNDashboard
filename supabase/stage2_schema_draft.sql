-- DRAFT, NOT APPLIED. Stage 2 of the backend plan, for Count & GRN and Food variance (the pages that have real data).
-- Read it, change it, then apply it as a migration. Nothing in the app uses these tables yet.
--
-- The idea: today every outlet-day is one JSON blob in `datasets`. Here each kind of file has its own table of plain rows, keyed so
-- that uploading the same file again replaces its rows and never doubles them, and a small rollup table holds the figures the
-- pages draw. A page then asks for a few hundred rollup rows instead of every blob.
--
-- Parsing stays in the browser: the browser sends the parsed rows through the functions at the bottom. No file leaves the machine.

-- 1. Reference data ---------------------------------------------------------------------------------------------------------
create table if not exists public.outlets (
  key        text primary key,            -- the outlet key the app already uses, for example 'AMPANG'
  name       text not null,
  area       text,
  region     text check (region in ('klang', 'north', 'south')),
  lat        double precision,
  lng        double precision,
  manager    text,                        -- Planned: no source yet
  opened_on  date
);

create table if not exists public.items (
  code     text primary key,              -- for example 'USRW00009'
  name     text not null,
  category text not null check (category in ('FOOD', 'PACKAGING')),
  uom      text
);

-- 2. One table for each kind of file ---------------------------------------------------------------------------------------
-- Every table has the outlet and the day, and a `source_file` so a row can be traced to the upload that made it.

create table if not exists public.stock_count_lines (
  outlet_key  text not null references public.outlets (key),
  day         date not null,
  item_code   text not null references public.items (code),
  system_qty  numeric not null,           -- expected close (system)
  counted_qty numeric not null,           -- counted close (physical)
  variance_qty numeric not null,
  variance_rm  numeric not null,
  source_file text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  primary key (outlet_key, day, item_code)
);

create table if not exists public.stock_movement_lines (
  outlet_key  text not null references public.outlets (key),
  day         date not null,
  item_code   text not null references public.items (code),
  qty_in      numeric not null default 0, -- received
  qty_out_pos numeric not null default 0, -- deducted by sales
  unit_cost   numeric not null default 0,
  grn_no      text,                       -- set on the IN lines that came from a GRN
  source_file text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  primary key (outlet_key, day, item_code)
) partition by range (day);               -- one partition for each month, so old months stay out of the way

create table if not exists public.grn_lines (
  outlet_key  text not null references public.outlets (key),
  day         date not null,
  grn_no      text not null,
  item_code   text not null references public.items (code),
  qty         numeric not null,
  uom         text,
  source_file text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  primary key (outlet_key, grn_no, item_code)
);

create table if not exists public.sales_daily (
  outlet_key  text not null references public.outlets (key),
  day         date not null,
  net_sales   numeric not null,
  pizzas      integer,
  units       integer,
  -- the app and delivery channels are optional and arrive in their own file
  app_sales numeric, grab_sales numeric, shopee_sales numeric, panda_sales numeric, walkin_sales numeric,
  source_file text,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  primary key (outlet_key, day)
);

-- 3. The rollup the pages read -----------------------------------------------------------------------------------------------
-- One row for each outlet and day. Rebuilt by refresh_day() after every upload, in the same transaction.
create table if not exists public.daily_outlet_checks (
  outlet_key   text not null references public.outlets (key),
  day          date not null,
  has_sales    boolean not null default false,
  has_count    boolean not null default false,
  has_movement boolean not null default false,
  has_grn      boolean not null default false,   -- a GRN file, or a GRN line in the movement
  has_pos_ded  boolean not null default false,   -- POS deductions present in the movement
  complete     boolean generated always as (has_count and has_grn and has_pos_ded) stored,
  variance_rm  numeric not null default 0,       -- net food variance of the day
  items_flagged integer not null default 0,      -- items outside +/- RM 10
  items_critical integer not null default 0,     -- items short by RM 50 or more
  refreshed_at timestamptz not null default now(),
  primary key (outlet_key, day)
);
create index if not exists daily_outlet_checks_day_idx on public.daily_outlet_checks (day);

create table if not exists public.item_variance_daily (
  outlet_key text not null references public.outlets (key),
  day        date not null,
  item_code  text not null references public.items (code),
  variance_rm numeric not null,
  primary key (outlet_key, day, item_code)
);
create index if not exists item_variance_daily_item_idx on public.item_variance_daily (item_code, day);

-- 4. Reading and writing -------------------------------------------------------------------------------------------------------
-- Pages read through plain selects (RLS: signed-in users) or these functions. Writes go through one function so the rows and
-- the rollup always change together.
--
--   select * from daily_outlet_checks where day between :from and :to and (:outlet is null or outlet_key = :outlet);
--
-- create function public.refresh_day(p_outlet text, p_day date) returns void ...   -- recompute the two rollup tables for one day
-- create function public.save_stock_count(p_outlet text, p_day date, p_lines jsonb, p_file text, p_by text) returns void ...
--   -- delete this outlet and day's lines, insert the new ones, call refresh_day. The same file twice gives the same result.
-- (the same for movement, GRN and sales)
--
-- Row Level Security, to copy to every table above:
--   alter table public.<t> enable row level security;
--   create policy "read" on public.<t> for select to authenticated using (true);
--   create policy "write" on public.<t> for insert to authenticated with check (true);
--   create policy "update" on public.<t> for update to authenticated using (true);
--   create policy "delete admin" on public.<t> for delete to authenticated using ((select public.is_admin()));
--
-- Open questions before this is applied: keep the `datasets` blobs for a while as a fallback? How do the GRN PDF lines relate to
-- the movement IN lines (the app cross-checks them today)? Are outlet keys stable enough to be a primary key?
