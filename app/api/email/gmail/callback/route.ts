import { after, NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/dal";
import { encryptToken } from "@/lib/email/crypto";
import { gmailExchangeCode, gmailProfile } from "@/lib/email/gmail";
import { appOrigin } from "@/lib/oauth";
import { saveConnection } from "@/lib/email/service";
import { syncUser } from "@/lib/email/sync";

export const maxDuration = 300;

/** Google redirects here after sign-in: store the (encrypted) refresh token, then run a first sync. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const done = (result: string) => {
    const res = NextResponse.redirect(`${origin}/profile?email=${result}`);
    res.cookies.delete({ name: "gm_oauth", path: "/api/email/gmail" });
    return res;
  };

  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return done("gmail_denied");

  let saved: { state?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get("gm_oauth")?.value ?? "{}");
  } catch {}
  const code = params.get("code");
  // State must match the cookie we set (protects against forged callbacks).
  if (!code || !saved.state || saved.state !== params.get("state") || !saved.verifier) return done("gmail_auth_failed");
  // The user may untick the Gmail permission on Google's consent screen.
  if (!(params.get("scope") ?? "").includes("gmail.readonly")) return done("gmail_denied");

  try {
    const tokens = await gmailExchangeCode({ code, verifier: saved.verifier, origin });
    if (!tokens.refresh_token) return done("gmail_auth_failed");
    const profile = await gmailProfile(tokens.access_token);
    await saveConnection({ userId: user.id, provider: "gmail", accountEmail: profile.emailAddress, refreshTokenEncrypted: encryptToken(tokens.refresh_token) });
    after(async () => {
      try {
        await syncUser(user.id);
      } catch (e) {
        console.error("first Gmail sync failed", e instanceof Error ? e.message : e);
      }
    });
    return done("gmail_connected");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("Gmail connect failed", message);
    return done("gmail_auth_failed");
  }
}
