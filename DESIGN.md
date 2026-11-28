# US Pizza Food Control design guide

Last updated: 27 November 2026. This guide describes the interface of `GRNDashboard` and the rules that new work should follow. It is adapted from the Provena design guide (`CAPSTONE/provena-web/DESIGN.md`). The structure, components and rules are shared with Provena. **The colour theme is not: US Pizza keeps its own red theme.** Section 2 says what is different and why.

Each rule is marked **Built** (the code does it) or **Target** (agreed, not fully done). Section 9 lists the gaps.

## 1. What the app should feel like

A work tool for people who check food cost, stock and sales across 44 outlets. It should be calm, plain and quick to scan.

- **Evidence first.** Every flag shows the numbers behind it.
- **One signal per item.** A row has one status. Extra detail is plain grey text.
- **Words and icons together.** A status is never colour alone.
- **No decoration.** No gradients on content, no glow, no icons that only fill space. The one exception is the soft page background (6.8).
- **Honest about sample data.** Pages built on sample figures say so once (6.9).

## 2. Colour (Built)

**Theme: US Pizza red on warm cream.** This is a decision, not a leftover. The brand is red, and the app keeps it. Everything else follows Provena.

Tokens live in `src/app/globals.css` as CSS variables, written in OKLCH, and are exposed to Tailwind (`bg-primary`, `text-danger`). Never write a raw colour in a component. The only hex values allowed are the platform colours in 6.7.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `oklch(0.974 0.012 85)` | `oklch(0.19 0.02 60)` | Page background (warm cream) |
| `--foreground` | `oklch(0.25 0.02 60)` | `oklch(0.95 0.01 60)` | Main text |
| `--card` | `oklch(1 0 0)` | `oklch(0.235 0.022 60)` | Card, sheet and input surface |
| `--primary` | `oklch(0.55 0.22 27)` | `oklch(0.66 0.2 27)` | Brand red: main actions, active item, selected, chart highlight |
| `--success` | `oklch(0.52 0.15 150)` | `oklch(0.72 0.2 150)` | Green: on target, done, matched |
| `--warning` | `oklch(0.8 0.17 90)` | `oklch(0.84 0.17 92)` | Yellow: needs attention. Dots, bars and icons only |
| `--danger` | `oklch(0.56 0.24 27)` | `oklch(0.66 0.23 25)` | Red: a problem, short stock, over ideal |
| `--muted-foreground` | `oklch(0.48 0.015 65)` | `oklch(0.708 0 0)` | Secondary text |
| `--border` | `oklch(0.915 0.012 85)` | `oklch(1 0 0 / 10%)` | Hairlines |
| `--*-soft` | pale tints | deep tints | Tinted boxes. Not for status text |

The sidebar has its own `--sidebar*` tokens in the same red and cream.

### What each colour means

| Colour | Meaning | Examples |
|---|---|---|
| Red | A problem | Critical item, food cost over ideal by more than 2 points, a failed check |
| Yellow | Needs attention soon | Short item, food cost over ideal, missing file |
| Green | On target, done | Item within RM 10, GRN posted, all files loaded |
| Grey | Neutral | Secondary text, no data yet, other series in a chart |
| Brand red | Brand and "this is the one" | Primary button, active menu item, the leading bar or line |

### The red caution (read this before using red)

In Provena the brand is blue, so brand and danger can never be confused. Here the brand red and the danger red are almost the same colour (`0.55 0.22 27` and `0.56 0.24 27`). To stop the screen shouting, these rules apply on top of Provena's:

1. **Brand red marks one thing at a time.** A single leading bar, the selected item, the active line. If every bar is brand red, the page reads as an alarm.
2. **A status is never shown by brand red alone.** A problem always has its word beside it, and its meaning comes from the table above, not from the colour.
3. **Grey is the default for "the rest".** Charts with many series use grey for all but the one that matters (6.7).
4. Green, yellow and danger red mean status and nothing else, as in Provena. Yellow is never text.

### Rules

1. Status colours are used without a tinted pill background.
2. **Yellow is never used as text** (about 1.9 to 1 on white). The word stays in the normal text colour and only the dot, bar or icon is yellow.
3. Use danger red sparingly. A headline figure stays in the normal text colour and the red goes on the row or bar that carries the problem.
4. Both themes must work. Use tokens so dark mode follows.
5. Contrast of the red primary and danger as text has not been measured in this app yet (section 9). Provena measured its own colours, not these.

## 3. Typography (Built)

Plus Jakarta Sans for everything and Bricolage Grotesque (`font-display`) for page titles and the clock. Numbers in columns use `tabular-nums`. Sizes: 12 px for meta and helper text, 14 px for body, table cells and buttons, 16 px for card titles (weight 600), 24 to 30 px for the page title, 40 px for the single hero figure. Do not add other fixed pixel sizes. Inputs are 16 px on small screens.

## 4. Layout and spacing (Built)

Page container `max-w-[1440px]`, side padding 16 px (24 px from `md`), gap between blocks 20 px, card padding 24 px (table cards have none and give their toolbar 16 px). Sidebar 16 rem open, 3 rem folded. No sideways page scroll at any width: a wide table scrolls inside its own box.

## 5. Shape and depth (Built)

Base radius `0.875rem`. Buttons and inputs `rounded-lg`, cards `rounded-xl` with `shadow-sm`. Nothing else has a shadow except menus. The dashboard hero is the only solid brand-red block.

## 6. Components and patterns

### 6.1 Page header (Built)
Title, one sentence of subtitle and the live clock at the right.

### 6.2 Status indicator (Built)
Plain coloured text with no background. Only a warning or danger status also gets an icon. Calm statuses are coloured text only.

### 6.3 Tables (Built on Outlets, Variance, Count & GRN and Sales)
Every table or list has four things: **search**, **filter**, **sorting** and **pagination**. Build them with `FilterSelect`, `useTableView`, `SortHead` and `TablePagination`. Pass `resetKey` with every filter value so the page returns to 1. A result line sits above the table ("44 outlets · RM 4,666,947 · matching “ka”") as an `aria-live` region with "Clear filters" at its right when anything narrows the list.

**The table has its own toolbar (Built, both Sales tables, 27 Nov 2026).** Every table carries its own search box and boxed filters in its card, above the result line, even when the page has filters at the top. The two work together: the filters at the head of the page change the figures, charts and table, and the table toolbar narrows only the table (the result line says "in this table matching …"). Pick filters that belong to the table: for All outlets, food cost, change and against average; for Outlet by channel, which channel leads and how much of the sales comes from delivery. Chips for what is on, with "Clear all", sit under the toolbar. A total row at the top of a table follows the table filters.

**No chevron on rows.** A clickable row has the pointer cursor, a hover colour and a button for the name. Say "click a row to open it" in the result line.

### 6.4 Filter bar (Built, Outlets and Sales)
One card holds the filters: a search box and boxed `FilterSelect` dropdowns on one row, an optional extra row (the channel toggles on Sales by channel), then a chip for every filter that is on with "Clear all". Never use a native `<select>`. The shared pieces are in `src/components/sales-ui.tsx` (`FilterBar`, `FilterSearch`, `Chip`) and `filter-select.tsx`.

### 6.5 Drill-down (Built, Sales by outlet)
A chart can open the next level when a bar is clicked: all outlets, then one outlet by month, then a month by day, then a day by hour. Rules:
- A breadcrumb shows the path and every earlier step is a button. A Back button and the Escape key go up one level.
- The bars, the Top 10 list and the table rows all open the same next level.
- The last level is not clickable and says so.
- Filters apply to the all-outlet level. Deeper levels keep only the measure.
- **Do not make a person scroll through a long chart (27 Nov 2026).** The all-outlet level has no 44-bar chart. Its list is the table: ten outlets a page, with a bar column drawn against the biggest outlet, so the table is also the chart. The Top 10 list and its line chart sit above it in one card. The months, days and hours of one outlet are short, so they keep a chart and show on one page.
- **Two related blocks share one card with a hairline between them** (Top 10 list and line chart) and stack with a bottom border on a phone. Do not use two cards side by side for one idea.

### 6.6 KPI strip (Built)
Summary figures use the one strip from Food variance (`Kpis` in `src/components/kpi-strip.tsx`): one card, figures divided by hairlines, a big number and a short phrase, with the detail in the hover hint. Do not build a row of separate KPI cards. The Sales pages use `columns={4}` and `stacked`, which puts the phrase under a 30 px number so a long figure such as "RM 4,666,947" fits. Only a figure that needs a person gets a colour (`tone`).

### 6.7 Charts (Built)
Recharts. Axis text is grey, the grid is a hairline, every chart has a text description for screen readers and a tooltip.

- **Calm colour.** Use brand red for the one thing that matters and grey for the rest. The Top 10 line chart draws the leader and the outlet under the pointer in red and the other nine in grey. Fee parts are one hue in three strengths.
- **Platform colours are allowed** where a series is a delivery platform, so people recognise it: GrabFood green, ShopeeFood orange, FoodPanda pink. Walk-in is grey and the US Pizza app is brand red. No other chart may use them, and a platform colour never means a status. They are defined once in `src/lib/channel-mock.ts`.
- **Channel logos (Built, 27 Nov 2026).** A channel is shown by its real logo (`ChannelLogo` in `src/components/channel-parts.tsx`): the US Pizza app uses the US Pizza logo (`public/logo.svg`), the POS channel uses the Zeoniq logo, and GrabFood, ShopeeFood and FoodPanda use their own. **Logos have no background.** In light mode they sit straight on the page. In dark mode, where the logos (drawn for a light page) would not read, they sit on a white tile. The files are in `public/logos/` (sources and names in the README there). Zeoniq is a small transparent PNG until a vector file is supplied, and ShopeeFood uses the Shopee wordmark because there is no separate ShopeeFood file. If a file is missing the logo is replaced by a colour dot and the name, so a page never shows a broken image. Logos appear in the channel list, the best-outlet headings, the channel filter chips (and the chips that show what is on) and the "biggest channel" figure, not in every axis label. A logo that already spells the name is shown alone. The US Pizza emblem does not spell a name and is easy to mistake for a red swatch at a small size, so `ChannelLogo` writes the word "App" next to it everywhere (chips, legends, tooltips, table headings and the pie label). Pass `showName={false}` only where the name is already written beside the logo, as in the biggest-channel figure and the pie panel. Give a logo an explicit height (not a max height), or a flex row may measure it too narrow and let the word spill out of a chip. A channel that is switched off in the filter goes grey.
- **Share of a whole is a large ring (Built, Sales by channel).** Each slice is labelled with the channel's logo and its percentage just outside the ring, so the logos are the legend. The total is in the middle. **Details never float over the ring.** Pointing at a slice fills a fixed panel under the ring with the channel's logo and name, the figure, its share, the change against the period before and the average order, so it stays readable and does not cover the chart. A click focuses the channel everywhere on the page. The ring is not animated, so the logos are always there. Use a ring only for a few parts that add up to a whole.
- **A channel is always shown by its logo (27 Nov 2026).** This holds for tooltips, legends and table headings too, not only in the main chart: the tooltip of every chart that splits by channel lists each channel with its colour swatch and logo, the legend under a chart is the swatch followed by the logo, and the column headings of a table by channel are logos (`SortHead` takes a `node`, with the words kept as its accessible name).
- **A time chart can be read at two levels (Built, channel mix).** The mix chart shows each month of the year. Click a month, or choose it in the View menu, to see the same chart day by day. A "Year" button goes back. The unit is the same (sales per day) at both levels so the two can be compared.
- **Do not pack detail into a dense table (27 Nov 2026).** A fee table with six columns and eight rows read as information overload and was replaced. Show the shape first and put the figures in a tooltip or on the next click.
- **Fees are two linked views (Built, "What the platforms take"; replaced on 28 Nov 2026 by the derivation in 6.22, which keeps the fee types and adds the steps above them).** Left: one bar per channel, drawn to the channel's fee rate and split by fee type (commission, advertising, platform or service fee, payment gateway, adjustments or credits), with the rate and the ringgit beside it. Right: a waterfall that goes from the channel's net sales down through each fee to what is left. Click a channel on the left to follow its sales on the right (the first row is all channels). The exact figures, the share of net sales and the share of all fees are in the waterfall tooltip.
- **Drill-down by channel (Built, "Best outlets for each channel").** The idea is a Tableau dashboard: choose, click, open. Pick a channel (or All) with the logo chips to filter, then the chart shows the top or bottom 10 outlets, split by channel when All is chosen. Click an outlet to see its months by channel, and a month to see its days. A breadcrumb and a Back button go up a level, and the tooltip lists each channel's figure and share. Use the same pattern, filter first then click to open, for any new "best of" chart.
- **Every chart has a legend** (a short row under it, a swatch drawn like the mark and a plain word). A list beside the chart that names every mark counts.
- A bar or line chart does not decorate: no gradients, no 3D, no glow.
- **Positive is green and negative is red (rule from the user, 28 Nov 2026).** Every signed figure takes its colour from its sign: food variance in ringgit, an item's variance, the change against the period before. Zero keeps the normal colour. Use `signTone(n)` from `src/lib/calc.ts`. The word or arrow stays beside the figure so colour is never the only sign, and yellow is still never text. This replaces the earlier rule that a rise is grey and only a drop is red. Not yet applied to cost lines on Profit & loss where a rise is bad (fees, cost of food): those need a decision, because green for a rising cost would mislead. A food cost figure still gets a dot only when it is off target.

### 6.8 Page background (Built)
A faint top-to-bottom tint of the brand colour that fades out within 420 px. It is the only gradient.

### 6.9 Sample-data marker (Built)
Pages that are built on generated figures carry one small "Sample data" marker beside the subtitle and no other note. Real data never carries it. Remove the marker when the page reads from Supabase.

### 6.15 Outlet map (Built, 28 Nov 2026)
The map card is shared by Outlets, Count & GRN and the Dashboard (`src/components/outlet-map.tsx`). **Every outlet is a pin with the US Pizza logo** (`public/logo.svg`) on a white tile, so it reads on the red selected pin and in dark mode. An outlet with data adds its name and figure beside the logo and a red edge when it has a problem. An outlet with no data is the logo alone in grey. A pin never relies on colour only, because the name and figure carry the status.

- **Pins shrink when zoomed out** (far under zoom 12, mid to 13, near from 14) because 44 outlets sit close together in the Klang Valley. A pin with a figure and the chosen outlet are drawn above the plain ones, and any pin rises when pointed at.
- **Search box** in the card header: type a name, pick with the mouse or arrow keys and Enter, and the map flies to the outlet and chooses it. Outlets with no data say so in the list.
- **Escape** clears the chosen outlet on pages where the choice can be let go (Outlets, Count & GRN). The first Escape clears typed search text. It does nothing while a dialog or sheet is open.

### 6.23 Food variance, one outlet and one day (Restored, 28 Nov 2026)
`/variance/day`, the original view of this app, brought back before merging into `main` because the redesign had left it out. It reads the **real files** and is reached from the sidebar: Food variance now opens into **All outlets** (the network view, still sample data) and **One outlet and day** (this page, with the number of items that need checking as a badge).

- **Outlet and day** are chosen in the top bar, the same selectors as Count & GRN. The filters (status and category) live in the address (`?st=crit`, `?cat=FOOD`), so a filtered view can be shared as a link.
- **Summary strip:** items that need checking, critical items (short by RM 50 or more) and items on target (within RM 10). Each is a button that filters the table.
- **The day:** the day's food variance in ringgit (green if positive, red if negative), food only, total shortfall and sales, then a bar chart of the biggest variances. Click a bar to open the item. Next to it, **food cost against the ideal**, today and week to date. It needs the sales file and the stock movement file, and says so when one is missing.
- **Items table** with search, status and category filters, sorting and paging. Click an item (or its name) to open the **item detail**: expected against counted, and the movement timeline of the day (received, deducted by sales, stock count adjustments).
- The network page links to this one, and this one is what main's `index.html` showed on its Overview and Food Variance pages.

### 6.22 Sales: from gross sales to net settlement (Built on sample data, 28 Nov 2026)
Both Sales pages now show what the September 2026 sales dashboard shows for each channel, in one path: **Gross sales, less Discount, = Net sales, plus Service charge and SST, = Collected sales, less Commission and fees, = Net settlement**, and **% kept** (net settlement as a share of gross sales). `src/components/derivation-explorer.tsx` draws it and `src/lib/channel-mock.ts` builds it.

- **Net sales stays the figure for the whole app**, and is labelled "before SST and service charge". Collected is what the customers paid. **Service charge and SST are collected for others, so they are not income** and stay out of Profit & loss, which starts from net sales. (Confirm with finance.)
- **Sales by channel.** The old "What the platforms take" card is replaced by one card with two parts. Left: a list of the channels with the share of every ringgit of gross that is kept (All channels first). Click one to follow it. Right: the waterfall of that channel, **drawn top to bottom with the step name on the left**, so ten steps never crowd each other whatever the width (a first version with the names along the bottom overlapped, and was changed on 28 Nov 2026). Amounts read as 4.41m or 579k, never 4407k. The waterfall has one step each for gross, discount, net sales, service charge, SST, collected, each fee that applies and net settlement. Net settlement is the one brand red bar. A tooltip gives the amount, its share of gross and of net sales, and of all fees. **"Full table, every channel side by side"** opens below it with the whole derivation and % kept. The fourth summary figure is now **net settlement and the share of gross kept**.
- **Sales by outlet.** The Measure choices are Net sales, Gross sales, Discount, Service charge, SST, Collected sales and Pizzas. A derived measure is the net sales row times that outlet's ratio for the same days (`derivedRatio`), so the **totals match the Sales by channel page to the ringgit** (checked for September to date: gross RM 5,971,103, discount RM 1,304,156, service charge RM 35,035, SST RM 275,491, collected RM 4,977,473). The same card sits under the chart at every level (all outlets, one outlet, a month, a day) and is about what the page shows now. At hour level a derived measure uses the day's own ratio until an hourly report exists.
- **Rates are set from the September dashboard** so the sample has the real shape. Discount as a share of gross: POS 22.9%, Grab 18.7%, FoodPanda 22.6%, Shopee 31.6%, app 6.2%. SST is about 6% of net sales (FoodPanda 5.3%). Service charge only on POS (1.0% of net) and the app (2.6%). Fees as a share of net sales: Grab commission 31.1%, advertising 9.2%, platform fee 1.3%, adjustments 0.2%; FoodPanda 18.9%, 11.3%, 0.5%, 1.8%; Shopee commission 4.7% only; the app has no fees. Kept comes out at Grab 52%, FoodPanda 56%, Shopee 69%, app 102%, POS 83%. The app reads above 100% because it adds the service charge and SST it collects and pays no fee.
- **Not here yet:** the real files (POS, Grab, Shopee, FoodPanda, app, GRN summary) and the outlet mapping. Shopee fees look incomplete in the September export (commission only). Gross profit stays on Profit & loss.

### 6.21 Messages, dialogs, loading and errors (Built, 28 Nov 2026)
The person must always know what the app is doing and what happened. Two tools, each with one job, in `src/lib/notify.ts`. **Never use `window.confirm`, `alert` or a failure that is only in the console.**

- **Toast (shadcn's Sonner, `src/components/ui/sonner.tsx`)** for something that happened and needs no answer: files added, saved, deleted, request sent, back online, or a small failure. Bottom right, so it never covers the top bar. Only the icon carries the status colour (green, yellow, red, brand red for information) and the card follows the theme. A message is short and the detail goes in the description.
- **Dialog (SweetAlert2)** only when the person must **decide** (`confirmDialog`: delete a day, clear all data, ask an admin to delete) or must **read and act** on a failure (`errorDialog`). A delete dialog has Cancel focused, so Enter is safe, and the button is red. A failure dialog can list items (for example each file that could not be read, with its reason) and ends with a small technical line for whoever helps. SweetAlert2 is drawn with the app's tokens, so it follows light and dark, with no stock button styles.
- **Loading while files are read.** Reading never leaves the person guessing. A loading toast and a panel on the Upload page show "Reading file 2 of 5" with the file name, a progress bar, "Saving to Supabase" as a second step, and "Please keep this page open". Every Upload files button and drop zone is disabled meanwhile, and a second upload is refused politely. The result replaces the loading toast: success ("5 files added, 3 outlet days saved"), a warning with a "See which" button (some files could not be read), or a dialog (none could be read, or the files were read but not saved to Supabase).
- **Errors say what happened, why and what to do** (`describeError`). A failure is turned into plain words by its kind: offline, cannot reach the server, session ended (401), no permission (403 or code 42501), **not found (404)**, already exists (409), too many requests (429) and a server problem (5xx), each with a next step, and the technical line (HTTP status, code, message) kept apart for whoever helps. `reportError` logs it and shows a toast, or a dialog when `dialog` is set. Failed saves, loads, deletes, delete requests and rejections all go through it.
- **Whole-app events** (`system-notices.tsx`): losing the internet shows a lasting "You are offline" toast and "Back online" when it returns. A promise nobody handled shows a toast instead of the page quietly not working.
- **Pages for a broken address or page.** `not-found.tsx` is the **404 page** (HTTP status 404, inside the normal layout so the menu stays). `error.tsx` is shown when a page breaks while drawing: it says the data is safe, has Try again and a link to the Dashboard, and keeps the technical details in a closed section. `global-error.tsx` is the last net when the layout itself fails.
- Still to do: the sign-in form keeps its own inline message.

### 6.20 Upload data page (Built, 28 Nov 2026)
`/upload` is a **work page, so it has no charts**: its job is to get files in and show that they went in. A chart would compete with the upload buttons and tell nothing the table does not. The only "figure" on each card is a line of words.

- **Six source cards**, each with the **logo of the system the file comes from**: POS sales (Zeoniq), Stock count, Stock movement and GRN (Codemax), Sales by channel (the US Pizza App, GrabFood, ShopeeFood and foodpanda logos) and Checklists (TreeAMS). Logos follow the channel logo rule (6.7): no background in light mode, a white tile in dark mode (`SourceLogo`, `src/components/source-logo.tsx`). Files are in `public/logos/` (`codemax.png`, `treeams.png`).
- **Every card has an Upload files button** and is also a drop target. The button opens the file picker for that card's file types. The page still detects each file by its content, so a file dropped on the wrong card is read correctly.
- Each card says **Required** or **Optional** (the four required files for one outlet and date make a day complete), how many days are loaded and the latest day, and the files added during this visit.
- **Data for each day is a table**, one row for each outlet and day, newest first: day, outlet, then POS sales, Channels, Stock count, Movement and GRN as **Loaded** or **Missing** (the four required ones are yellow with an icon when missing, Channels says **None** in grey because it is optional), items counted, who uploaded and when, and Delete (admin) or Request delete (staff). It has search, a days filter (all, something missing, complete), the date picker, sorting, paging and chips. Hover an outlet to see the files that made the day.
- Load sample day and Clear all data (admin) stay under the cards. The old list of days (`data-list.tsx`) is removed.
- Checklists are counted by outlet because the Treeams report has no day. The GRN column means a GRN file is loaded, which is not the same as the GRN check on Count & GRN (that reads the stock movement).

### 6.19 Count & GRN charts (Built, 28 Nov 2026)
Three charts between the summary and the filter card, drawn from the real files. They use the same days as the summary figures (the outlet and dates chosen) and are **not narrowed by their own choice**, so the bar, column or square picked stays in view. Each one **filters the table below** and adds a removable chip in the filter card: click again, remove the chip or use Clear all to let go.

- **What went missing, day by day.** One column for each day, stacked by the checks that were missing across the outlets (stock count and POS deductions in grey, GRN in yellow). A tall column is a bad day. Click a column to show only that day ("Day: 14 Nov").
- **Which check is weakest.** A bar for each check with the days it was done out of the days loaded. Done every day is green, anything less is yellow. Click a bar to show the days where that check is missing ("Missing: GRN").
- **Outlets by day.** A row for each outlet (the 12 with the most gaps, and the note says so when there are more) and a column for each day. A tick on green is every check done, an exclamation mark on yellow is something missing, an empty square is no file. Details are in a fixed line under the grid. Click a name to look at that outlet. Click a square to open that outlet and day in the table.
- Column clicks read the position of the column (`activeTooltipIndex`) because Recharts 3 no longer gives the payload.
- Not built yet: a ranking of outlets by days missing (it needs more than one outlet) and any trend longer than the days loaded.
- The header's Outlet and Day selectors (ScopeBar) now scroll inside their own box on a phone instead of widening the page.

### 6.18 Top bar (Built, 28 Nov 2026)
From left to right on the right-hand side: **cloud status, alerts bell, account menu.** The separate light, dark and system buttons are gone.

- **Cloud status** (`cloud-status.tsx`) is one small pill: the **Supabase mark** and one word (Synced, Saved, Syncing, Local or Error). The mark is Supabase green when connected and grey when the app works only on this computer, and it pulses softly while syncing. Error is the only state with a coloured word (red). On a phone only the mark shows, and the words stay in the tooltip and for screen readers. The mark is drawn inline from the public Supabase logo shape.
- **Alerts bell** (`alerts-menu.tsx`, `use-alerts.ts`). A number on the bell counts the alerts that need a look, in red when one is serious. The menu lists each alert as a dot for how serious it is, a short sentence and a line of detail, and each one is a link to the page where it can be dealt with. The scope is fixed and written in the menu header: **all outlets, month to date**, whatever the Dashboard filters are. Alerts are worked out a moment after the page is shown. The shortages, margin, labour and checklist alerts come from sample data until those reports are loaded. The same alerts used to be a strip on the Dashboard.
- **Account menu** (`user-menu.tsx`). Name, role, **Theme** (System, Light, Dark, with a tick on the one in use) and Sign out. System follows the device.

### 6.17 Dashboard overview (Built, 28 Nov 2026)
`/`, rebuilt from a one-outlet, one-day food variance view into **an overview of every page** for the dates and outlets chosen. The old page is kept at `reference/dashboard-real-data-page.tsx.txt`. Figures come from `src/lib/dashboard-data.ts`, which reads the same sample builders as each page so a figure agrees with the page it links to.

- **Filter card with the dates under it.** The first row is a search box and region. **Under it, in the same card, is the date picker**: the calendar range picker (`DateRangeFilter`) beside quick choices (Last 7 days, Month to date, October). The picker covers 1 Sep to the latest day, which is the span the sample builders can draw quickly. Clearing it goes back to month to date. A custom range says "Custom dates, N days" and presses no quick choice. The summary line names the outlets, the dates and **the dates they are compared with** (the same number of days just before).
- **Needs attention moved to the bell in the top bar** (6.18), so it is the same on every page and the Dashboard keeps its space for charts.
- **The outlet map is on the Dashboard** and is the main filter. Every one of the 44 outlets is a pin with the US Pizza logo and the figure chosen with the switch above the map: net sales, food short, labour or checklists. A pin is red-edged when it is over the labour target, under the checklist target or short more than 1.25 times the network average. An outlet the search or region leaves out, or that is not open yet, is a small grey logo. **Click a pin (or use the map search) and every card becomes about that outlet**, with a chip "Outlet: name" in the filter card. Click it again, remove the chip or press Escape to show all. Zoomed out, pins drop their name and keep the logo and figure.
- **Each page has a card with a chart you can read and click.** Point at a mark for its figure in a tooltip and click it to open the page behind it. Every card also has a link at the foot ("Open sales by outlet") and its title is a link, so nothing depends on finding the chart. Sales by outlet: a daily area chart with the top three outlets. Sales by channel: a ring with the channels' logos (point at a slice or a name and the middle shows that part, so nothing floats over the ring). Profit & loss: a waterfall from net sales to gross profit. Food variance: bars of the items short most. Count & GRN: bars for the three checks. Outlets: a ring of the statuses. Labour vs sales: a daily line against the target. Treeams: bars by checklist against the 90% target. Upload data: rows only, because it is a count and a date. Cards on generated figures carry the Sample data marker. Count & GRN, Outlets and Upload data use the real files: Count & GRN and Upload data follow the dates, Outlets uses each outlet's latest loaded day. Clicking a chart opens the page but does not carry the outlet or the dates across, because those pages keep their own filters.
- **Change against the dates before.** A measure where a rise is good (sales, margin, tasks done) follows the sign colour rule (6.7). A measure where a rise is bad (food short, labour share) is shown in plain text with the arrow, because painting a bad rise green would mislead. A change under a tenth of a point is "no change" and is never coloured.
- **The top bar's outlet and day selectors no longer appear on the Dashboard.** The page has its own filters. They still appear on Count & GRN.
- **Not here any more:** the single-outlet "items to check first" table and the item detail sheet's entry point. The sheet and the real stock count are still used by Count & GRN and the outlet card. The Food variance page is still on sample data, so there is **no page that lists the real items of one outlet and day** until Food variance is connected to the stock count.

### 6.16 Outlet card (Built, 28 Nov 2026)
`src/components/outlet-sheet.tsx`, a side sheet like the item detail (6.2) that opens from a **pin on the map, a pick from the map search or a row of the Outlets table**, for outlets with data and without. The first Escape closes the card and a second one clears the outlet chosen on the map. It has four blocks and nothing more, so it stays quick to read:

1. **Header:** the US Pizza logo, the outlet's status word, its name, area and region, and **Manager** as Planned (no manager data exists yet).
2. **Latest day:** food variance, items flagged with how many are critical, and the three items most short, each with its status word. An outlet with no data says what to upload.
3. **Is the data complete?** The seven days that end on the latest loaded day, a row each for stock count, GRN and POS deductions. Done is green with a tick, missing is yellow with an exclamation mark, no file that day is grey, and each square has a hidden word for screen readers.
4. **How is it doing?** Food cost against the ideal (from the real files, with week to date), then Treeams tasks done and labour share, both marked **Sample data** until their reports are loaded. A dot shows only when a score needs a look.

One button, **Open the dashboard**, switches to the outlet and goes to the Dashboard (disabled with a note when there is no data). Sales, profit and the other pages are not repeated here. They have their own pages and would crowd the card. Planned for the card: manager, address and phone, real map coordinates, and a target for each outlet.

### 6.14 Treeams checklists page (Built on sample data, 28 Nov 2026)
`/treeams`, rebuilt from one table into a view of how well each outlet keeps its daily checklists. **Tasks done** is the tasks ticked out of the tasks expected, against a **90% target**. The four checklists are Opening, Closing, Manager (the hourly walk of the floor) and Cash.

- **Filters:** search, period, region and checklist. The checklist filter can also be set by clicking a bar in the "by checklist" chart.
- **Summary strip:** tasks done against the target, how many outlets are under it, checklists **not started at all** (a whole routine skipped, which is worse than a few missed tasks) and the share done late.
- **Outlets and checklists side by side:** the ten outlets furthest under the target, and the four checklists. Under the target is red and on target is grey. The checklist chart is not narrowed by the checklist chosen, so the picked bar stays in view (same rule as 6.12).
- **Day-by-day grid:** a row for each of the twelve lowest outlets and a column for each day, a square for the share of tasks done. Look along a row for an outlet that keeps slipping and down a column for a day that went wrong everywhere. Green is 90% or more, yellow 70% to 90%, red under 70%, and a checklist **not started** is red with a cross so colour is never the only sign. A day the outlet was not open is blank. Details are in a fixed line under the grid and never float over it. Click an outlet name to open it, and the grid then shows that outlet's four checklists by day.
- **Trend and weekday:** tasks done each day as a line with the not-started checklists as columns, and tasks done by day of the week (busy days push the closing routine aside).
- **Tasks left undone most often:** the eight tasks skipped most, with the checklist, the rate and the count. A task skipped almost everywhere is a problem with the task, not an outlet. Next to it, the outlets with the most checklists not started, as the list to call.
- **Table** with its own search and filters (tasks done against the target, not started), sorting and paging. The first figure follows the checklist filter and the four after it always show every checklist.
- **What this page is built on:** the real upload only gives tasks done out of expected for each outlet and checklist. The day, task names, time of tick, who completed it and photos are listed there as **Planned**, with what each needs from the Treeams export.
- The old table page is kept at `reference/treeams-real-data-page.tsx.txt`. It read the uploaded checklist (`checklist` in the data provider); the new page does not read it yet. Parse code is in `ingestChecklist` (`src/lib/parse-extra.ts`) and will need a day, a task and a time column to feed this page.

### 6.13 Labour vs sales page (Built on sample data, 27 Nov 2026)
`/labor`, built from nothing: the old page was four empty boxes waiting for a payroll report that is not in the system. The sample data is made up (a crew for each outlet by role, pay rates, overtime, allowances and the contributions the employer adds) on the same daily sales as the other pages. The page says what is missing in its last card, and the real reports needed are listed there.

- **Filters:** search, period, region and role (kitchen, counter, delivery). A role filter shows that role's cost against the whole outlet's sales, and says so.
- **Summary strip:** labour cost, labour as a share of net sales against the **25% target**, sales for each hour worked, and overtime as a share of hours (high from 8%). Share goes amber over the target and red 3 points over it.
- **Target shown on every chart.** Bars and dots over the target are red and the rest are grey, so red marks only what needs a look. The target is a dashed line.
- **Outlets:** the ten with the highest labour share, and a scatter of net sales against labour share. A small outlet with a crew that costs a lot sits high and to the left. Click a bar, a dot or a table name and the whole page is about that outlet, with a breadcrumb, a Back button and its rank.
- **Days:** labour cost each day with its share of sales as a line, and the share by day of the week. The crew is much the same every day and sales are not, so the quiet days run high. That is where a roster can change.
- **Staff against sales by hour:** an average day, sales in each hour as columns and staff on shift as a line. Hours where one person serves far more sales than usual are red (short of staff), hours with far fewer are pale (too many staff). It needs sales by hour from the POS and a roster with shift times, both Planned.
- **Where the money goes:** regular wages, overtime, allowances and employer contributions, and the split by role with hours.
- **Table** with its own search and filters (labour share against the target, overtime), sorting and paging.
- **Link to Profit & loss:** when the payroll report is added, the Labour cost line there fills in and operating profit appears.
- The old page is kept at `reference/labour-real-data-page.tsx.txt`.

### 6.12 Food variance page (Built on sample data, 27 Nov 2026)
`/variance`, rebuilt from one outlet on one day into a view of the whole network. Variance is what the count found against what the system expects. A day is **short** of an item when it is RM 10 or more under, and the figures count only days that were counted.

- **Cross-filtering, the Tableau idea.** Click an outlet bar and the item chart, the figures, the trend and the table narrow to that outlet. Click an item bar and everything narrows to that item. Do both and the page is about one item at one outlet. The chosen bar stays strong and the others fade, a chip in the filter card names each choice, and clicking a bar again lets go. The outlet chart is not narrowed by the outlet chosen, and the item chart is not narrowed by the item chosen, so the bar you clicked stays in view.
- **Summary strip:** what was short, the net variance after what was over, how many outlet and item pairs are **repeatedly** short, and food cost with the points of it that the shortage explains. Repeated means short on at least 3 days and at least 40% of the days counted, which tells a real loss from one counting mistake.
- **Outlets and items side by side** in one card. The item chart shows each item's running share of all the shortage, so it is clear how few items carry most of it.
- **Day by day:** what was short each day and that as a share of the day's sales. With one outlet and one item chosen it becomes that pair's history with its last count.
- **Can the numbers be trusted?** The share of outlet days that have the stock count, the GRN and the POS deduction, and the outlets with the most gaps. A day with no count gives no variance.
- **Table:** one row per outlet and item with its own search and filters (pattern, size). Clicking an item or an outlet in a row filters the charts above. Row click is not used, because a row holds two things to click.
- **Planned:** the reason for a shortage and who is looking into it, to be saved with the count.
- The old single-day page is kept at `reference/variance-real-data-page.tsx.txt`. The item detail sheet and the badge on the sidebar item still read the real day.

### 6.11 Profit and loss page (Built on sample data, 27 Nov 2026)
`/pnl`, built on the figures of the two Sales pages so the totals agree. It says plainly what it is: **gross profit, not a full profit**, because only sales, platform fees and the cost of food exist so far.

- **Filters:** search, period, region and **cost of food**, a choice between Purchases (GRN, goods received at the PO price) and Food used (stock count and movement). The gap between the two is stock built up or run down, and the page shows it.
- **Summary strip:** net sales, platform fees, cost of food and gross profit with its margin. The gross profit figure turns red only when the margin has dropped more than 2 points against the period before.
- **Statement and waterfall in one card:** the statement runs net sales, less platform fees, net revenue after fees, less cost of food, gross profit. Net sales, fees and the cost of food open to show what they are made of (by channel with logos, by fee type, and both cost bases). Labour, rent, other overheads and operating profit are shown as **Planned** so a missing cost is never read as a zero cost. The column "Against before" shows the change in the size of a line, so a fee that grew shows as up. The waterfall beside it goes from net sales down to gross profit.
- **Trend and purchases in one card:** gross profit a day by month with the margin as a line, and purchases against food used by month.
- **Outlets:** a scatter of net sales against margin (dashed line is the network margin), a "needs a look" list of the outlets that keep 2 points or more less of each ringgit with the reason (fees or food), and a table with its own search and filters. Clicking a dot, a list row or a table row opens that outlet: the whole page (summary, statement, waterfall, trend) is then about that outlet, with a breadcrumb, a Back button and its rank.
- **What this page is built on:** a short list of the sources behind it and the ones still to come, so the limits are visible.
- **Built to grow:** the lines of the statement open, so revenue by item and sales by item can be added as further levels under net sales and the cost of food without changing the page.

### 6.10 Pages built on sample data (27 Nov 2026)
Sales by outlet and Sales by channel use sample data from `src/lib/overview-mock.ts` and `src/lib/channel-mock.ts`. The figures come from the outlet name and the date, so they never change between visits, and the two pages agree on totals. Replace the row builders with queries and keep the shapes.

## 7. Numbers, money and dates
Money is `RM 4,666,947` (whole ringgit for totals, two decimals for amounts that belong to one document). Chart axes use `k` for thousands. Counts are "2 of 3". Dates read "27 Nov 2026".

## 8. Writing for the interface
Plain words, sentence case, short sentences. No em dashes and no semicolons. Label anything not built as "Planned".

## 9. Known gaps

1. **Contrast not measured** for the red primary, danger and the warm greys in both themes. Do this with the WCAG formula before relying on red as text.
2. **Brand red against danger red.** Section 2 limits how red is used, but a reader can still confuse them on a page with many red bars. Sales by outlet draws every bar in brand red because they are the same measure. If this reads as an alarm in review, switch the non-leading bars to grey.
3. **Sales pages** have not been checked in dark mode by measurement, only by eye. 375 px and 1440 px were checked with scripts.
4. The older pages (Dashboard and Upload) were not re-checked against this guide.
5. The Sales tables use sample data with at most 44 rows, so very long lists are untested.

## 10. Checklist for a new page
1. Title, one-sentence subtitle and the clock.
2. Filters in one card (6.4). Tables have search, filter, sort and pagination (6.3) and a result line.
3. One status per row. Yellow only as a dot, bar or icon.
4. Brand red marks one thing. The rest of a chart is grey.
5. Every chart has a legend and a text description.
6. Money and dates follow section 7.
7. Check at 375 px and 1440 px, in light and dark, and measure the page width.
8. Sample data carries the one marker. Real data carries none.
