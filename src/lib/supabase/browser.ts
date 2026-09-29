import { createClient } from "@supabase/supabase-js";

type BrowserSupabaseClient = ReturnType<typeof createClient<any>>;

let browserClient: BrowserSupabaseClient | null = null;

export function getSupabaseBrowserClient(): BrowserSupabaseClient {
  if (browserClient) return browserClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  browserClient = createClient<any>(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}
