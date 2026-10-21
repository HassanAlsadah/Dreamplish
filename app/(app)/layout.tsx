import { Suspense } from "react";
import { AccountMenu } from "@/components/layout/account-menu";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { AddJobLink } from "@/components/layout/add-job-link";
import { TopBar } from "@/components/layout/top-bar";
import { FlashToast } from "@/components/ui/toast";
import { getProfile, requireUser } from "@/lib/dal";
import { getI18n } from "@/lib/i18n/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const [{ locale, d }, profile] = await Promise.all([getI18n(), getProfile()]);
  const name = profile?.name || user.email || "";

  return (
    <>
      <SkipLink label={d.nav.skipToContent} />
      <TopBar
        locale={locale}
        logoHref="/dashboard"
        logoLabel={`Dreamplish — ${d.nav.dashboard}`}
        // One way to each place: the logo goes home, Add job is here, Profile is in the avatar menu.
        action={<AddJobLink label={d.nav.addJob} />}
        account={<AccountMenu name={name} email={user.email ?? null} />}
      />
      <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pt-8 pb-16 outline-none sm:px-6 lg:px-8">{children}</main>
      <SiteFooter d={d} />
      <Suspense>
        <FlashToast />
      </Suspense>
    </>
  );
}
