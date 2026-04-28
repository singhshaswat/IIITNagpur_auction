import { describe, expect, it } from "vitest";
import type { AuctionState } from "../src/shared/types";
import { AuctionError, AuctionService } from "../src/server/services/auctionService";
import type { AuctionStore } from "../src/server/storage/AuctionStore";

const baseState: AuctionState = {
  teams: [
    {
      id: "team-a",
      name: "Team A",
      managerName: "Manager A",
      budget: 20000,
      accent: "#111111",
      roster: []
    },
    {
      id: "team-b",
      name: "Team B",
      managerName: "Manager B",
      budget: 20000,
      accent: "#222222",
      roster: []
    }
  ],
  players: [
    {
      id: "player-one",
      name: "Player One",
      skillSet: "BATTER",
      battingStrength: 80,
      bowlingStrength: 30,
      basePrice: 5000,
      status: "available",
      auctionOrder: 1
    },
    {
      id: "player-two",
      name: "Player Two",
      skillSet: "BOWLER",
      battingStrength: 25,
      bowlingStrength: 82,
      basePrice: 4000,
      status: "available",
      auctionOrder: 2
    }
  ],
  activePlayerId: null,
  bids: [],
  events: [],
  updatedAt: "2026-04-28T00:00:00.000Z"
};

class MemoryStore implements AuctionStore {
  private state = structuredClone(baseState);

  async load(): Promise<AuctionState> {
    return structuredClone(this.state);
  }

  async save(state: AuctionState): Promise<void> {
    this.state = structuredClone(state);
  }

  async reset(): Promise<AuctionState> {
    this.state = structuredClone(baseState);
    return this.load();
  }
}

function createService() {
  return new AuctionService(new MemoryStore());
}

describe("AuctionService", () => {
  it("sells an accepted bid and moves the player into the roster", async () => {
    const service = createService();

    await service.startAuction({ playerId: "player-one" });
    await service.placeBid({ teamId: "team-a", amount: 6000 });
    const soldState = await service.acceptBid();

    expect(soldState.activePlayer).toBeNull();
    expect(soldState.soldPlayers).toHaveLength(1);
    expect(soldState.soldPlayers[0].soldTo).toBe("team-a");
    expect(soldState.teams[0].rosterPlayers.map((player) => player.id)).toEqual(["player-one"]);
    expect(soldState.teams[0].remainingBudget).toBe(14000);
  });

  it("rejects the current bid and restores the previous standing bid", async () => {
    const service = createService();

    await service.startAuction({ playerId: "player-one" });
    await service.placeBid({ teamId: "team-a", amount: 5000 });
    const withHighBid = await service.placeBid({ teamId: "team-b", amount: 7000 });
    expect(withHighBid.currentBid?.teamId).toBe("team-b");

    const afterReject = await service.rejectBid();

    expect(afterReject.currentBid?.teamId).toBe("team-a");
    expect(afterReject.currentBid?.amount).toBe(5000);
  });

  it("prevents invalid bid amounts and overspending", async () => {
    const service = createService();

    await service.startAuction({ playerId: "player-one" });
    await expect(service.placeBid({ teamId: "team-a", amount: 4000 })).rejects.toThrow(AuctionError);
    await expect(service.placeBid({ teamId: "team-a", amount: 21000 })).rejects.toThrow("only has");
  });

  it("only marks a player unsold when no active bid remains", async () => {
    const service = createService();

    await service.startAuction({ playerId: "player-one" });
    await service.placeBid({ teamId: "team-a", amount: 5000 });
    await expect(service.markUnsold()).rejects.toThrow("Reject all active bids");

    await service.rejectBid();
    const unsoldState = await service.markUnsold();

    expect(unsoldState.activePlayer).toBeNull();
    expect(unsoldState.unsoldPlayers.map((player) => player.id)).toEqual(["player-one"]);
  });

  it("does not allow a second active auction to start", async () => {
    const service = createService();

    await service.startAuction({ playerId: "player-one" });

    await expect(service.startAuction({ playerId: "player-two" })).rejects.toThrow("Finish bidding");
  });
});
