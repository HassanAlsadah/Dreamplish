# 7. Metrics

> **Planned targets, not achieved results.** Dreamplish has just launched and has no usage data yet.

## North Star

**Prepared applications per week:** the number of applications where the user generated a company briefing or interview prep. It captures the core promise: not just tracking, but walking in prepared.

## Supporting KPIs

| KPI | Definition | Target (planned) |
|---|---|---|
| Activation | New users who add a job **and** open a briefing or match in their first session | `TODO: set after first 50 users` |
| Week-4 retention | Users still active four weeks after sign-up | `TODO` |
| Fit-to-apply rate | Check-my-fit drafts that become "I applied" | `TODO` |
| Briefing success | Briefings that finish with sourced content (vs. failed or empty) | ≥ 90% |
| Reply rate tracked | Share of applications whose outcome (reply / rejection / offer) gets recorded | `TODO` |

## How they'd be measured

Dreamplish has **no analytics or tracking scripts** by design (see the privacy policy). Every KPI above can be computed from data the app already stores, as aggregate database queries with no personal profiling:

- applications and status changes: `jobs`, `job_status_history`
- briefings: `brief_requests`, `company_briefs` (status)
- AI tool use: `ai_requests`
- drafts and applying: status changes from Saved to Application

`TODO: build a small private metrics page (owner only) running these aggregate queries.`
