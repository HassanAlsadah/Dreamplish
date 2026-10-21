import { NavPills } from "@/components/layout/nav-pills";
import { SiteFooter } from "@/components/layout/site-footer";
import { SkipLink } from "@/components/layout/skip-link";
import { TopBar } from "@/components/layout/top-bar";
import { getUser } from "@/lib/dal";
import { getI18n } from "@/lib/i18n/server";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const [{ locale, d }, user] = await Promise.all([getI18n(), getUser()]);
  const items = user
    ? [{ href: "/dashboard", label: d.nav.dashboard }]
    : [{ href: "/login", label: d.nav.login }];

  return (
    <>
      <SkipLink label={d.nav.skipToContent} />
      <TopBar locale={locale} nav={<NavPills items={items} label={d.nav.mainNav} />} />
      <main id="main" tabIndex={-1} className="flex-1 outline-none">{children}</main>
      <SiteFooter d={d} />
    </>
  );
}
