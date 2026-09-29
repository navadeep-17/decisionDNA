"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import styles from "./auth-shell.module.css";

type AuthMode = "signin" | "signup";

type Props = {
  children: ReactNode;
};

export default function AuthShell({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceReady, setWorkspaceReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setWorkspaceReady(false);
      setLoading(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setWorkspaceReady(false);
      return;
    }

    let cancelled = false;
    ensureDemoMembership(session.user.id).finally(() => {
      if (!cancelled) setWorkspaceReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [session]);

  async function ensureDemoMembership(userId: string) {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("id, slug")
        .eq("slug", "novapay")
        .single();

      if (orgError || !org) throw orgError || new Error("NovaPay demo workspace not found");

      const { error } = await supabase.from("organization_members").insert({
        organization_id: org.id,
        user_id: userId,
        role: "member",
      });

      if (error && error.code !== "23505") throw error;
    } catch (error) {
      console.error("Failed to initialize demo workspace", error);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (!data.session) {
          setMessage("Account created. Check your email to confirm it, then sign in.");
          setMode("signin");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || (session && !workspaceReady)) {
    return (
      <main className={styles.screen}>
        <div className={`${styles.card} ${styles.loading}`}>
          <div className={styles.logo}>D</div>
          <p>{session ? "Opening NovaPay workspace…" : "Loading DecisionDNA…"}</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return (
      <main className={styles.screen}>
        <section className={styles.card}>
          <div className={styles.logo}>D</div>
          <p className={styles.eyebrow}>DECISIONDNA</p>
          <h1>{mode === "signin" ? "Enter the NovaPay workspace" : "Create your DecisionDNA account"}</h1>
          <p className={styles.copy}>
            Sign in to explore the live organizational-memory demo powered by Hindsight and Supabase.
          </p>

          <form onSubmit={submit} className={styles.form}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>
            <button className={styles.submit} disabled={submitting}>
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </button>
          </form>

          {message ? <p className={styles.message}>{message}</p> : null}

          <button
            type="button"
            className={styles.switch}
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setMessage("");
            }}
          >
            {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <>
      <div className={styles.sessionBar}>
        <span>{session.user.email}</span>
        <button type="button" onClick={() => void getSupabaseBrowserClient().auth.signOut()}>
          Sign out
        </button>
      </div>
      {children}
    </>
  );
}
