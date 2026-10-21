import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/env";
import { contentSecurityPolicy, createNonce } from "@/lib/security-headers";
import type { Database } from "./database";

const PROTECTED_PREFIXES = ["/dashboard", "/jobs", "/profile", "/companies", "/cv"];
const AUTH_PAGES = ["/login"];

/**
 * Refreshes the Supabase session cookie, does optimistic auth redirects, and sets the page's
 * Content-Security-Policy (with a nonce Next.js reads from the request to tag its scripts).
 */
export async function updateSession(request: NextRequest) {
  const nonce = createNonce();
  const csp = contentSecurityPolicy(nonce, SUPABASE_URL);
  // Built from the request each time, so refreshed session cookies (set on it below) are passed on too.
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set("x-nonce", nonce);
    headers.set("Content-Security-Policy", csp);
    const res = NextResponse.next({ request: { headers } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };
  let response = next();

  const supabase = createServerClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Don't put code between createServerClient and getClaims — it refreshes the token.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);
  const { pathname } = request.nextUrl;

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone();
    url.pathname = path;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    return redirect;
  };

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return redirectTo("/login");
  }
  if (isSignedIn && AUTH_PAGES.includes(pathname)) {
    // The token checks out locally, but the session behind it may have ended (signed out elsewhere,
    // revoked, account deleted). Ask the auth server before sending the user to the dashboard, or the
    // dashboard (which asks the server) sends them straight back here: a redirect loop. A session that's
    // gone is cleared, and the login page shows.
    const { data: verified, error } = await supabase.auth.getUser();
    if (!error && verified.user) return redirectTo("/dashboard");
    await supabase.auth.signOut({ scope: "local" });
  }

  return response;
}
