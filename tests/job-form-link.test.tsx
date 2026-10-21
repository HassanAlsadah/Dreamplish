import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { JobForm } from "@/components/jobs/job-form";
import { getDescriptionFromLink } from "@/lib/actions/description";
import { I18nProvider } from "@/lib/i18n/client";
import { coreStages } from "./fixtures";

vi.mock("@/lib/actions/description", () => ({ getDescriptionFromLink: vi.fn() }));
const lookup = vi.mocked(getDescriptionFromLink);
const LINK = "https://careers.deliveryhero.com/job/product-operations-senior-specialist-jid-5731";

function renderForm() {
  render(
    <I18nProvider locale="en">
      <JobForm action={async () => ({ ok: false })} today="2026-10-17" stages={coreStages()} />
    </I18nProvider>,
  );
  return {
    link: screen.getByLabelText(/^Job link/) as HTMLInputElement,
    description: screen.getByLabelText(/^Job description/) as HTMLTextAreaElement,
    title: screen.getByLabelText(/^Role/) as HTMLInputElement,
  };
}

describe("job form: description from a pasted link", () => {
  it("fills the empty description (and role) automatically", async () => {
    lookup.mockResolvedValueOnce({ status: "found", description: `Source: ${LINK}\\n\\nAbout the opportunity…`, title: "Product Operations Senior Specialist", company: "Delivery Hero" });
    const { link, description, title } = renderForm();
    fireEvent.change(link, { target: { value: LINK } });
    fireEvent.blur(link);
    await waitFor(() => expect(description.value).toContain("About the opportunity"));
    expect(title.value).toBe("Product Operations Senior Specialist");
    expect(screen.getByRole("status")).toHaveTextContent("Description added from careers.deliveryhero.com");
  });

  it("explains when a LinkedIn link can't be read, and never overwrites a typed description", async () => {
    lookup.mockResolvedValueOnce({ status: "never_read" });
    const { link, description } = renderForm();
    fireEvent.change(link, { target: { value: "https://www.linkedin.com/jobs/view/4012345678/" } });
    fireEvent.blur(link);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(/LinkedIn and Glassdoor pages aren't read/));

    lookup.mockClear();
    fireEvent.change(description, { target: { value: "My own notes" } });
    fireEvent.change(link, { target: { value: LINK } });
    fireEvent.blur(link);
    expect(lookup).not.toHaveBeenCalled();
    expect(description.value).toBe("My own notes");
  });
});

describe("job form: saved description", () => {
  const job = {
    id: "00000000-0000-0000-0000-000000000001",
    title: "Frontend Engineer",
    link: null,
    status: "applied",
    date_applied: "2026-10-01",
    notes: null,
    job_description: "About us\n- Build the web app\n- Review code",
    position: 0,
    created_at: "2026-10-01T00:00:00Z",
    updated_at: "2026-10-01T00:00:00Z",
    company: { id: "c1", name: "Aramco", website: null },
    stage_id: null,
    stage_detail: null,
    applied_via: null,
    applied_via_detail: null,
  } as const;

  it("shows a saved description as a document, with Edit bringing back the text box", () => {
    const { container } = render(
      <I18nProvider locale="en">
        <JobForm action={async () => ({ ok: false })} job={{ ...job }} today="2026-10-17" stages={coreStages()} />
      </I18nProvider>,
    );
    expect(screen.queryByLabelText(/^Job description/)).toBeNull();
    expect(screen.getByRole("heading", { name: "About us" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Build the web app", "Review code"]);
    // The saved text is still submitted with the form.
    expect((container.querySelector('input[name="jobDescription"]') as HTMLInputElement).value).toBe(job.job_description);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByLabelText(/^Job description/) as HTMLTextAreaElement).value).toBe(job.job_description);
  });
});
