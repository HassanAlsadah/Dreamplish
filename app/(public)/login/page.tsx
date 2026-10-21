import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-forms";
import { Alert } from "@/components/ui/alert";
import { getI18n } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const { d } = await getI18n();
  return { title: d.nav.login };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, deleted } = await searchParams;
  const { d } = await getI18n();
  return (
    <>
      {error && (
        <div className="mx-auto max-w-md px-4 pt-8">
          <Alert>{d.auth.oauthFailed}</Alert>
        </div>
      )}
      {deleted === "1" && (
        <div className="mx-auto max-w-md px-4 pt-8">
          <Alert tone="success">{d.account.deleted}</Alert>
        </div>
      )}
      <AuthCard />
    </>
  );
}
