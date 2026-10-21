# Deploying Dreamplish

A step-by-step guide to running Dreamplish in production: a Supabase project for the database and sign-in, and Vercel for the app. Work through the sections in order; the checklist at the end confirms everything works.

You need accounts at [Supabase](https://supabase.com), [Vercel](https://vercel.com) and Google ([Cloud Console](https://console.cloud.google.com) for sign-in, [AI Studio](https://aistudio.google.com) for Gemini). Outlook is optional.

> Limits and terms below were checked in October 2026 against each provider's documentation (linked). Providers change them; check the linked pages when you set up.

## 1. Supabase (database and sign-in)

1. **Create a project** in the region closest to your users (it can't be moved later).
2. **Create the database:** SQL Editor → paste all of [`supabase/schema.sql`](../supabase/schema.sql) → **Run**. It creates every table, security rule, function and the private `cvs` storage bucket. Run it once, on the empty project.
3. **Authentication → URL Configuration**
   - Site URL: `https://<your-domain>`
4. **Google sign-in (required: it's the only way to sign in):** follow *Google sign-in* in the [technical guide](TECHNICAL.md#google-sign-in) with your production domain: authorized JavaScript origin `https://<your-domain>`, redirect URI `https://<your-domain>/api/auth/google/callback`, and `<your-domain>` as an authorized domain. Enable Google in Supabase with the same client. Then **Audience → Publish app**. With only the basic scopes (email, profile) Google doesn't require a review.
5. **Turn the Email provider off** (Authentication → Sign In / Providers → Email), so nobody can create a password account outside the app. The app sends no emails, so no email provider (SMTP) is needed.

Google's screen names your domain, because the app runs the sign-in itself. To show the name "Dreamplish" and a logo, request brand verification (Google Auth Platform → Branding); you'll prove you own the domain in Google Search Console.

Keep the project's **Project URL**, **publishable key** and **secret key** (Project Settings → API Keys) for step 2.

### Upgrading a database created before October 2026

If your database came from the older migration files, run this once so it matches `schema.sql` (allows the new rate limits, and stops signed-in users calling two internal helpers):

```sql
alter table public.ai_requests drop constraint ai_requests_kind_check;
alter table public.ai_requests add constraint ai_requests_kind_check
  check (kind in ('analyze', 'tailor', 'prep', 'email_sync', 'email_reread', 'find_description', 'link_lookup'));
revoke all on function public.stage_label(uuid) from authenticated;
revoke all on function public.application_row(uuid) from authenticated;
```

## 2. Vercel (the app)

1. **Import the GitHub repository** in Vercel (framework: Next.js; no build settings to change).
2. **Function region:** Project Settings → Functions → choose the region nearest your Supabase project. Every page talks to the database, so this matters more than anything else for speed.
3. **Environment variables** (Project Settings → Environment Variables, for *Production*):

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |
   | `NEXT_PUBLIC_SITE_URL` | `https://<your-domain>`, no trailing slash. **Required:** Google sign-in's return address, the social preview and the sitemap use it. |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | The Google sign-in client (step 1.4). |
   | `SUPABASE_SECRET_KEY` | Supabase secret key. Server only: workers, email sync, rate limits, account deletion. |
   | `WORKER_SECRET` | `openssl rand -hex 32` |
   | `EMAIL_TOKEN_KEY` | `openssl rand -hex 32` (needed only for Outlook / Gmail) |
   | `AI_PROVIDER` | `tavily` or `gemini` (see section 4); `mock` shows sample briefings |
   | `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL` | See section 4 |
   | `TAVILY_API_KEY` | For `AI_PROVIDER=tavily` and job-description search |
   | `AI_DAILY_LIMIT`, `BRIEFS_DAILY_LIMIT` | Per-user daily limits (defaults 30 and 10) |
   | `OUTLOOK_*`, `GMAIL_*` | Only if you offer that mailbox (section 5) |

   `NEXT_PUBLIC_*` values are built into the app: after changing one, **redeploy**. Generate secrets fresh for production; never reuse the local ones.
4. **Deploy**, then add your domain under Project Settings → Domains.

**Which Vercel plan?** The AI tools, the email sync and the workers can run for up to 5 minutes. That is [the maximum on the Hobby plan](https://vercel.com/docs/functions/limitations) (Pro allows longer), so Hobby works technically. Hobby is meant for personal, non-commercial projects; use Pro for a commercial launch.

## 3. Scheduled jobs

Briefings start straight after the click and the inbox is checked when the dashboard opens, so nothing is required. To retry stalled briefings and check every mailbox hourly, schedule the two worker routes from Supabase (Vercel's Hobby plan only allows daily cron jobs). Follow *Scheduled jobs in production* in the [technical guide](TECHNICAL.md#scheduled-jobs-in-production-optional), using your domain and `WORKER_SECRET`.

## 4. AI and search

- **Gemini key:** create it in [Google AI Studio](https://aistudio.google.com/apikey) **in a Google Cloud project with an active billing account**. On the free tier, [Google may use prompts and responses to improve its products](https://ai.google.dev/gemini-api/terms), and people's CVs and job emails pass through Gemini. With billing linked, the key counts as a paid service and they aren't used that way. Avoid models offered at a discount in exchange for data use.
- **Provider:** `tavily` (Tavily search, Gemini writes from the results) or `gemini` (Gemini's own Google Search; needs billing). Tavily's free plan has 1,000 searches a month; *Find job description* uses it too.
- **Costs:** every user's AI use is capped by `AI_DAILY_LIMIT` and `BRIEFS_DAILY_LIMIT`, plus fixed limits on email sync and searches (see *Security* in the [technical guide](TECHNICAL.md)). Set a budget alert on the Google Cloud billing account.

## 5. Email integrations (optional)

Leave the `OUTLOOK_*` / `GMAIL_*` variables empty to launch without them. The Connect button still shows on the profile page and reports that the integration isn't set up yet.

- **Outlook:** follow *Outlook email integration* in the [technical guide](TECHNICAL.md#outlook-email-integration-optional) and add `https://<your-domain>/api/email/outlook/callback` as a redirect URI. It signs in with personal Microsoft accounts (Outlook.com, Hotmail), not work or school accounts.
- **Gmail: plan for Google's review before offering it publicly.** Reading mail uses `gmail.readonly`, a [restricted scope](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification). Until Google verifies the app, **at most 100 people can ever connect Gmail**, and they see an "unverified app" warning. Verification takes several weeks, and because Dreamplish stores data from emails on its servers it also needs a security assessment by a Google-approved third party, repeated every year. Until then, keep Gmail for testing, or launch without it.

## 6. After deploying: checklist

Run through this on the live site:

- [ ] Sign in with a Google account that hasn't used Dreamplish: it lands on an empty dashboard (the account is created).
- [ ] Add a job, drag it to another column, open it: the status history shows both changes.
- [ ] **Check my fit** with a real posting link: the description fills in, the match runs, and *I applied* moves it to the board.
- [ ] Generate a company briefing (it's real data, not the sample).
- [ ] Upload a CV on the profile page, then tailor a CV for a job.
- [ ] Connect a mailbox (if offered) and press *Sync now*.
- [ ] `curl -X POST https://<your-domain>/api/worker/briefs` answers `401` (no secret), and with `-H "Authorization: Bearer <WORKER_SECRET>"` answers `200`.
- [ ] The page's response headers include `Content-Security-Policy` and `Strict-Transport-Security` (browser dev tools → Network → the page request).
- [ ] Share the home page link in a chat app: the Dreamplish preview image appears.
- [ ] Delete the test account from the profile page.

## Keeping it running

- **Errors:** error pages show a short reference code; search for it in Vercel → Logs to find the server error.
- **Schema changes:** edit `supabase/schema.sql`, run the change in the SQL Editor, then `npm run db:types` (see the [technical guide](TECHNICAL.md)).
- **Secrets:** rotating `WORKER_SECRET` needs the scheduled jobs updated too. Changing `EMAIL_TOKEN_KEY` makes stored mailbox tokens unreadable: everyone has to reconnect their mailbox.
- **Backups:** check what your Supabase plan includes (Database → Backups) before real users rely on it.
