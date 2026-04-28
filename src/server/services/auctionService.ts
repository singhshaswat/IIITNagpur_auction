import type {
  AuctionEvent,
  AuctionState,
  Bid,
  BidView,
  ClientAuctionState,
  PlaceBidInput,
  Player,
  RejectBidInput,
  StartAuctionInput,
  Team,
  TeamView
} from "../../shared/types.js";
import type { AuctionStore } from "../storage/AuctionStore.js";

export const MIN_BID_INCREMENT = 1000;

export class AuctionError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "AuctionError";
  }
}

export class AuctionService {
  constructor(private readonly store: AuctionStore) {}

  async getState(): Promise<ClientAuctionState> {
    const state = await this.store.load();
    return this.toClientState(state);
  }

  async startAuction(input: StartAuctionInput): Promise<ClientAuctionState> {
    return this.mutate((state) => {
      const activePlayer = this.getActivePlayer(state);
      if (activePlayer) {
        throw new AuctionError(409, `Finish bidding for ${activePlayer.name} before starting another player.`);
      }

      const player = this.findPlayer(state, input.playerId);
      if (player.status !== "available") {
        throw new AuctionError(409, `${player.name} is not available for bidding.`);
      }

      player.status = "in_auction";
      state.activePlayerId = player.id;
      this.addEvent(state, "auction", `${player.name} entered the auction at ${this.formatPrice(player.basePrice)}.`);
    });
  }

  async placeBid(input: PlaceBidInput): Promise<ClientAuctionState> {
    return this.mutate((state) => {
      const activePlayer = this.requireActivePlayer(state);
      const team = this.findTeam(state, input.teamId);
      const amount = Number(input.amount);

      if (!Number.isInteger(amount) || amount <= 0) {
        throw new AuctionError(400, "Bid amount must be a positive whole number.");
      }

      const currentBid = this.getCurrentBid(state);
      const minimumBid = currentBid ? currentBid.amount + MIN_BID_INCREMENT : activePlayer.basePrice;
      if (amount < minimumBid) {
        throw new AuctionError(400, `Next bid must be at least ${this.formatPrice(minimumBid)}.`);
      }

      const remainingBudget = this.getRemainingBudget(state, team.id);
      if (amount > remainingBudget) {
        throw new AuctionError(400, `${team.name} only has ${this.formatPrice(remainingBudget)} remaining.`);
      }

      const bid: Bid = {
        id: crypto.randomUUID(),
        playerId: activePlayer.id,
        teamId: team.id,
        amount,
        status: "active",
        createdAt: new Date().toISOString()
      };
      state.bids.push(bid);
      this.addEvent(state, "bid", `${team.name} bid ${this.formatPrice(amount)} for ${activePlayer.name}.`);
    });
  }

  async rejectBid(input: RejectBidInput = {}): Promise<ClientAuctionState> {
    return this.mutate((state) => {
      const activePlayer = this.requireActivePlayer(state);
      const bid = input.bidId ? this.findBid(state, input.bidId) : this.getCurrentBid(state);

      if (!bid || bid.playerId !== activePlayer.id || bid.status !== "active") {
        throw new AuctionError(404, "No active bid is available to reject.");
      }

      const team = this.findTeam(state, bid.teamId);
      bid.status = "rejected";
      this.addEvent(state, "bid", `${team.name}'s ${this.formatPrice(bid.amount)} bid for ${activePlayer.name} was rejected.`);
    });
  }

  async acceptBid(): Promise<ClientAuctionState> {
    return this.mutate((state) => {
      const activePlayer = this.requireActivePlayer(state);
      const bid = this.getCurrentBid(state);

      if (!bid) {
        throw new AuctionError(404, "There is no active bid to accept.");
      }

      const team = this.findTeam(state, bid.teamId);
      const remainingBudget = this.getRemainingBudget(state, team.id);
      if (bid.amount > remainingBudget) {
        throw new AuctionError(409, `${team.name} no longer has enough budget for this bid.`);
      }

      bid.status = "accepted";
      for (const otherBid of state.bids) {
        if (otherBid.playerId === activePlayer.id && otherBid.id !== bid.id && otherBid.status === "active") {
          otherBid.status = "rejected";
        }
      }

      activePlayer.status = "sold";
      activePlayer.soldTo = team.id;
      activePlayer.soldPrice = bid.amount;
      if (!team.roster.includes(activePlayer.id)) {
        team.roster.push(activePlayer.id);
      }
      state.activePlayerId = null;
      this.addEvent(state, "sale", `${activePlayer.name} sold to ${team.name} for ${this.formatPrice(bid.amount)}.`);
    });
  }

  async markUnsold(): Promise<ClientAuctionState> {
    return this.mutate((state) => {
      const activePlayer = this.requireActivePlayer(state);
      const bid = this.getCurrentBid(state);
      if (bid) {
        throw new AuctionError(409, "Reject all active bids before marking this player unsold.");
      }

      activePlayer.status = "unsold";
      activePlayer.soldTo = undefined;
      activePlayer.soldPrice = undefined;
      for (const bid of state.bids) {
        if (bid.playerId === activePlayer.id && bid.status === "active") {
          bid.status = "rejected";
        }
      }
      state.activePlayerId = null;
      this.addEvent(state, "auction", `${activePlayer.name} closed unsold.`);
    });
  }

  async reset(): Promise<ClientAuctionState> {
    const state = await this.store.reset();
    return this.toClientState(state);
  }

  private async mutate(mutator: (state: AuctionState) => void): Promise<ClientAuctionState> {
    const state = await this.store.load();
    mutator(state);
    state.updatedAt = new Date().toISOString();
    await this.store.save(state);
    return this.toClientState(state);
  }

  private toClientState(state: AuctionState): ClientAuctionState {
    const orderedPlayers = [...state.players].sort((left, right) => left.auctionOrder - right.auctionOrder);
    const activePlayer = this.getActivePlayer(state);
    const bidViews = state.bids
      .map((bid) => this.toBidView(state, bid))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    const currentBid = activePlayer ? this.toOptionalBidView(state, this.getCurrentBid(state)) : null;
    const teams = state.teams.map((team) => this.toTeamView(state, team));

    return {
      teams,
      players: orderedPlayers,
      availablePlayers: orderedPlayers.filter((player) => player.status === "available"),
      soldPlayers: orderedPlayers.filter((player) => player.status === "sold"),
      unsoldPlayers: orderedPlayers.filter((player) => player.status === "unsold"),
      activePlayer: activePlayer ?? null,
      currentBid,
      bids: bidViews,
      events: [...state.events].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()),
      stats: {
        totalPlayers: state.players.length,
        available: state.players.filter((player) => player.status === "available").length,
        sold: state.players.filter((player) => player.status === "sold").length,
        unsold: state.players.filter((player) => player.status === "unsold").length,
        teamCount: state.teams.length,
        minBidIncrement: MIN_BID_INCREMENT
      },
      updatedAt: state.updatedAt
    };
  }

  private toTeamView(state: AuctionState, team: Team): TeamView {
    const rosterPlayers = team.roster
      .map((playerId) => state.players.find((player) => player.id === playerId))
      .filter((player): player is Player => Boolean(player));
    const spent = rosterPlayers.reduce((total, player) => total + (player.soldPrice ?? 0), 0);

    return {
      ...team,
      spent,
      remainingBudget: team.budget - spent,
      rosterPlayers
    };
  }

  private toBidView(state: AuctionState, bid: Bid): BidView {
    const player = this.findPlayer(state, bid.playerId);
    const team = this.findTeam(state, bid.teamId);
    return {
      ...bid,
      playerName: player.name,
      teamName: team.name,
      managerName: team.managerName
    };
  }

  private toOptionalBidView(state: AuctionState, bid: Bid | null): BidView | null {
    return bid ? this.toBidView(state, bid) : null;
  }

  private getActivePlayer(state: AuctionState): Player | null {
    if (!state.activePlayerId) {
      return null;
    }

    const player = state.players.find((candidate) => candidate.id === state.activePlayerId);
    return player?.status === "in_auction" ? player : null;
  }

  private requireActivePlayer(state: AuctionState): Player {
    const player = this.getActivePlayer(state);
    if (!player) {
      throw new AuctionError(409, "No player is currently open for bidding.");
    }
    return player;
  }

  private getCurrentBid(state: AuctionState): Bid | null {
    const activePlayer = this.getActivePlayer(state);
    if (!activePlayer) {
      return null;
    }

    const [highestBid] = state.bids
      .filter((bid) => bid.playerId === activePlayer.id && bid.status === "active")
      .sort((left, right) => {
        if (right.amount !== left.amount) {
          return right.amount - left.amount;
        }
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
    return highestBid ?? null;
  }

  private findPlayer(state: AuctionState, playerId: string): Player {
    const player = state.players.find((candidate) => candidate.id === playerId);
    if (!player) {
      throw new AuctionError(404, "Player not found.");
    }
    return player;
  }

  private findTeam(state: AuctionState, teamId: string): Team {
    const team = state.teams.find((candidate) => candidate.id === teamId);
    if (!team) {
      throw new AuctionError(404, "Team not found.");
    }
    return team;
  }

  private findBid(state: AuctionState, bidId: string): Bid {
    const bid = state.bids.find((candidate) => candidate.id === bidId);
    if (!bid) {
      throw new AuctionError(404, "Bid not found.");
    }
    return bid;
  }

  private getRemainingBudget(state: AuctionState, teamId: string): number {
    const team = this.findTeam(state, teamId);
    const spent = state.players
      .filter((player) => player.status === "sold" && player.soldTo === team.id)
      .reduce((total, player) => total + (player.soldPrice ?? 0), 0);
    return team.budget - spent;
  }

  private addEvent(state: AuctionState, type: AuctionEvent["type"], message: string): void {
    state.events.push({
      id: crypto.randomUUID(),
      type,
      message,
      createdAt: new Date().toISOString()
    });
    state.events = state.events.slice(-80);
  }

  private formatPrice(amount: number): string {
    return `₹${amount.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
}
