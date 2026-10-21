"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/lib/i18n/config";
import { getUserClient } from "@/lib/dal";

export async function setLocale(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Remember it on the profile too, so AI output can follow the user's language later.
  const session = await getUserClient();
  await session?.supabase.from("profiles").update({ locale }).eq("id", session.user.id);

  revalidatePath("/", "layout");
}
