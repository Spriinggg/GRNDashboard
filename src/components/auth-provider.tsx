"use client";

import type { Session } from "@supabase/supabase-js";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import type { Role } from "@/lib/types";

type AuthCtx = {
  /** True when Supabase is configured, so a sign-in is required. */
  enabled: boolean;
  userId: string | null;
  email: string;
  /** Display name, falling back to the email. */
  label: string;
  role: Role;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be used inside AuthProvider");
  return c;
};

// Without Supabase the app runs on this machine only, so the local user is treated as admin.
const LOCAL: AuthCtx = { enabled: false, userId: null, email: "guest@uspizza.local", label: "Local user", role: "admin", isAdmin: true, signOut: async () => window.location.assign("/") };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>("user");
  const [ready, setReady] = useState(!supabase);

  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        setSession(data.session);
        setReady(true);
      })
      .catch(() => alive && setReady(true));
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, s) => setSession(s));
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Display hint only. The database policies (see supabase/auth_setup.sql) are what really enforce admin rights.
  const uid = session?.user.id ?? null;
  useEffect(() => {
    if (!supabase || !uid) {
      setRole("user");
      return;
    }
    let alive = true;
    void supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (alive) setRole(data?.role === "admin" ? "admin" : "user");
      });
    return () => {
      alive = false;
    };
  }, [uid]);

  const signOut = useCallback(async () => {
    try {
      await supabase?.auth.signOut();
    } finally {
      window.location.assign("/");
    }
  }, []);

  const value = useMemo<AuthCtx>(() => {
    if (!supabase) return LOCAL;
    const u = session?.user;
    const md = (u?.user_metadata ?? {}) as { full_name?: string; name?: string };
    const email = u?.email ?? "";
    return { enabled: true, userId: u?.id ?? null, email, label: md.full_name || md.name || email, role, isAdmin: role === "admin", signOut };
  }, [session, role, signOut]);

  if (!ready) return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading…</div>;
  if (supabase && !session) return <SignIn />;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function SignIn() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setErr("");
    setBusy(true);
    try {
      const creds = { email: email.trim(), password: pass };
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword(creds);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ ...creds, options: { data: { full_name: name.trim() } } });
        if (error) throw error;
        if (!data.session) {
          setErr("Account created. Check your email to confirm, then sign in.");
          setMode("in");
        }
      }
    } catch (x) {
      setErr(x instanceof Error ? x.message : "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-svh place-items-center bg-gradient-to-b from-primary/[0.07] to-background p-4">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <div className="flex flex-col items-center gap-2 text-center">
          <Image src="/logo.svg" alt="US Pizza" width={194} height={127} unoptimized className="h-14 w-auto" />
          <h1 className="font-display text-xl font-bold">US Pizza · Food Control</h1>
          <p className="text-sm text-muted-foreground">{mode === "in" ? "Sign in to view the dashboard" : "Create an account to get access"}</p>
        </div>
        {mode === "up" ? (
          <label className="block space-y-1 text-sm font-medium">
            Name
            <Input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" placeholder="e.g. Amirul Afiq" />
          </label>
        ) : null}
        <label className="block space-y-1 text-sm font-medium">
          Email
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="you@uspizza.com" />
        </label>
        <label className="block space-y-1 text-sm font-medium">
          Password
          <div className="relative">
            <Input
              type={show ? "text" : "password"}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              placeholder="At least 6 characters"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </label>
        {err ? (
          <p role="alert" className="text-sm text-danger">
            {err}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          {mode === "in" ? "New here? " : "Have an account? "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === "in" ? "up" : "in");
              setErr("");
            }}
          >
            {mode === "in" ? "Create an account" : "Sign in"}
          </button>
        </p>
      </form>
    </div>
  );
}
