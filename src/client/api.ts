import type { ClientAuctionState, PlaceBidInput, RejectBidInput, StartAuctionInput } from "../shared/types";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? "Request failed.");
  }

  return payload as T;
}

export const api = {
  state: () => request<ClientAuctionState>("/api/state"),
  startAuction: (input: StartAuctionInput) =>
    request<ClientAuctionState>("/api/auction/start", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  placeBid: (input: PlaceBidInput) =>
    request<ClientAuctionState>("/api/auction/bid", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  rejectBid: (input: RejectBidInput = {}) =>
    request<ClientAuctionState>("/api/auction/reject", {
      method: "POST",
      body: JSON.stringify(input)
    }),
  acceptBid: () =>
    request<ClientAuctionState>("/api/auction/accept", {
      method: "POST"
    }),
  markUnsold: () =>
    request<ClientAuctionState>("/api/auction/unsold", {
      method: "POST"
    }),
  reset: () =>
    request<ClientAuctionState>("/api/reset", {
      method: "POST"
    })
};
