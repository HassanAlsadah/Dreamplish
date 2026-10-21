import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const signInWithIdToken = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { signInWithIdToken } }) }));
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://dreamplish.test");
vi.stubEnv("GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com");
vi.stubEnv("GOOGLE_CLIENT_SECRET", "GOCSPX-secret");

const { GET: start } = await import("@/app/api/auth/google/route");
const { GET: callback } = await import("@/app/api/auth/google/callback/route");

const fetchMock = vi.fn();
beforeEach(() => {
  signInWithIdToken.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllGlobals());

/** Start a sign-in and return Google's URL and the cookie the browser would send back. */
async function begin() {
  const res = await start(new NextRequest("https://dreamplish.test/api/auth/google"));
  const google = new URL(res.headers.get("location")!);
  const cookie = res.cookies.get("g_signin")!;
  return { google, cookie, saved: JSON.parse(cookie.value) as { state: string; nonce: string; verifier: string } };
}
const back = (query: string, cookieValue?: string) => {
  const req = new NextRequest(`https://dreamplish.test/api/auth/google/callback?${query}`);
  if (cookieValue) req.cookies.set("g_signin", cookieValue);
  return callback(req);
};

describe("Google sign-in on the app's own domain", () => {
  it("sends the user to Google naming this site, with state, PKCE and the nonce's hash", async () => {
    const { google, cookie, saved } = await begin();
    expect(google.origin + google.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(Object.fromEntries(google.searchParams)).toMatchObject({
      client_id: "client-123.apps.googleusercontent.com",
      redirect_uri: "https://dreamplish.test/api/auth/google/callback",
      response_type: "code",
      scope: "openid email profile",
      state: saved.state,
      nonce: createHash("sha256").update(saved.nonce).digest("hex"),
      code_challenge: createHash("sha256").update(saved.verifier).digest("base64url"),
      code_challenge_method: "S256",
    });
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/api/auth/google", maxAge: 600 });
  });

  it("exchanges the code and gives Supabase the ID token with the raw nonce, then opens the dashboard", async () => {
    const { cookie, saved } = await begin();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id_token: "google-id-token" }), { status: 200 }));
    signInWithIdToken.mockResolvedValue({ error: null });

    const res = await back(`code=abc&state=${saved.state}`, cookie.value);
    const body = new URLSearchParams(String(fetchMock.mock.calls[0][1].body));
    expect(Object.fromEntries(body)).toMatchObject({ code: "abc", code_verifier: saved.verifier, redirect_uri: "https://dreamplish.test/api/auth/google/callback" });
    expect(signInWithIdToken).toHaveBeenCalledWith({ provider: "google", token: "google-id-token", nonce: saved.nonce });
    expect(res.headers.get("location")).toBe("https://dreamplish.test/dashboard");
    expect(res.cookies.get("g_signin")?.value).toBe(""); // the one-time cookie is cleared
  });

  it("refuses a callback whose state doesn't match (forged or replayed), without contacting Google", async () => {
    const { cookie } = await begin();
    const res = await back("code=abc&state=someone-elses", cookie.value);
    expect(res.headers.get("location")).toBe("https://dreamplish.test/login?error=oauth");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(signInWithIdToken).not.toHaveBeenCalled();
  });

  it("goes back to login when cancelled at Google, the code is bad, or Supabase rejects the token", async () => {
    const { cookie, saved } = await begin();
    expect((await back(`error=access_denied&state=${saved.state}`, cookie.value)).headers.get("location")).toBe("https://dreamplish.test/login?error=oauth");

    fetchMock.mockResolvedValueOnce(new Response("invalid_grant", { status: 400 }));
    expect((await back(`code=old&state=${saved.state}`, cookie.value)).headers.get("location")).toBe("https://dreamplish.test/login?error=oauth");

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ id_token: "t" }), { status: 200 }));
    signInWithIdToken.mockResolvedValueOnce({ error: { message: "nonce mismatch" } });
    expect((await back(`code=abc&state=${saved.state}`, cookie.value)).headers.get("location")).toBe("https://dreamplish.test/login?error=oauth");
  });

  it("sends nobody to Google when sign-in isn't configured: back to login", async () => {
    vi.stubEnv("GOOGLE_CLIENT_ID", "");
    const res = await start(new NextRequest("https://dreamplish.test/api/auth/google"));
    expect(res.headers.get("location")).toBe("https://dreamplish.test/login?error=oauth");
    vi.stubEnv("GOOGLE_CLIENT_ID", "client-123.apps.googleusercontent.com");
  });
});
