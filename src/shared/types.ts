export type SkillSet = "BATTER" | "BOWLER" | "ALL_ROUNDER";
export type PlayerStatus = "available" | "in_auction" | "sold" | "unsold";
export type BidStatus = "active" | "rejected" | "accepted";

export interface Player {
  id: string;
  name: string;
  skillSet: SkillSet;
  battingStrength: number;
  bowlingStrength: number;
  basePrice: number;
  status: PlayerStatus;
  auctionOrder: number;
  soldTo?: string;
  soldPrice?: number;
}

export interface Team {
  id: string;
  name: string;
  managerName: string;
  budget: number;
  accent: string;
  roster: string[];
}

export interface Bid {
  id: string;
  playerId: string;
  teamId: string;
  amount: number;
  status: BidStatus;
  createdAt: string;
}

export interface AuctionEvent {
  id: string;
  type: "auction" | "bid" | "sale" | "system";
  message: string;
  createdAt: string;
}

export interface AuctionState {
  teams: Team[];
  players: Player[];
  activePlayerId: string | null;
  bids: Bid[];
  events: AuctionEvent[];
  updatedAt: string;
}

export interface BidView extends Bid {
  playerName: string;
  teamName: string;
  managerName: string;
}

export interface TeamView extends Team {
  spent: number;
  remainingBudget: number;
  rosterPlayers: Player[];
}

export interface ClientAuctionState {
  teams: TeamView[];
  players: Player[];
  availablePlayers: Player[];
  soldPlayers: Player[];
  unsoldPlayers: Player[];
  activePlayer: Player | null;
  currentBid: BidView | null;
  bids: BidView[];
  events: AuctionEvent[];
  stats: {
    totalPlayers: number;
    available: number;
    sold: number;
    unsold: number;
    teamCount: number;
    minBidIncrement: number;
  };
  updatedAt: string;
}

export interface StartAuctionInput {
  playerId: string;
}

export interface PlaceBidInput {
  teamId: string;
  amount: number;
}

export interface RejectBidInput {
  bidId?: string;
}
