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
- **Fees are two linked views (Built, "What the platforms take").** Left: one bar per channel, drawn to the channel's fee rate and split by fee type (commission, advertising, platform or service fee, payment gateway, adjustments or credits), with the rate and the ringgit beside it. Right: a waterfall that goes from the channel's net sales down through each fee to what is left. Click a channel on the left to follow its sales on the right (the first row is all channels). The exact figures, the share of net sales and the share of all fees are in the waterfall tooltip.
- **Drill-down by channel (Built, "Best outlets for each channel").** The idea is a Tableau dashboard: choose, click, open. Pick a channel (or All) with the logo chips to filter, then the chart shows the top or bottom 10 outlets, split by channel when All is chosen. Click an outlet to see its months by channel, and a month to see its days. A breadcrumb and a Back button go up a level, and the tooltip lists each channel's figure and share. Use the same pattern, filter first then click to open, for any new "best of" chart.
- **Every chart has a legend** (a short row under it, a swatch drawn like the mark and a plain word). A list beside the chart that names every mark counts.
- A bar or line chart does not decorate: no gradients, no 3D, no glow.
- **A column of figures stays calm.** A change that went up is grey text with an arrow, and only a drop is red. A food cost figure gets a dot only when it is off target, so a column of green dots does not shout.

### 6.8 Page background (Built)
A faint top-to-bottom tint of the brand colour that fades out within 420 px. It is the only gradient.

### 6.9 Sample-data marker (Built)
Pages that are built on generated figures carry one small "Sample data" marker beside the subtitle and no other note. Real data never carries it. Remove the marker when the page reads from Supabase.

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
4. The older pages (Dashboard, Upload, Treeams, P&L, Labour) were not re-checked against this guide.
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
