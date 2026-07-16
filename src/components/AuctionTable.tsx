import type { Seat, Suit } from '../types'
import { SEAT_NAME } from '../types'
import type { Cell } from '../bidding'
import { parseBid } from '../bidding'
import { SuitGlyph } from './SuitGlyph'

function CallBody({ call }: { call: string }) {
  if (call === 'P') return <>Pass</>
  if (call === 'X') return <>X</>
  if (call === 'XX') return <>XX</>
  const b = parseBid(call)
  if (!b) return <>{call}</>
  if (b.strain === 'NT') return <>{b.level}NT</>
  return (
    <>
      {b.level}
      <SuitGlyph suit={b.strain as Suit} />
    </>
  )
}

/** Render a single call (bid / pass / double) with a suit pip. A trailing "*"
 * (an alertable call) becomes an accent-yellow superscript star. */
export function CallText({ call }: { call: string }) {
  const alerted = call.endsWith('*')
  const core = alerted ? call.slice(0, -1) : call
  return (
    <>
      <CallBody call={core} />
      {alerted && <sup className="alert-star">*</sup>}
    </>
  )
}

/** The auction grid: column headers + one cell per call, with a "?" (or the
 * entered bid) at the seat to act. */
export function AuctionTable({
  cols,
  grid,
  entered,
}: {
  cols: Seat[]
  grid: (Cell | null)[][]
  entered?: string | null
}) {
  return (
    <table className="auction-table">
      <thead>
        <tr>
          {cols.map((c) => (
            <th key={c}>{SEAT_NAME[c]}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.map((row, ri) => (
          <tr key={ri}>
            {row.map((cell, ci) => (
              <td key={ci}>
                {cell?.question ? (
                  entered ? (
                    <CallText call={entered} />
                  ) : (
                    <span className="ask">?</span>
                  )
                ) : cell?.call ? (
                  <CallText call={cell.call} />
                ) : null}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
