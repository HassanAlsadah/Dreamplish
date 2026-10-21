import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/dal";
import { GmailError, gmailAuthorizeUrl } from "@/lib/email/gmail";
import { appOrigin, pkce } from "@/lib/oauth";

/** Starts "Connect Gmail": sends the user to Google's sign-in with PKCE (read-only Gmail access). */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  if (!(await getUser())) return NextResponse.redirect(`${origin}/login`);
  try {
    const state = randomBytes(16).toString("base64url");
    const { verifier, challenge } = pkce();
    const res = NextResponse.redirect(gmailAuthorizeUrl({ origin, state, challenge }));
    res.cookies.set("gm_oauth", JSON.stringify({ state, verifier }), {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 600,
      path: "/api/email/gmail",
    });
    return res;
  } catch (e) {
    const code = e instanceof GmailError ? e.code : "error";
    return NextResponse.redirect(`${origin}/profile?email=gmail_${code}`);
  }
}
