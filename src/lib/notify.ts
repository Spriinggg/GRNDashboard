import Swal from "sweetalert2";
import { toast } from "sonner";

// How the app talks to the person. Two tools, each with one job:
//  - a toast (Sonner) for something that happened and needs no answer: saved, added, deleted, or a small failure.
//  - a dialog (SweetAlert2) when the person has to decide (confirm a delete) or must read a failure that needs action.
// A failure is never only in the console. It says what happened, why in plain words, and what to do next.

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

// SweetAlert2 drawn with the app's tokens (light and dark follow the page), no stock button styles.
const button = "inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";
const classes = {
  popup: "!rounded-xl !border !border-border !bg-popover !p-6 !text-popover-foreground !shadow-lg",
  title: "!p-0 !font-display !text-xl !font-bold !text-foreground",
  htmlContainer: "!m-0 !mt-2 !p-0 !text-sm !text-muted-foreground",
  actions: "!mt-5 !w-full !justify-end !gap-2",
  confirmButton: `${button} bg-primary text-primary-foreground hover:opacity-90`,
  denyButton: `${button} bg-danger text-white hover:opacity-90`,
  cancelButton: `${button} border bg-card text-foreground hover:bg-muted`,
  footer: "!border-border !text-xs !text-muted-foreground",
};
const tone = { error: "var(--danger)", warning: "var(--warning)", question: "var(--primary)", info: "var(--primary)", success: "var(--success)" } as const;

type DialogBase = { title: string; text?: string; confirmText?: string };

// Ask before something that cannot be undone. Resolves true on confirm. For a delete, Cancel is focused so Enter is safe.
export async function confirmDialog(o: DialogBase & { cancelText?: string; danger?: boolean }): Promise<boolean> {
  const r = await Swal.fire({
    titleText: o.title, // plain text: SweetAlert2 renders `title` as HTML, and titles can hold an outlet name read from an uploaded file
    text: o.text,
    icon: o.danger ? "warning" : "question",
    iconColor: o.danger ? tone.warning : tone.question,
    showCancelButton: true,
    confirmButtonText: o.confirmText ?? "Confirm",
    cancelButtonText: o.cancelText ?? "Cancel",
    reverseButtons: true,
    focusCancel: !!o.danger,
    buttonsStyling: false,
    customClass: { ...classes, confirmButton: o.danger ? classes.denyButton : classes.confirmButton },
  });
  return r.isConfirmed;
}

export type DialogItem = { name: string; detail: string };

// Something went wrong or needs reading. `items` is a list (for example files that could not be read). `detail` is the technical
// line for whoever helps, kept small at the bottom.
export function errorDialog(o: DialogBase & { items?: DialogItem[]; detail?: string; icon?: "error" | "warning" | "info" }) {
  const icon = o.icon ?? "error";
  const list = o.items?.length
    ? `<ul style="text-align:left;margin:.75rem 0 0;padding:0;list-style:none;max-height:14rem;overflow:auto">${o.items
        .map((i) => `<li style="padding:.5rem 0;border-top:1px solid var(--border)"><b style="color:var(--foreground);word-break:break-all">${escapeHtml(i.name)}</b><br><span>${escapeHtml(i.detail)}</span></li>`)
        .join("")}</ul>`
    : "";
  return Swal.fire({
    titleText: o.title, // plain text: SweetAlert2 renders `title` as HTML, and titles can hold an outlet name read from an uploaded file
    html: `${o.text ? `<p style="margin:0">${escapeHtml(o.text)}</p>` : ""}${list}`,
    icon,
    iconColor: tone[icon],
    confirmButtonText: o.confirmText ?? "OK",
    footer: o.detail ? escapeHtml(o.detail) : undefined,
    buttonsStyling: false,
    customClass: classes,
  });
}

export type Friendly = { title: string; text: string; detail: string };

// Turns whatever was thrown (a Supabase error, a failed fetch, an Error) into words a person can act on. `what` finishes the
// sentence "We could not …".
export function describeError(e: unknown, what = "finish that"): Friendly {
  const err = (e ?? {}) as { message?: unknown; code?: unknown; status?: unknown; statusCode?: unknown };
  const msg = typeof err.message === "string" ? err.message : String(e ?? "");
  const code = String(err.code ?? "");
  const status = Number(err.status ?? err.statusCode) || 0;
  const detail = [status && `HTTP ${status}`, code && `Code ${code}`, msg].filter(Boolean).join(" · ");
  const base = `We could not ${what}`;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { title: "You are offline", text: `${base}. Check your internet connection and try again.`, detail };
  if (/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(msg)) return { title: "Cannot reach the server", text: `${base}. The server did not answer. Check your connection, or try again in a moment.`, detail };
  if (status === 401 || code === "PGRST301" || /jwt|token.*expired|not authenticated/i.test(msg)) return { title: "Your session has ended", text: `${base}. Sign out and sign in again, then try once more.`, detail };
  if (status === 403 || code === "42501" || /permission denied|row-level security|not allowed/i.test(msg)) return { title: "No permission", text: `${base} because this account is not allowed to. Ask an admin if you think it should be.`, detail };
  if (status === 404 || code === "PGRST205" || code === "42P01" || /schema cache|does not exist|not found/i.test(msg)) return { title: "Not found (404)", text: `${base} because the place it saves to was not found. The table or the address may be missing or renamed. Tell the person who looks after the system.`, detail };
  if (status === 409 || code === "23505") return { title: "Already exists", text: `${base} because the same record is already there. Refresh the page and look again.`, detail };
  if (status === 429) return { title: "Too many requests", text: `${base} right now. Wait a minute and try again.`, detail };
  if (status >= 500) return { title: "The server had a problem", text: `${base}. This is on our side, not yours. Try again in a few minutes.`, detail };
  return { title: "Something went wrong", text: `${base}. Try again, and if it keeps happening tell the person who looks after the system.`, detail };
}

// Report a failure: always logged, then shown as a toast, or as a dialog when the person must act or read it (`dialog`).
export function reportError(e: unknown, o: { what: string; dialog?: boolean; retry?: () => void }): Friendly {
  const f = describeError(e, o.what);
  console.error(o.what, e);
  if (o.dialog) void errorDialog({ title: f.title, text: f.text, detail: f.detail });
  else toast.error(f.title, { id: `err:${f.title}:${o.what}`, description: f.text, duration: 10000, action: o.retry ? { label: "Try again", onClick: o.retry } : undefined });
  return f;
}
