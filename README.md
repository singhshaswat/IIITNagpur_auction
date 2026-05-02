# NPL Bidding System

A full-stack web application for running the IIIT Nagpur Premier League player auction. The app includes preloaded player profiles, four team managers, auctioneer controls, bid validation, roster assignment, JSON-file persistence, and automated tests.

## Tech Stack

- Frontend: React, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Storage: Structured JSON files
- Tests: Vitest

## Features

- Preloaded 50-player NPL pool with name, skill set, batting strength, bowling strength, and base price
- Four team managers with fixed auction budgets of `₹2,00,000` each
- Auctioneer workflow to start a player lot, accept bids, reject bids, mark players unsold, and reset the auction
- Unsold is allowed only before any active bid exists; once a bid is made, the auctioneer must reject active bids first
- Bid validation for base price, minimum increment, active auction state, and team budget
- Accepted bids immediately remove the player from the auction queue and add the player to the winning roster
- Team rosters show each sold player's skill set and winning bid
- Auction results ranking lists sold players by highest winning bid, with unsold players at the bottom
- Responsive dashboard for desktop, tablet, and mobile screens
- Backend service tests and frontend utility tests

## Setup

Install Node.js 20 or newer, then run:

```bash
npm install
```

## Run in Development

```bash
npm run dev
```

The React app runs at:

```text
http://127.0.0.1:5173
```

The API runs at:

```text
http://127.0.0.1:4000
```

## Run Production Build

```bash
npm run build
npm start
```

Open:

```text
http://localhost:4000
```

## Test

```bash
npm test
```

## Data Storage

The seed data lives in `data/seed.json`. Runtime auction state is written to `data/state.json` when the server starts or when auction actions are performed. `data/state.json` is intentionally ignored by Git so every checkout can start cleanly from seed data.

## API Endpoints

- `GET /api/state` - current auction state
- `POST /api/auction/start` - start bidding for a player, body: `{ "playerId": "aarav-mehta" }`
- `POST /api/auction/bid` - place a team bid, body: `{ "teamId": "orange-falcons", "amount": 12000 }`
- `POST /api/auction/reject` - reject the current highest bid
- `POST /api/auction/accept` - accept the current highest bid and sell the player
- `POST /api/auction/unsold` - close the active player as unsold
- `POST /api/reset` - restore the auction to seed data

## Notes

Prices are stored as whole-number rupee amounts in thousand-level increments, so `12000` displays as `₹12,000`. The minimum bid increment is `₹1,000`.
# IIITNagpur_auction

### 🌐 Live Demo

Deployed on Render:  
👉 https://iiitnagpur-auction-1.onrender.com/
