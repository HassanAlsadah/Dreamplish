import { render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, it } from "vitest";
import { Input } from "@/components/ui/field";
import { useFocusFirstError } from "@/components/ui/use-focus-first-error";
import type { ActionState } from "@/lib/types";

function Form({ state }: { state: ActionState }) {
  const ref = useRef<HTMLFormElement>(null);
  useFocusFirstError(ref, state);
  return (
    <form ref={ref}>
      <Input aria-label="company" invalid={false} />
      <Input aria-label="title" invalid={!!state.fieldErrors?.title} />
      <Input aria-label="link" invalid={!!state.fieldErrors?.link} />
    </form>
  );
}

describe("form accessibility", () => {
  it("focuses the first invalid field after a failed submit", () => {
    const { rerender } = render(<Form state={{ ok: false }} />);
    expect(document.activeElement).toBe(document.body);
    rerender(<Form state={{ ok: false, error: "fixFields", fieldErrors: { title: "required", link: "invalidUrl" } }} />);
    expect(document.activeElement).toBe(screen.getByLabelText("title"));
  });

  it("turns autocomplete off by default but keeps a sign-in field's own value, and skips spellcheck on links", () => {
    render(
      <>
        <Input aria-label="role" />
        <Input aria-label="email" type="email" autoComplete="email" />
        <Input aria-label="url" type="url" />
      </>,
    );
    expect(screen.getByLabelText("role")).toHaveAttribute("autocomplete", "off");
    expect(screen.getByLabelText("email")).toHaveAttribute("autocomplete", "email");
    expect(screen.getByLabelText("email")).toHaveAttribute("spellcheck", "false");
    expect(screen.getByLabelText("url")).toHaveAttribute("spellcheck", "false");
  });
});
