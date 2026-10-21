import { NextResponse } from "next/server";
import { getUser } from "@/lib/dal";
import { disconnectMailbox } from "@/lib/email/service";

/** Disconnect Outlook: deletes its stored token and its pending suggestions. Jobs already added stay. */
export async function DELETE() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  await disconnectMailbox(user.id, "outlook");
  return NextResponse.json({ ok: true });
}
