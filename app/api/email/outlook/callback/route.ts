import { after, NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/dal";
import { encryptToken } from "@/lib/email/crypto";
import { appOrigin } from "@/lib/oauth";
import { exchangeCode, graph } from "@/lib/email/outlook";
import { saveConnection } from "@/lib/email/service";
import { syncUser } from "@/lib/email/sync";

export const maxDuration = 300;

/** Microsoft redirects here after sign-in: store the (encrypted) refresh token, then run a first sync. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  const done = (result: string) => {
    const res = NextResponse.redirect(`${origin}/profile?email=${result}`);
    res.cookies.delete({ name: "ol_oauth", path: "/api/email/outlook" });
    return res;
  };

  const user = await getUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);
  const params = req.nextUrl.searchParams;
  if (params.get("error")) return done("denied");

  let saved: { state?: string; verifier?: string } = {};
  try {
    saved = JSON.parse(req.cookies.get("ol_oauth")?.value ?? "{}");
  } catch {}
  const code = params.get("code");
  // State must match the cookie we set (protects against forged callbacks).
  if (!code || !saved.state || saved.state !== params.get("state") || !saved.verifier) return done("auth_failed");

  try {
    const tokens = await exchangeCode({ code, verifier: saved.verifier, origin });
    if (!tokens.refresh_token) return done("auth_failed");
    const me = await graph<{ mail?: string; userPrincipalName?: string }>(tokens.access_token, "/me?$select=mail,userPrincipalName");
    await saveConnection({
      userId: user.id,
      provider: "outlook",
      accountEmail: me.mail ?? me.userPrincipalName ?? null,
      refreshTokenEncrypted: encryptToken(tokens.refresh_token),
    });
    after(async () => {
      try {
        await syncUser(user.id);
      } catch (e) {
        console.error("first email sync failed", e instanceof Error ? e.message : e);
      }
    });
    return done("connected");
  } catch (e) {
    console.error("Outlook connect failed", e instanceof Error ? e.message : e);
    return done("auth_failed");
  }
}
