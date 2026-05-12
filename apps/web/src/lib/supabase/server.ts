import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Supabase server client. Use inside Server Components, Server Actions,
 * and route handlers. The cookie store is read/written via Next.js's
 * `cookies()` API; we silently ignore write failures from Server Components
 * (those can only happen in middleware), per Supabase's recommended pattern.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components cannot set cookies — middleware refreshes the session instead.
          }
        },
      },
    },
  );
}