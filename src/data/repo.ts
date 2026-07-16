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

interface QuizRow {
  slug: string
  title: string
  source: string | null
  quizzes_problems: { problem_slug: string; ordinal: number }[] | null
}

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
  problemSlugs: [...(r.quizzes_problems ?? [])]
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((l) => l.problem_slug),
})

/** Load the whole catalogue in one shot (it's tiny). Throws on network/RLS errors. */
export async function fetchCatalog(): Promise<Catalog> {
  const [sources, problems, quizzes] = await Promise.all([
    sbSelect<Source[]>('sources?select=slug,title&order=title'),
    sbSelect<ProblemRow[]>('problems?select=*&order=slug'),
    sbSelect<QuizRow[]>('quizzes?select=slug,title,source,quizzes_problems(problem_slug,ordinal)&order=title'),
  ])
  return { sources, problems: problems.map(mapProblem), quizzes: quizzes.map(mapQuiz) }
}
