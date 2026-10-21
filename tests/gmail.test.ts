import { describe, expect, it } from "vitest";
import { GMAIL_PREFIX, parseAddress, toMessage } from "@/lib/email/gmail";

describe("Gmail messages", () => {
  it("parses addresses with and without names", () => {
    expect(parseAddress('"LinkedIn" <jobs-noreply@linkedin.com>')).toEqual({ name: "LinkedIn", address: "jobs-noreply@linkedin.com" });
    expect(parseAddress("HR Team <hr@acme.com>, Other <x@y.com>")).toEqual({ name: "HR Team", address: "hr@acme.com" });
    expect(parseAddress("careers@hungerstation.com")).toEqual({ address: "careers@hungerstation.com" });
    expect(parseAddress(undefined)).toEqual({});
  });

  it("turns a Gmail message into the shared shape", () => {
    const m = toMessage(
      {
        id: "18f2a9c",
        snippet: "Thank you for applying &#39;Data Analyst&#39;",
        internalDate: String(Date.parse("2026-10-16T09:00:00Z")),
        labelIds: ["INBOX", "CATEGORY_UPDATES"],
        payload: {
          headers: [
            { name: "Subject", value: "Thank you for applying to HungerStation" },
            { name: "From", value: "HungerStation <careers@hungerstation.com>" },
            { name: "To", value: "Hassan <me@gmail.com>" },
          ],
        },
      },
      "me@gmail.com",
    );
    expect(m.id).toBe(`${GMAIL_PREFIX}18f2a9c`);
    expect(m.subject).toBe("Thank you for applying to HungerStation");
    expect(m.bodyPreview).toBe("Thank you for applying 'Data Analyst'");
    expect(m.receivedDateTime).toBe("2026-10-16T09:00:00.000Z");
    expect(m.from?.emailAddress).toEqual({ name: "HungerStation", address: "careers@hungerstation.com" });
    expect(m.toRecipients?.[0].emailAddress?.address).toBe("me@gmail.com");
    expect(m.webLink).toBe("https://mail.google.com/mail/?authuser=me%40gmail.com#all/18f2a9c");
  });
});
