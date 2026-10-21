import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The local token check (getClaims) and the auth server (getUser) can disagree: a token can still be
// valid after its session has ended. These tests pin down what the proxy does then.
const auth = { claims: true as boolean, serverUser: true as boolean, signOut: vi.fn() };
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getClaims: async () => ({ data: auth.claims ? { claims: { sub: "user-1" } } : null }),
      getUser: async () => (auth.serverUser ? { data: { user: { id: "user-1" } }, error: null } : { data: { user: null }, error: { message: "session_not_found" } }),
      signOut: auth.signOut,
    },
  }),
}));
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");

const { updateSession } = await import("@/lib/supabase/proxy");
const visit = (path: string) => updateSession(new NextRequest(`https://dreamplish.test${path}`));
const location = (res: Response) => res.headers.get("location");

beforeEach(() => {
  auth.claims = true;
  auth.serverUser = true;
  auth.signOut.mockReset();
});

describe("proxy session redirects", () => {
  it("sends a signed-in user from the login page to the dashboard", async () => {
    expect(location(await visit("/login"))).toBe("https://dreamplish.test/dashboard");
  });

  it("shows the login page (and clears the session) when the server says the session has ended — no redirect loop", async () => {
    auth.serverUser = false;
    const res = await visit("/login");
    expect(location(res)).toBeNull();
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("sends signed-out visitors of the app to the login page, and leaves public pages alone", async () => {
    auth.claims = false;
    expect(location(await visit("/dashboard"))).toBe("https://dreamplish.test/login");
    expect(location(await visit("/privacy"))).toBeNull();
  });
});
