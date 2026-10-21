import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailSettings } from "@/components/email/email-settings";
import { I18nProvider } from "@/lib/i18n/client";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/career/find-description", () => ({ fillJobDescription: vi.fn() }));

const { availableMailProviders } = await import("@/lib/email/service");

describe("availableMailProviders", () => {
  afterEach(() => vi.unstubAllEnvs());
  const base = { EMAIL_TOKEN_KEY: "a".repeat(64), SUPABASE_SECRET_KEY: "sb_secret_x", OUTLOOK_CLIENT_ID: "", OUTLOOK_CLIENT_SECRET: "", GMAIL_CLIENT_ID: "", GMAIL_CLIENT_SECRET: "" };
  const env = (vars: Record<string, string>) => Object.entries({ ...base, ...vars }).forEach(([k, v]) => vi.stubEnv(k, v));

  it("offers a provider only when its OAuth client is fully set", () => {
    env({ GMAIL_CLIENT_ID: "id", GMAIL_CLIENT_SECRET: "secret", OUTLOOK_CLIENT_ID: "id-only" });
    expect(availableMailProviders()).toEqual(["gmail"]);
  });

  it("offers nothing without the token encryption key or the server key", () => {
    env({ GMAIL_CLIENT_ID: "id", GMAIL_CLIENT_SECRET: "secret", EMAIL_TOKEN_KEY: "" });
    expect(availableMailProviders()).toEqual([]);
    env({ GMAIL_CLIENT_ID: "id", GMAIL_CLIENT_SECRET: "secret", SUPABASE_SECRET_KEY: "" });
    expect(availableMailProviders()).toEqual([]);
  });
});

describe("EmailSettings", () => {
  const renderCard = (props: Parameters<typeof EmailSettings>[0]) =>
    render(
      <I18nProvider locale="en">
        <EmailSettings {...props} />
      </I18nProvider>,
    );

  it("shows Connect only for providers set up on the server", () => {
    renderCard({ connections: [], available: ["outlook"] });
    expect(screen.getByRole("link", { name: /Connect Outlook/ })).toBeInTheDocument();
    expect(screen.queryByText("Gmail")).toBeNull();
  });

  it("keeps a connected mailbox (so it can be disconnected) even if its provider was turned off", () => {
    renderCard({
      connections: [{ provider: "gmail", accountEmail: "sara@gmail.com", lastSyncedAt: null, status: "active", error: null }],
      available: [],
    });
    expect(screen.getByText("sara@gmail.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Disconnect/ })).toBeInTheDocument();
  });
});
