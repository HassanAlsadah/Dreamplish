# 4. Solution and lightweight PRD

**One line:** a job tracker that researches every company for you and helps you fit, apply and prepare.

## Goals

1. Put every application, its status and its history in one place.
2. Cut company research before an interview from hours to minutes, with sources.
3. Help users decide and tailor *before* applying, when it still changes the outcome.
4. Run at near-zero cost, so the product can stay free.

## Non-goals

- **No auto-apply.** Quality over volume; the user stays in control of what is sent.
- **No scraping LinkedIn or Glassdoor.** Their terms forbid it ([decision](08-decisions-log.md)).
- **Not a job board.** Users bring the jobs they care about.
- **No paid tier, ads or data selling** at this stage.

## User stories

| As a job seeker, I want to… | Acceptance criteria |
|---|---|
| **track every application on one board** | Add a job in under a minute; drag between columns; each move is recorded with a date; search and filter by column |
| **get a company briefing for a job** | One click generates it; every fact links to a source; it's reused for 7 days and shared across users tracking the same company; if a section has no reliable sources it says so instead of guessing |
| **check my fit before applying** | Paste a link and the description fills in when the page can be read; a match score with each requirement quoted from the posting and matched to quoted CV evidence; the job stays off the board until "I applied" |
| **tailor my CV for a job** | Uses only facts in my CV; changes are listed; any number not in the original is flagged; downloadable in my own Word design |
| **prepare for an interview** | Likely questions and talking points drawn from the job, my CV and the briefing |
| **let my inbox update my tracker** | Read-only connection; job emails become suggestions I accept or ignore; nothing changes without my approval |
| **use it in Arabic** | Every screen in Arabic with right-to-left layout, switchable at any time |

## MVP scope (shipped)

Tracker and board · status timeline · company briefings · Match & CV with skill check · tailored CV · interview prep · Check my fit · Outlook integration · insights panel · Arabic/English · Google sign-in · usage limits · privacy policy and account deletion.

## Out of scope for MVP

Gmail integration (built, switched off in production for policy reasons: see [decisions](08-decisions-log.md)), browser extension, cover letters, calendar sync, mobile apps.
