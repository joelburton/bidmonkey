// The content repository: the app's single source of truth is Supabase. This
// fetches sources / quizzes / problems and maps the PostgREST rows onto the app
// types. (The static data/problems.ts + data/catalog.ts are no longer read at
// runtime — they are only the input to db/gen-seed.mjs and the test fixtures.)
import type {
  AuctionEntry,
  Deal,
  Problem,
  Quiz,
  Seat,
  Source,
  Trick,
  Vulnerability,
} from '../types'
import { sbSelect } from '../lib/supabase'

export interface Catalog {
  sources: Source[]
  quizzes: Quiz[]
  problems: Problem[]
}

interface ProblemRow {
  slug: string
  title: string | null
  source: string | null
  difficulty: number | null
  tags: string[] | null
  hero: Seat
  dealer: Seat
  vulnerability: Vulnerability | null
  deal: Deal
  auction: AuctionEntry[] | null
  play: Trick[] | null
  contract: string | null
  commentary: string | null
}

interface SourceRow {
  slug: string
  title: string
  cover_url: string | null
}

interface QuizRow {
  slug: string
  title: string
  source: string | null
  quizzes_problems: { problem_slug: string; ordinal: number }[] | null
}

const mapSource = (r: SourceRow): Source => ({
  slug: r.slug,
  title: r.title,
  coverUrl: r.cover_url ?? undefined,
})

const mapProblem = (r: ProblemRow): Problem => ({
  slug: r.slug,
  title: r.title ?? undefined,
  source: r.source ?? undefined,
  difficulty: r.difficulty ?? undefined,
  tags: r.tags ?? [],
  hero: r.hero,
  dealer: r.dealer,
  vulnerability: r.vulnerability ?? null,
  deal: r.deal,
  auction: r.auction ?? [],
  play: r.play ?? undefined,
  contract: r.contract ?? undefined,
  commentary: r.commentary ?? undefined,
})

const mapQuiz = (r: QuizRow): Quiz => ({
  slug: r.slug,
  title: r.title,
  source: r.source ?? undefined,
  // The sort is load-bearing, not defensive: the embedded quizzes_problems rows
  // arrive from PostgREST in arbitrary order, and this array's order IS the
  // order the quiz presents its problems in.
  problemSlugs: [...(r.quizzes_problems ?? [])]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((l) => l.problem_slug),
})

/** Load the whole catalogue up front (sbSelect pages past the PostgREST row
 * cap, so size isn't a concern). Throws on network/RLS errors. */
export async function fetchCatalog(): Promise<Catalog> {
  const [sources, problems, quizzes] = await Promise.all([
    sbSelect<SourceRow[]>('sources?select=slug,title,cover_url&order=slug'),
    // Explicit columns (matching ProblemRow) — `*` would also drag the unused
    // created_at/updated_at/schema_version along for every problem.
    sbSelect<ProblemRow[]>(
      'problems?select=slug,title,source,difficulty,tags,hero,dealer,vulnerability,deal,auction,play,contract,commentary&order=slug',
    ),
    sbSelect<QuizRow[]>(
      'quizzes?select=slug,title,source,quizzes_problems(problem_slug,ordinal)&order=slug',
    ),
  ])
  return {
    sources: sources.map(mapSource),
    problems: problems.map(mapProblem),
    quizzes: quizzes.map(mapQuiz),
  }
}
