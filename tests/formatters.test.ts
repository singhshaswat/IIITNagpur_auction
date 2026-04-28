import { describe, expect, it } from "vitest";
import type { BidView, Player } from "../src/shared/types";
import { formatPrice, nextBidAmount, skillLabel, statusLabel } from "../src/client/lib/formatters";

const player: Player = {
  id: "sample",
  name: "Sample Player",
  skillSet: "ALL_ROUNDER",
  battingStrength: 75,
  bowlingStrength: 72,
  basePrice: 6000,
  status: "available",
  auctionOrder: 1
};

describe("frontend formatters", () => {
  it("formats prices and player labels", () => {
    expect(formatPrice(12000)).toBe("₹12,000");
    expect(skillLabel("ALL_ROUNDER")).toBe("All-rounder");
    expect(statusLabel("in_auction")).toBe("Live");
  });

  it("calculates the next bid from base price or current bid", () => {
    expect(nextBidAmount(player, null, 1000)).toBe(6000);

    const bid: BidView = {
      id: "bid-1",
      playerId: player.id,
      playerName: player.name,
      teamId: "team-a",
      teamName: "Team A",
      managerName: "Manager A",
      amount: 9000,
      status: "active",
      createdAt: "2026-04-28T00:00:00.000Z"
    };

    expect(nextBidAmount(player, bid, 1000)).toBe(10000);
  });
});
