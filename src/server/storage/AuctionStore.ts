import type { AuctionState } from "../../shared/types.js";

export interface AuctionStore {
  load(): Promise<AuctionState>;
  save(state: AuctionState): Promise<void>;
  reset(): Promise<AuctionState>;
}
