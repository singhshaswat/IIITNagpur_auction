import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuctionState } from "../../shared/types.js";
import type { AuctionStore } from "./AuctionStore.js";

export class JsonFileStore implements AuctionStore {
  constructor(
    private readonly seedPath: string,
    private readonly statePath: string
  ) {}

  async load(): Promise<AuctionState> {
    try {
      const raw = await readFile(this.statePath, "utf8");
      return JSON.parse(raw) as AuctionState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }

      return this.reset();
    }
  }

  async save(state: AuctionState): Promise<void> {
    await mkdir(path.dirname(this.statePath), { recursive: true });
    const tempPath = `${this.statePath}.tmp`;
    await writeFile(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    await rename(tempPath, this.statePath);
  }

  async reset(): Promise<AuctionState> {
    const raw = await readFile(this.seedPath, "utf8");
    const seed = JSON.parse(raw) as AuctionState;
    const cleanState = structuredClone(seed);
    cleanState.updatedAt = new Date().toISOString();
    cleanState.activePlayerId = null;
    cleanState.bids = [];
    cleanState.events = [
      {
        id: crypto.randomUUID(),
        type: "system",
        message: "Auction state reset from seeded NPL player list.",
        createdAt: cleanState.updatedAt
      }
    ];
    cleanState.players = cleanState.players.map((player) => ({
      ...player,
      status: "available",
      soldTo: undefined,
      soldPrice: undefined
    }));
    cleanState.teams = cleanState.teams.map((team) => ({ ...team, roster: [] }));
    await this.save(cleanState);
    return cleanState;
  }
}
