import type { Metadata } from "next";
import { DeleteAccount } from "@/components/delete-account";
import { EmailSettings } from "@/components/email/email-settings";
import { ProfileForm } from "@/components/profile-form";
import { availableMailProviders, getConnections } from "@/lib/email/service";
import { UsageCard } from "@/components/usage-card";
import { getUsage } from "@/lib/rate-limit";
import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { getProfile, requireUser } from "@/lib/dal";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.nav.profile };
}

export default async function ProfilePage({ searchParams }: PageProps<"/profile">) {
  const user = await requireUser();
  const [{ d }, profile, connections, usage] = await Promise.all([getI18n(), getProfile(), getConnections(user.id), getUsage(user)]);
  const flash = (await searchParams).email;
  const available = availableMailProviders();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <Breadcrumbs label={d.nav.breadcrumb} items={[{ label: d.dashboard.title, href: "/dashboard" }, { label: d.nav.profile }]} />
      <PageHeader title={d.profile.title} subtitle={d.profile.subtitle} />
      <Card className="p-6 sm:p-10">
        <ProfileForm profile={profile ?? { id: user.id, name: null, cv_text: null }} email={user.email ?? ""} />
      </Card>
      <UsageCard usage={usage} d={d} />
      {/* Hidden when no mailbox can be connected on this server (and none is connected). */}
      {(available.length > 0 || connections.length > 0) && (
        <EmailSettings connections={connections} available={available} flash={typeof flash === "string" ? flash : undefined} />
      )}
      {user.email && <DeleteAccount email={user.email} />}
    </div>
  );
}
