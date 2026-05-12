import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Middleware-flavored Supabase client. Refreshes the session on every request
 * so server components see fresh auth state. Per Supabase docs, the response
 * cookies must mirror what the client sets — we use a passthrough pattern.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touching getUser() refreshes the session if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Gate the (app) routes behind auth. Public routes pass through.
  const url = new URL(request.url);
  const isProtected = url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/review');
  if (isProtected && !user) {
    const redirect = new URL('/login', request.url);
    redirect.searchParams.set('next', url.pathname);
    return NextResponse.redirect(redirect);
  }

  return response;
}