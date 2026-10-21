import { NextResponse, type NextRequest } from "next/server";
import { authorizeUrl, googleClient, SIGN_IN_COOKIE, SIGN_IN_COOKIE_PATH } from "@/lib/google-sign-in";
import { appOrigin, pkce, randomToken } from "@/lib/oauth";

/** "Continue with Google": off to Google's sign-in, with state, PKCE and a nonce kept in a short-lived cookie. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const client = googleClient();
  if (!client) {
    console.error("Google sign-in isn't configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)");
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }
  const state = randomToken();
  const nonce = randomToken();
  const { verifier, challenge } = pkce();
  const res = NextResponse.redirect(authorizeUrl({ clientId: client.clientId, origin, state, challenge, nonce }));
  res.cookies.set(SIGN_IN_COOKIE, JSON.stringify({ state, nonce, verifier }), {
    httpOnly: true,
    secure: origin.startsWith("https://"),
    sameSite: "lax",
    maxAge: 600,
    path: SIGN_IN_COOKIE_PATH,
  });
  return res;
}
