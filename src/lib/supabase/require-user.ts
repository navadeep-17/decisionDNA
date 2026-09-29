import { createClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

export async function requireSupabaseUser(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const token = authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : null;

  if (!token) {
    return { user: null, error: "Missing bearer token" } as const;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return { user: null, error: "Supabase server environment is not configured" } as const;
  }

  const supabase = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null, error: "Invalid or expired Supabase session" } as const;
  }

  return { user: data.user, error: null } as const;
}
