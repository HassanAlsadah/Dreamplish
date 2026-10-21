import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ErrorView } from "@/components/error-view";
import { I18nProvider } from "@/lib/i18n/client";
import GlobalError from "@/app/global-error";

const failure = Object.assign(new Error("db down"), { digest: "1234567" });

describe("error pages", () => {
  it("shows a translated message, the reference for the server log, and retries", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(
      <I18nProvider locale="ar">
        <ErrorView error={failure} retry={retry} />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading")).toHaveTextContent("صار خطأ");
    expect(screen.getByText("Ref: 1234567")).toBeInTheDocument();
    expect(screen.queryByText("db down")).toBeNull(); // the raw message is never shown
    fireEvent.click(screen.getByRole("button"));
    expect(retry).toHaveBeenCalledOnce();
  });

  it("the last-resort page works without the app's providers, in both languages", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const retry = vi.fn();
    render(<GlobalError error={failure} retry={retry} />, { container: document.documentElement });
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/صار خطأ غير متوقع/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Try again/ }));
    expect(retry).toHaveBeenCalledOnce();
  });
});
