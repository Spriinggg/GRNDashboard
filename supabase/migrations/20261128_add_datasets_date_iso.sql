-- APPLIED to the grn-dashboard project on 28 Nov 2026 (as migration add_datasets_date_iso).
-- Stage 1 of the backend plan: a real date column so a page can ask for a range of days. Additive only: nothing is changed or removed.
--
-- To undo: drop index datasets_date_idx, datasets_outlet_date_idx; alter table public.datasets drop column date_iso;
-- (the app then needs the previous data-provider.tsx, which loads every day).
alter table public.datasets add column if not exists date_iso date;

-- Fill it from the existing text date (dd/mm/yyyy). The system row (the Treeams checklist) has no date and stays null.
update public.datasets
set date_iso = to_date(date, 'DD/MM/YYYY')
where date_iso is null and date ~ '^\d{1,2}/\d{1,2}/\d{4}$';

create index if not exists datasets_outlet_date_idx on public.datasets (outlet_key, date_iso);
create index if not exists datasets_date_idx on public.datasets (date_iso);
