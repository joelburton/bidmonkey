import type { Problem } from '../types'
import { Hand } from './Hand'
import { AuctionPanel } from './AuctionPanel'

/**
 * Full-bleed portrait table. North/South are edge-to-edge horizontal fans
 * (South, the hero, is largest — it's what gets tapped). East/West are rotated
 * side rails pushed mostly off-screen, leaving the center clear for the auction
 * (added in the bidding phase). No seat labels — the auction will make the
 * directions obvious.
 */
export function BridgeTable({ problem }: { problem: Problem }) {
  return (
    <div className="table">
      <div className="rail rail-north">
        <Hand hand={problem.deal.N} orientation="horizontal" />
      </div>

      <div className="middle">
        <div className="rail rail-west">
          <Hand hand={problem.deal.W} orientation="west" />
        </div>
        <div className="center">
          <AuctionPanel key={problem.id} problem={problem} />
        </div>
        <div className="rail rail-east">
          <Hand hand={problem.deal.E} orientation="east" />
        </div>
      </div>

      <div className="rail rail-south">
        <Hand hand={problem.deal.S} orientation="horizontal" />
      </div>
    </div>
  )
}
