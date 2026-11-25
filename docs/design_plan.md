# Design plan

Visual and usability improvements for the site that haven't been done yet. They come from a review of the
live site (https://il-seminars.pages.dev) on 2026-11-25, at laptop and phone width and in dark mode, with
the data counts checked against `public/seminars.json` (207 talks at the time).

Already done in that review (commit `3360f89`): talks are ordered by time within a day, long locations end
in "…" inside the card, and the "·" after the speaker only shows when there is an affiliation.

Suggested order: 1 (day headings), then 2 and 3 (phone layout), then the rest.

---

## 1. Day headings, light and only when useful

**Problem.** All talks sit in one long grid; the date appears only in small text inside each card. With no
filters, days are busy: the median is 3 talks a day, and over the next two weeks it was 9, with 2–16 talks on
every day.

**Concern (raised by the user).** When there is only one talk per day, a heading above every card is
overkill. That is the usual case once a filter is applied:

| What's shown | Talks per day (median) | Days with only one talk |
|---|---|---|
| Everything, no filters | 3 (next two weeks: 9) | 11 of 47 |
| Weizmann only | 1 | 27 of 35 |
| BGU only | 1 | 17 of 19 |
| Physics only | 1 | 12 of 23 |
| Colloquia only | 1 | 19 of 29 |

**Proposal.** A thin date line ("Thu 26 Nov", with "Today" / "Tomorrow" where they apply) rather than a big
heading, shown only when the visible list averages two or more talks per day. A filtered list stays a plain
grid with the date on each card.

**Where:** `src/pages/Index.tsx` (group the filtered list by `date` before rendering the grid).

**Status:** not decided — the adaptive rule needs the user's OK.

## 2. Shorter header

**Problem.** On a phone (375 px wide) the header and the filter box fill the whole first screen; no talk is
visible without scrolling. On a laptop they take about half the screen.

**Proposal.** Less vertical padding in the header (`py-16 sm:py-20` in `src/pages/Index.tsx`), a smaller
title on phones, and the two buttons ("Suggest a seminar series", "View on GitHub") as smaller links.

## 3. Tidy filters on phones

**Problem.** On a phone the three dropdowns have different widths and wrap onto ragged rows, with the "Has
Zoom" and "Today" buttons scattered between them.

**Proposal.** Either a two-column grid of equal-width controls, or a single "Filters" button that opens them.
The grid is simpler. **Where:** `src/components/FilterBar.tsx` (`flex flex-wrap gap-3` row).

## 4. Day-first dates

**Problem.** Cards show "Wed, Nov 25" (US order); Israeli readers expect "Wed 25 Nov".

**Proposal.** Change the `date-fns` format in `src/components/SeminarCard.tsx` from `"EEE, MMM d"` to
`"EEE d MMM"`.

## 5. Better cards for talks without a title yet

**Problem.** 56 of 207 talks had the title "TBA", which shows as a large "TBA" heading. (10 talks had no
speaker either; those would keep "TBA".)

**Proposal.** When the title is "TBA", use the seminar and speaker as the heading — e.g. "Number Theory
Seminar — Roei Raveh" — with a muted "Title to be announced" line under it. **Where:** `SeminarCard.tsx`.

## 6. Don't offer filter options with no talks

**Problem.** The subject filter lists Engineering, Philosophy and Economics, but no talks have those subjects,
so choosing one shows an empty page. (Talks per subject at review time: Mathematics 118, Physics 36,
Biology 22, Computer Science 18, Chemistry 9; plus 4 "Natural Sciences" Weizmann talks that have no filter
option and only appear under "All".)

**Proposal.** Build the university and subject options from the loaded data, showing a count for each, e.g.
"Mathematics (118)". **Where:** `src/components/FilterBar.tsx`, `src/data/seminars.ts`.

## 7. Dark mode (optional)

**Problem.** The site is always light, even when the device is set to dark. Tailwind is already set up for a
`dark` class (`darkMode: ["class"]` in `tailwind.config.ts`), but `src/index.css` defines no dark colour values.

**Proposal.** Add dark values for the colour variables in `src/index.css` and switch on the device setting.

## 8. "This week" quick filter (optional)

**Proposal.** A toggle next to "Today" showing talks from today through the next seven days.
**Where:** `src/pages/Index.tsx`, `src/components/FilterBar.tsx`.
