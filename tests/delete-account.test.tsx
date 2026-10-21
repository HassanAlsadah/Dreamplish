import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteAccount } from "@/components/delete-account";
import { I18nProvider } from "@/lib/i18n/client";

vi.mock("@/lib/actions/account", () => ({ deleteAccount: vi.fn(async () => ({ ok: false })) }));

describe("DeleteAccount", () => {
  it("only enables the final delete once the account's email is typed (any case)", () => {
    render(
      <I18nProvider locale="en">
        <DeleteAccount email="sara@example.com" />
      </I18nProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
    const confirmButton = screen.getByRole("button", { name: "Delete everything" });
    const input = screen.getByLabelText("Type sara@example.com to confirm");
    expect(confirmButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "sara@example.co" } });
    expect(confirmButton).toBeDisabled();
    fireEvent.change(input, { target: { value: "Sara@Example.com" } });
    expect(confirmButton).toBeEnabled();
  });
});
