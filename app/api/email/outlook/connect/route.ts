import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/dal";
import { authorizeUrl, OutlookError } from "@/lib/email/outlook";
import { appOrigin, pkce } from "@/lib/oauth";

/** Starts "Connect Outlook": sends the user to Microsoft's sign-in with PKCE. */
export async function GET(req: NextRequest) {
  const origin = appOrigin(req);
  if (!(await getUser())) return NextResponse.redirect(`${origin}/login`);
  try {
    const state = randomBytes(16).toString("base64url");
    const { verifier, challenge } = pkce();
    const res = NextResponse.redirect(authorizeUrl({ origin, state, challenge }));
    res.cookies.set("ol_oauth", JSON.stringify({ state, verifier }), {
      httpOnly: true,
      secure: origin.startsWith("https://"),
      sameSite: "lax",
      maxAge: 600,
      path: "/api/email/outlook",
    });
    return res;
  } catch (e) {
    const code = e instanceof OutlookError ? e.code : "error";
    return NextResponse.redirect(`${origin}/profile?email=${code}`);
  }
}
