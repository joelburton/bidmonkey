import type { CardQuestion, Problem, Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import type { Contract } from '../bidding'
import { VUL_SHORT } from '../bidding'
import { Card, rankLabel } from './Card'
import { SuitGlyph } from './SuitGlyph'
import { withSuits } from './suitText'

const OPT_LETTERS = 'abcdef'

function ContractText({ contract }: { contract: Contract }) {
  return (
    <>
      {contract.level}
      {contract.strain === 'NT' ? 'NT' : <SuitGlyph suit={contract.strain as Suit} />}
      {contract.doubled === 'X' ? '×' : contract.doubled === 'XX' ? '××' : ''}
      <span className="contract-by"> by {SEAT_NAME[contract.declarer]}</span>
    </>
  )
}

/** A card as suit pip + rank, e.g. ♥Q. */
function CardText({ card }: { card: string }) {
  return (
    <>
      <SuitGlyph suit={card[0] as Suit} />
      {rankLabel(card[1])}
    </>
  )
}

/** Center during play: contract (a button that opens the auction), the current
 * trick (cards placed by compass seat), a prompt + option buttons, and the
 * wrong-answer popup. */
export function PlayCenter({
  problem,
  contract,
  trick,
  message,
  options,
  onOption,
  onContractClick,
  result,
  onDismissResult,
}: {
  problem: Problem
  contract: Contract | null
  trick: { seat: Seat; card: string }[]
  message?: string
  options?: string[]
  onOption?: (card: string) => void
  onContractClick: () => void
  result?: { correct: boolean; question: CardQuestion } | null
  onDismissResult?: () => void
}) {
  const bySeat: Partial<Record<Seat, string>> = {}
  for (const t of trick) bySeat[t.seat] = t.card

  const slot = (seat: Seat) => {
    const c = bySeat[seat]
    return (
      <div className={`trick-slot trick-${seat.toLowerCase()}`}>
        {c ? <Card suit={c[0] as Suit} rank={c[1]} /> : null}
      </div>
    )
  }

  return (
    <div className="play-panel">
      <div className="auction-head">
        <span>Problem {problem.id}</span>
        <span>Vul: {VUL_SHORT[problem.vulnerability]}</span>
      </div>
      <div className="contract-line">
        <button className="contract-btn" onClick={onContractClick}>
          {contract ? <ContractText contract={contract} /> : 'Passed out'}
        </button>
      </div>

      <div className="trick">
        {slot('N')}
        {slot('W')}
        {slot('E')}
        {slot('S')}
      </div>

      {message && <div className="play-msg">{message}</div>}

      {options && onOption && (
        <div className="opt-grid center-opts">
          {options.map((c, i) => (
            <button key={c} className="opt-btn" onClick={() => onOption(c)}>
              <span className="opt-letter">{OPT_LETTERS[i]}</span>
              <CardText card={c} />
            </button>
          ))}
        </div>
      )}

      {result && (
        <>
          <div className="explain-backdrop" onClick={onDismissResult} />
          <div className="explain-popup" role="dialog" aria-label="Answer">
            <div className={`explain-status ${result.correct ? 'ok' : 'no'}`}>
              {result.correct ? 'Correct!' : 'Not quite'}
            </div>
            {result.question.explanation && (
              <p className="explain-body">{withSuits(result.question.explanation)}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
