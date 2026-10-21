import { Briefcase, Newspaper, Sparkles } from "lucide-react";
import { JourneyRibbon } from "@/components/landing/journey-ribbon";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getUser } from "@/lib/dal";
import { getI18n } from "@/lib/i18n/server";

export default async function LandingPage() {
  const [{ d }, user] = await Promise.all([getI18n(), getUser()]);

  // Each feature wears the colour of the stage it helps with.
  const features = [
    { icon: Briefcase, title: d.landing.f1Title, body: d.landing.f1Body, tint: "var(--status-applied)" },
    { icon: Newspaper, title: d.landing.f2Title, body: d.landing.f2Body, tint: "var(--status-assessment)" },
    { icon: Sparkles, title: d.landing.f3Title, body: d.landing.f3Body, tint: "var(--status-offer)" },
  ];

  return (
    <div className="relative isolate overflow-hidden">
      {/* The one place with an atmospheric gradient: a soft dawn glow behind the headline. */}
      <div aria-hidden className="landing-glow pointer-events-none absolute inset-x-0 -top-40 -z-10 h-[38rem]" />

      <div className="mx-auto max-w-5xl px-4 pt-16 pb-20 sm:px-6 sm:pt-24">
        <section className="text-center">
          <h1 className="font-display text-5xl leading-[1.05] font-bold tracking-tight text-balance sm:text-7xl">{d.landing.heroTitle}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty text-muted">{d.landing.heroSubtitle}</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            {user ? (
              <ButtonLink href="/dashboard" size="lg" variant="dawn" className="w-full sm:w-auto">
                {d.landing.ctaDashboard}
              </ButtonLink>
            ) : (
              <ButtonLink href="/login" size="lg" variant="dawn" className="w-full sm:w-auto">
                {d.landing.ctaPrimary}
              </ButtonLink>
            )}
          </div>
        </section>

        <JourneyRibbon
          label={d.landing.journeyLabel}
          steps={[
            { status: "saved", label: d.status.saved },
            { status: "applied", label: d.status.applied },
            { status: "interview", label: d.status.interview },
            { status: "offer", label: d.status.offer },
          ]}
        />

        <section className="stagger-children mt-16 grid gap-4 sm:grid-cols-3">
          {features.map(({ icon: Icon, title, body, tint }) => (
            <Card key={title} className="p-6">
              <span
                aria-hidden
                className="flex size-11 items-center justify-center rounded-2xl"
                style={{ background: `color-mix(in oklab, ${tint} 14%, var(--surface))`, color: tint }}
              >
                <Icon className="size-5" />
              </span>
              <h2 className="mt-4 font-display text-lg font-semibold">{title}</h2>
              <p className="mt-1.5 leading-relaxed text-pretty text-muted">{body}</p>
            </Card>
          ))}
        </section>
      </div>
    </div>
  );
}
