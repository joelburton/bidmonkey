import type { CardQuestion, Problem, Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import type { Contract } from '../bidding'
import { VUL_SHORT } from '../bidding'
import { Card } from './Card'
import { SuitGlyph } from './SuitGlyph'
import { withSuits } from './suitText'

function ContractText({ contract }: { contract: Contract }) {
  return (
    <span className="contract">
      {contract.level}
      {contract.strain === 'NT' ? (
        'NT'
      ) : (
        <SuitGlyph suit={contract.strain as Suit} />
      )}
      {contract.doubled === 'X' ? '×' : contract.doubled === 'XX' ? '××' : ''}
      <span className="contract-by"> by {SEAT_NAME[contract.declarer]}</span>
    </span>
  )
}

/** Center during play: problem id + vulnerability, the contract, and the cards
 * currently on the table arranged by seat (N top, S bottom, W left, E right). */
type Pos = 'top' | 'bottom' | 'left' | 'right'
const POS_AREA: Record<Pos, string> = { top: 'n', left: 'w', right: 'e', bottom: 's' }

export function PlayCenter({
  problem,
  contract,
  trick,
  message,
  seatPos,
  wrong,
  onDismissWrong,
}: {
  problem: Problem
  contract: Contract | null
  trick: { seat: Seat; card: string }[]
  message?: string
  // where each seat sits on the table, so the trick lines up with the hands
  seatPos: Record<Seat, Pos>
  wrong?: CardQuestion | null
  onDismissWrong?: () => void
}) {
  const byPos: Partial<Record<Pos, string>> = {}
  for (const t of trick) byPos[seatPos[t.seat]] = t.card

  const slot = (pos: Pos) => {
    const c = byPos[pos]
    return (
      <div className={`trick-slot trick-${POS_AREA[pos]}`}>
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
        {contract ? <ContractText contract={contract} /> : 'Passed out'}
      </div>
      <div className="trick">
        {slot('top')}
        {slot('left')}
        {slot('right')}
        {slot('bottom')}
      </div>
      {message && <div className="play-msg">{message}</div>}

      {wrong && (
        <>
          <div className="explain-backdrop" onClick={onDismissWrong} />
          <div className="explain-popup" role="dialog" aria-label="Answer">
            <div className="explain-status no">Not quite</div>
            {wrong.explanation && (
              <p className="explain-body">{withSuits(wrong.explanation)}</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
