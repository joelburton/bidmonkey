import type { CardQuestion, Problem, Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import type { Contract } from '../bidding'
import { VUL_SHORT } from '../bidding'
import type { Pos } from '../play'
import { Card, rankLabel } from './Card'
import { SuitGlyph } from './SuitGlyph'
import { withSuits } from './suitText'
import { useTapDismiss } from '../tapDismiss'

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

const POS_CLASS: Record<Pos, string> = { top: 't', left: 'l', right: 'r', bottom: 'b' }

/** Center during play: contract (a button that opens the auction), the current
 * trick (cards placed by the same seat→position map as the hands), a prompt +
 * option buttons, and the wrong-answer popup. */
export function PlayCenter({
  problem,
  contract,
  trick,
  seatPos,
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
  seatPos: Record<Seat, Pos>
  message?: string
  options?: string[]
  onOption?: (card: string) => void
  onContractClick: () => void
  result?: { correct: boolean; question: CardQuestion } | null
  onDismissResult?: () => void
}) {
  const byPos: Partial<Record<Pos, string>> = {}
  for (const t of trick) byPos[seatPos[t.seat]] = t.card

  // Tap anywhere on the popup or the backdrop dismisses it; a drag to scroll the
  // explanation does not (see useTapDismiss).
  const tapDismiss = useTapDismiss(() => onDismissResult?.())

  const slot = (pos: Pos) => {
    const c = byPos[pos]
    return (
      <div className={`trick-slot trick-${POS_CLASS[pos]}`}>
        {c ? <Card suit={c[0] as Suit} rank={c[1]} /> : null}
      </div>
    )
  }

  return (
    <div className="play-panel">
      <div className="contract-line">
        <button className="contract-btn" onClick={onContractClick}>
          {contract ? <ContractText contract={contract} /> : 'Passed out'}
        </button>
        {problem.vulnerability && (
          <span className="vul-tag">Vul: {VUL_SHORT[problem.vulnerability]}</span>
        )}
      </div>

      <div className="trick-area">
        <div className="trick">
          {slot('top')}
          {slot('left')}
          {slot('right')}
          {slot('bottom')}
        </div>
      </div>

      <div className="play-bottom">
        {message && <div className="play-msg">{message}</div>}
        {options && onOption && (
          <div className="opt-grid center-opts">
            {options.map((c, i) => (
              <button
                key={c}
                className="opt-btn"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onOption(c)}
              >
                <span className="opt-letter">{OPT_LETTERS[i]}</span>
                <CardText card={c} />
              </button>
            ))}
          </div>
        )}
      </div>

      {result && (
        <>
          <div className="explain-backdrop" {...tapDismiss} />
          <div className="explain-popup" role="dialog" aria-label="Answer" {...tapDismiss}>
            <div className={`explain-status ${result.correct ? 'ok' : 'no'}`}>
              {result.correct ? 'Correct!' : 'Not quite'}
            </div>
            {result.question.explanation && (
              <p className="explain-body">{withSuits(result.question.explanation)}</p>
            )}
            <p className="explain-answer">
              Answer: <CardText card={result.question.answer} />
              {!!result.question.accept?.length && (
                <>
                  {' '}
                  (accepted:{' '}
                  {result.question.accept.map((a, i) => (
                    <span key={a}>
                      {i > 0 ? ', ' : ''}
                      <CardText card={a} />
                    </span>
                  ))}
                  )
                </>
              )}
            </p>
          </div>
        </>
      )}
    </div>
  )
}
