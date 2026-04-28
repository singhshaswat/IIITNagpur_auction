import type { BidView, Player, SkillSet } from "../../shared/types";

export function formatPrice(amount: number): string {
  return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function skillLabel(skillSet: SkillSet): string {
  const labels: Record<SkillSet, string> = {
    BATTER: "Batter",
    BOWLER: "Bowler",
    ALL_ROUNDER: "All-rounder"
  };
  return labels[skillSet];
}

export function statusLabel(status: Player["status"]): string {
  const labels: Record<Player["status"], string> = {
    available: "Available",
    in_auction: "Live",
    sold: "Sold",
    unsold: "Unsold"
  };
  return labels[status];
}

export function nextBidAmount(player: Player | null, currentBid: BidView | null, increment: number): number {
  if (!player) {
    return 0;
  }
  return currentBid ? currentBid.amount + increment : player.basePrice;
}
