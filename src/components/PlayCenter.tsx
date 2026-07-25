import type { CardQuestion, Problem, Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import type { Contract } from '../bidding'
import { VUL_SHORT } from '../bidding'
import type { Pos } from '../play'
import { Card, rankLabel } from './Card'
import { SuitGlyph } from './SuitGlyph'
import { Explanation } from './Explanation'
import { FlagButton } from './FlagButton'
import { CopyProblem } from './CopyProblem'
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
 * option buttons, and the wrong-answer popup. The ⚑ toggle rides the contract
 * line — the play phase shows no problem id, and this is its info row. */
export function PlayCenter({
  problem,
  answers,
  contract,
  trick,
  seatPos,
  message,
  bottomArrow = false,
  options,
  onOption,
  onContractClick,
  result,
  onDismissResult,
  showNext,
  onNext,
  hasNext,
  flagged = false,
  onToggleFlag = () => {},
}: {
  problem: Problem
  /** The auction answers, so the copy button can write the problem out with the
   * auction resolved the way this run resolved it. */
  answers: string[]
  contract: Contract | null
  trick: { seat: Seat; card: string }[]
  seatPos: Record<Seat, Pos>
  message?: string
  /** Whether a turn arrow is drawn over the South hand. That arrow reaches up
   * out of the bottom rail into the strip this panel's last line sits in, so
   * when it's up we lift the content clear of it — and only then, since felt
   * height is scarce. */
  bottomArrow?: boolean
  options?: string[]
  onOption?: (card: string) => void
  onContractClick: () => void
  result?: { correct: boolean; alternate: boolean; question: CardQuestion } | null
  onDismissResult?: () => void
  showNext?: boolean
  onNext?: () => void
  hasNext?: boolean
  // Inert by default so tests can render the center alone; PlayView always passes
  // them.
  flagged?: boolean
  onToggleFlag?: () => void
}) {
  // Position → card plus its place in the trick, so the cards stack in play
  // order: the lead sits under everything, the latest card on top.
  const byPos: Partial<Record<Pos, { card: string; order: number }>> = {}
  trick.forEach((t, i) => {
    byPos[seatPos[t.seat]] = { card: t.card, order: i }
  })

  // Tap anywhere on the popup or the backdrop dismisses it; a drag to scroll the
  // explanation does not (see useTapDismiss).
  const tapDismiss = useTapDismiss(() => onDismissResult?.())

  const slot = (pos: Pos) => {
    const c = byPos[pos]
    return (
      <div
        className={`trick-slot trick-${POS_CLASS[pos]}`}
        style={c ? { zIndex: c.order + 1 } : undefined}
      >
        {c ? <Card suit={c.card[0] as Suit} rank={c.card[1]} /> : null}
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
        <FlagButton flagged={flagged} onToggle={onToggleFlag} />
        <CopyProblem problem={problem} answers={answers} />
      </div>

      <div className="trick-area">
        <div className="trick">
          {slot('top')}
          {slot('left')}
          {slot('right')}
          {slot('bottom')}
        </div>
      </div>

      <div className={`play-bottom${bottomArrow ? ' clear-arrow' : ''}`}>
        {showNext && onNext && (
          <button className="play-btn" onClick={onNext} disabled={!hasNext}>
            Next ▸
          </button>
        )}
        {/* Suit symbols become SVG pips, as in the auction prompt and the
            explanation popup. */}
        {message && <div className="play-msg">{withSuits(message)}</div>}
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
            <div
              className={`explain-status ${
                result.alternate ? 'alt' : result.correct ? 'ok' : 'no'
              }`}
            >
              {result.alternate ? 'Alternate' : result.correct ? 'Correct!' : 'Not quite'}
            </div>
            {result.question.explanation && <Explanation text={result.question.explanation} />}
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
