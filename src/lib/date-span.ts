// A range of dates written as "YYYY-MM-DD". An empty string means "no limit" on that side, so a range can be
// open at one end ("up to 25 Nov 2026"). Used by the date filters.
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "2026-11-24" to "24 Nov 2026"
export const formatDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MON[m - 1]} ${y}`;
};

export type DateSpan = { from: string; to: string };
export const NO_SPAN: DateSpan = { from: "", to: "" };

export const isOpen = (s: DateSpan) => s.from === "" && s.to === "";
export const inSpan = (value: string, s: DateSpan) => (s.from === "" || value >= s.from) && (s.to === "" || value <= s.to);

// Local dates, so a day never slips by one because of the time zone.
export const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromIso = (iso: string) => new Date(`${iso}T00:00:00`);

// "18 to 20 Nov 2026" when both ends are in one month, "28 Oct to 3 Nov 2026" in one year, otherwise two full dates.
function bothEnds(from: string, to: string) {
  if (from === to) return formatDate(to);
  const a = fromIso(from);
  const b = fromIso(to);
  if (a.getFullYear() !== b.getFullYear()) return `${formatDate(from)} to ${formatDate(to)}`;
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} to ${formatDate(to)}`;
  return `${a.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} to ${formatDate(to)}`;
}

export const spanText = (s: DateSpan) =>
  s.from && s.to ? bothEnds(s.from, s.to) : s.to ? `up to ${formatDate(s.to)}` : s.from ? `from ${formatDate(s.from)}` : "any date";
