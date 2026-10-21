import { NextResponse, type NextRequest } from "next/server";
import { exchangeCodeForIdToken, SIGN_IN_COOKIE, SIGN_IN_COOKIE_PATH } from "@/lib/google-sign-in";
import { appOrigin } from "@/lib/oauth";
import { createClient } from "@/lib/supabase/server";

/** Google sends the user back here: check the state, get the ID token, and let Supabase start the session. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const finish = (path: string) => {
    const res = NextResponse.redirect(`${origin}${path}`);
    res.cookies.delete({ name: SIGN_IN_COOKIE, path: SIGN_IN_COOKIE_PATH });
    return res;
  };

  let saved: { state?: string; nonce?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get(SIGN_IN_COOKIE)?.value ?? "{}");
  } catch {}
  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  // Cancelled at Google, or a forged / replayed callback (the state must match our cookie).
  if (params.get("error") || !code || !saved.state || saved.state !== params.get("state") || !saved.nonce || !saved.verifier) {
    return finish("/login?error=oauth");
  }

  const idToken = await exchangeCodeForIdToken({ code, verifier: saved.verifier, origin }).catch(() => null);
  if (!idToken) return finish("/login?error=oauth");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: saved.nonce });
  if (error) {
    console.error("Supabase sign-in with the Google ID token failed", error.message);
    return finish("/login?error=oauth");
  }
  return finish("/dashboard");
}
