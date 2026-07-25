# Plan: Random-from-source + Landscape UI

Two features. Decisions already made (see each section).

## Feature 1 — Random problems from a source

We already have "Random" per quiz; this is the same idea across an entire source.

**Data.** Every `Problem` carries a `source` FK (`types.ts`), so "all problems in a
source" = `catalog.problems.filter(p => p.source === sourceSlug)`. Cleaner than
unioning the source's quizzes, and also catches problems not yet attached to any
quiz. (Alternative if we'd rather mirror exactly what's in the quizzes: union of
the source's `quizzes[].problemSlugs`. We chose the FK filter.)

**Decision:** entry point lives in the **quizzes-page header** (the `QuizList`
view for a source), not on the top-level source rows.

### Steps
1. **`App.tsx`** — generalize the running state so it isn't quiz-bound. Add a
   `run` shape (or make the `quiz` variant carry `{ label, order }` directly);
   route quiz-start and source-start through one renderer. The quiz runner
   already looks a problem up purely by `nav.order[nav.index]` — it only needs
   the quiz for the header *title*. Add
   `startSourceRandom(sourceSlug)` =
   `shuffle(catalog.problems.filter(p => p.source === sourceSlug).map(p => p.slug))`,
   header label like `"<Source title> · random #<n>"`, Home → sources. Reuse the
   existing `shuffle()` in `App.tsx`.
2. **`QuizList.tsx`** — a header button above the list:
   **"🎲 Random — all N problems"** (N = count of problems in the source),
   disabled if 0. Pass the source title + problem count down from `App`.
3. **Test** — an e2e that opens a source, clicks Random, walks Prev/Next.

Small — ~2 files.

## Feature 2 — Landscape alternate UI

An alternate landscape-oriented layout (à la BridgeBase's handviewer). Instead of
card faces, render just the **values**, spaced out so they're easy to tap.

Layout (per the mockup, `scratchpad/landscape-mockup.html`):
- Auction grid **top-left**; vulnerability / board info **top-right** (swapped
  from BBO so the auction is on the left).
- North nudged **left** of center, South nudged **right** — freeing space to
  stretch out the card values.
- Bid-entry pad **bottom-left** (the room freed by shifting South right).
- Contract / status **bottom-right**. West/East on the side rails.

**Decisions:**
- **Trigger:** manual toggle (a `⤢` button), works on desktop too — not just
  auto-by-orientation.
- **Scope:** both phases (auction/entry AND play/study) in the first pass.

### Steps
1. **Shared logic hooks** — lift phase logic out of the portrait components so
   both layouts share one source of truth (this is the crux + main risk):
   - `useAuction(problem, answers, …)` from `AuctionPanel.tsx` — answer checking,
     keyboard, popup, legality / bid-pad state.
   - `usePlayEngine(…)` from `PlayView.tsx` — the `moveIndex` stepper,
     pending/review states, dummy reveal, all-revealed.
   Portrait components refactor to consume these; behavior unchanged, guarded by
   existing unit/component tests.
2. **`HandText.tsx`** — new presentational hand: S-H-C-D rows, `SuitGlyph` +
   spaced tappable ranks; same `onPlay` / `canPlay` / `selectedCard` contract as
   `Hand.tsx`, so it's a drop-in.
3. **`LandscapeTable.tsx`** — the 3×3 diamond shell with four corner slots
   (auction TL, info TR, bid pad BL, contract/status BR), N nudged left, S nudged
   right.
4. **Landscape auction + play presentations** — thin components rendering
   `HandText` + `LandscapeTable` and driving the shared hooks (bid pad in BL
   during the auction; center trick + prompt during play).
5. **Toggle** — a `layout: 'portrait' | 'landscape'` state in `App.tsx` (persisted
   to `localStorage`), a `⤢` button in the quiz header; `ProblemView` picks the
   shell. Landscape also supersedes the "rotate your phone" note.
6. **CSS** — new `.landscape` block in `index.css`; portrait untouched.
7. **Verify in real Safari** — per the CLAUDE.md track-sizing trap (Playwright
   WebKit won't catch it); plus a `PlayView`-style test guarding the
   W/E-under-the-right-hand mapping in the landscape geometry.

Bigger — the hook refactor (step 1) is the crux; the rest is presentation.

### Open / to react to on the mockup
Proportions, exact bid-pad placement, hand-box styling vs. bare-on-felt, and
dummy-as-a-side-rail when the hero is a defender (the two can't both hold —
dummy is adjacent to a defender, not across).
