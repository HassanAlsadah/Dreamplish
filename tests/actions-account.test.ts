import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = { id: "11111111-1111-4111-8111-111111111111", email: "Sara@Example.com" };
const steps: string[] = [];
let files: Array<{ name: string }> = [];
let failAt: string | null = null;
const result = (step: string, data: unknown = null) => ({ data, error: failAt === step ? { message: `${step} failed` } : null });

const admin = {
  storage: {
    from: (bucket: string) => ({
      list: async (folder: string) => {
        steps.push(`list ${bucket}/${folder}`);
        return result("list", failAt === "list" ? null : files);
      },
      remove: async (paths: string[]) => {
        steps.push(`remove ${paths.join(",")}`);
        return result("remove");
      },
    }),
  },
  auth: {
    admin: {
      deleteUser: async (id: string) => {
        steps.push(`deleteUser ${id}`);
        return result("deleteUser");
      },
    },
  },
};
const userClient = {
  auth: {
    signOut: async (options: { scope: string }) => {
      steps.push(`signOut ${options.scope}`);
      return { error: null };
    },
  },
};

vi.mock("@/lib/dal", () => ({ getUserClient: async () => ({ user: USER, supabase: userClient }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    steps.push(`redirect ${url}`);
    throw new Error("NEXT_REDIRECT");
  },
}));

const { deleteAccount } = await import("@/lib/actions/account");
const confirm = (value: string) => {
  const data = new FormData();
  data.set("confirm", value);
  return data;
};

beforeEach(() => {
  steps.length = 0;
  files = [{ name: "original.docx" }];
  failAt = null;
});

describe("deleteAccount", () => {
  it("removes the CV files, then the user, then signs out locally and goes to the login page", async () => {
    await expect(deleteAccount({ ok: false }, confirm("  sara@example.COM "))).rejects.toThrow("NEXT_REDIRECT");
    expect(steps).toEqual([
      `list cvs/${USER.id}`,
      `remove ${USER.id}/original.docx`,
      `deleteUser ${USER.id}`,
      "signOut local",
      "redirect /login?deleted=1",
    ]);
  });

  it("skips file removal when there are no files", async () => {
    files = [];
    await expect(deleteAccount({ ok: false }, confirm(USER.email))).rejects.toThrow("NEXT_REDIRECT");
    expect(steps).not.toContainEqual(expect.stringMatching(/^remove/));
    expect(steps).toContain(`deleteUser ${USER.id}`);
  });

  it("does nothing unless the typed email matches", async () => {
    expect(await deleteAccount({ ok: false }, confirm("someone@else.com"))).toEqual({ ok: false, error: "confirmMismatch" });
    expect(await deleteAccount({ ok: false }, confirm(""))).toEqual({ ok: false, error: "confirmMismatch" });
    expect(steps).toEqual([]);
  });

  it.each(["list", "remove"])("stops before deleting the user when %s fails", async (step) => {
    failAt = step;
    expect(await deleteAccount({ ok: false }, confirm(USER.email))).toEqual({ ok: false, error: "generic" });
    expect(steps).not.toContainEqual(expect.stringMatching(/^deleteUser/));
  });

  it("stays signed in when the user can't be deleted", async () => {
    failAt = "deleteUser";
    expect(await deleteAccount({ ok: false }, confirm(USER.email))).toEqual({ ok: false, error: "generic" });
    expect(steps).not.toContain("signOut local");
  });
});
