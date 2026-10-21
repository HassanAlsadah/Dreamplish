# 8. Decisions log

Short records of the key trade-offs: the context, the decision, and what it costs.

### 1. Near-zero-cost stack
- **Context:** A free product can't carry monthly bills before it has users.
- **Decision:** Supabase free tier (database, auth, storage), Vercel Hobby, Gemini Flash (free tier), Tavily (1,000 free searches a month).
- **Consequence:** Strict per-user limits and a shared monthly cap on briefings; some features wait for paid tiers.

### 2. No LinkedIn or Glassdoor scraping
- **Context:** Job descriptions and company data are most convenient there.
- **Decision:** Never read LinkedIn or Glassdoor pages. Descriptions come from the company's own careers page or hiring system; research uses search APIs and public sources.
- **Consequence:** Some descriptions must be pasted by hand. Legally and ethically clean.

### 3. Arabic and right-to-left from day one
- **Context:** The first users are in Saudi Arabia; retrofitting RTL later is expensive.
- **Decision:** Every screen is built in both languages with logical (start/end) layout; accessibility was audited before launch.
- **Consequence:** Every string is written twice; layout is checked in both directions.

### 4. AI that can't guess
- **Context:** Generic AI summaries invent facts, which is dangerous before an interview.
- **Decision:** The model may only cite numbered search results; every claim links to a source; empty sections say so. Match scores are computed by the app, not the model.
- **Consequence:** Briefings are sometimes thinner, but trustworthy.

### 5. CV privacy before AI
- **Context:** On Gemini's free tier, Google may use content to improve its products.
- **Decision:** Names, emails, phone numbers and links are removed from CVs before they reach the AI and restored afterwards; the privacy policy says this plainly.
- **Consequence:** Slight extra processing; much lower privacy risk.

### 6. Gmail switched off in production
- **Context:** Google's policy for apps that read Gmail forbids sending Gmail data to services that may use it to improve AI models.
- **Decision:** Keep the Gmail integration in code but offer only Outlook until the AI runs on a paid tier.
- **Consequence:** Gmail users wait; the app stays within Google's rules.

### 7. Google sign-in only
- **Context:** Password accounts need confirmation emails, an email provider and reset flows.
- **Decision:** Google is the only way in; the first sign-in creates the account. The OAuth flow runs on Dreamplish's own domain so Google's screen names the site.
- **Consequence:** Users without a Google account can't sign up (a small minority of the target users).

### 8. Usage limits and a shared cap
- **Context:** One heavy user could exhaust the shared free search quota for everyone.
- **Decision:** Per-user daily limits shown on the profile page, plus a monthly cap that pauses only new briefings.
- **Consequence:** Fair access for all; power users may hit limits.
