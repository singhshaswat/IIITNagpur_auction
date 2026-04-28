import {
  Activity,
  Check,
  CircleDollarSign,
  Gavel,
  Play,
  RefreshCw,
  RotateCcw,
  SkipForward,
  Trophy,
  Users,
  WalletCards,
  X
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { formatPrice, nextBidAmount, skillLabel, statusLabel } from "./lib/formatters";
import type { ClientAuctionState, Player, TeamView } from "../shared/types";

type BusyAction = "load" | "start" | "bid" | "accept" | "reject" | "unsold" | "reset" | null;

function App() {
  const [state, setState] = useState<ClientAuctionState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<BusyAction>("load");
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [bidAmount, setBidAmount] = useState(0);

  const loadState = async (action: BusyAction = "load") => {
    setBusyAction(action);
    try {
      const freshState = await api.state();
      setState(freshState);
      setError(null);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  useEffect(() => {
    void loadState();
    const timer = window.setInterval(() => void loadState(null), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!state) {
      return;
    }

    if (!selectedPlayerId || !state.availablePlayers.some((player) => player.id === selectedPlayerId)) {
      setSelectedPlayerId(state.availablePlayers[0]?.id ?? "");
    }
    if (!selectedTeamId || !state.teams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(state.teams[0]?.id ?? "");
    }
  }, [selectedPlayerId, selectedTeamId, state]);

  const nextBid = useMemo(
    () => nextBidAmount(state?.activePlayer ?? null, state?.currentBid ?? null, state?.stats.minBidIncrement ?? 1),
    [state]
  );
  const auctionResults = useMemo(() => rankAuctionResults(state?.players ?? []), [state?.players]);
  const queuedPlayers = useMemo(
    () => state?.players.filter((player) => player.status === "available" || player.status === "in_auction") ?? [],
    [state?.players]
  );

  useEffect(() => {
    if (nextBid > 0) {
      setBidAmount(nextBid);
    }
  }, [nextBid]);

  const runAction = async (action: Exclude<BusyAction, "load" | null>, operation: () => Promise<ClientAuctionState>) => {
    setBusyAction(action);
    try {
      const freshState = await operation();
      setState(freshState);
      setError(null);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setBusyAction(null);
    }
  };

  const startAuction = () => {
    if (!selectedPlayerId) {
      setError("No available player selected.");
      return;
    }
    void runAction("start", () => api.startAuction({ playerId: selectedPlayerId }));
  };

  const submitBid = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTeamId) {
      setError("No team selected.");
      return;
    }
    void runAction("bid", () => api.placeBid({ teamId: selectedTeamId, amount: Number(bidAmount) }));
  };

  const resetAuction = () => {
    if (window.confirm("Reset the auction state?")) {
      void runAction("reset", api.reset);
    }
  };

  if (!state) {
    return (
      <main className="loading-screen">
        <Gavel aria-hidden="true" />
        <span>Loading NPL auction...</span>
        {error ? <p className="error-text">{error}</p> : null}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">IIIT Nagpur Premier League</p>
          <h1>NPL Bidding System</h1>
        </div>
        <div className="topbar-actions">
          <button className="icon-button" type="button" title="Refresh" onClick={() => void loadState("load")}>
            <RefreshCw size={18} aria-hidden="true" />
          </button>
          <button className="danger-button" type="button" onClick={resetAuction} disabled={busyAction === "reset"}>
            <RotateCcw size={17} aria-hidden="true" />
            Reset
          </button>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="stat-strip" aria-label="Auction status">
        <Stat icon={<Users size={18} />} label="Managers" value={state.stats.teamCount.toString()} />
        <Stat icon={<Gavel size={18} />} label="Available" value={state.stats.available.toString()} />
        <Stat icon={<Trophy size={18} />} label="Sold" value={state.stats.sold.toString()} />
        <Stat icon={<SkipForward size={18} />} label="Unsold" value={state.stats.unsold.toString()} />
      </section>

      <section className="workbench">
        <div className="primary-column">
          <section className="panel live-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Live Lot</p>
                <h2>{state.activePlayer ? state.activePlayer.name : "No Active Player"}</h2>
              </div>
              <span className={`status-pill ${state.activePlayer ? "is-live" : ""}`}>
                {state.activePlayer ? "Live" : "Idle"}
              </span>
            </div>

            {state.activePlayer ? (
              <ActivePlayer player={state.activePlayer} currentBid={state.currentBid} />
            ) : (
              <div className="empty-state">Select a player to begin bidding.</div>
            )}

            <form className="bid-form" onSubmit={submitBid}>
              <label>
                Team Manager
                <select value={selectedTeamId} onChange={(event) => setSelectedTeamId(event.target.value)} disabled={!state.activePlayer}>
                  {state.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} - {formatPrice(team.remainingBudget)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Bid Amount
                <input
                  min={nextBid || 1}
                  step={state.stats.minBidIncrement}
                  type="number"
                  value={bidAmount}
                  onChange={(event) => setBidAmount(Number(event.target.value))}
                  disabled={!state.activePlayer}
                />
              </label>
              <button className="primary-button" type="submit" disabled={!state.activePlayer || busyAction === "bid"}>
                <CircleDollarSign size={18} aria-hidden="true" />
                Place Bid
              </button>
            </form>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Team Managers</p>
                <h2>Rosters & Budgets</h2>
              </div>
            </div>
            <div className="team-grid">
              {state.teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </section>
        </div>

        <aside className="side-column">
          <section className="panel auctioneer-panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Auctioneer</p>
                <h2>Control Desk</h2>
              </div>
            </div>

            {state.activePlayer ? (
              <div className="locked-player">
                <span>Live Player</span>
                <strong>{state.activePlayer.name}</strong>
                <small>
                  {skillLabel(state.activePlayer.skillSet)} - Base {formatPrice(state.activePlayer.basePrice)}
                </small>
              </div>
            ) : (
              <label>
                Player
                <select
                  value={selectedPlayerId}
                  onChange={(event) => setSelectedPlayerId(event.target.value)}
                  disabled={state.availablePlayers.length === 0}
                >
                  {state.availablePlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} - {formatPrice(player.basePrice)}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="control-grid">
              <button type="button" className="primary-button" onClick={startAuction} disabled={Boolean(state.activePlayer) || !selectedPlayerId}>
                <Play size={17} aria-hidden="true" />
                Start
              </button>
              <button type="button" className="success-button" onClick={() => void runAction("accept", api.acceptBid)} disabled={!state.currentBid}>
                <Check size={17} aria-hidden="true" />
                Accept
              </button>
              <button type="button" className="secondary-button" onClick={() => void runAction("reject", () => api.rejectBid())} disabled={!state.currentBid}>
                <X size={17} aria-hidden="true" />
                Reject
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => void runAction("unsold", api.markUnsold)}
                disabled={!state.activePlayer || Boolean(state.currentBid)}
                title={state.currentBid ? "Reject all active bids before marking unsold" : "Mark player unsold"}
              >
                <SkipForward size={17} aria-hidden="true" />
                Unsold
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Player Pool</p>
                <h2>Queue</h2>
              </div>
            </div>
            <div className="player-list">
              {queuedPlayers.length ? (
                queuedPlayers.map((player) => <PlayerRow key={player.id} player={player} />)
              ) : (
                <div className="empty-state compact">All players have been auctioned.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="table-pair">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Auction Results</p>
              <h2>Sold Rankings</h2>
            </div>
            <Trophy size={18} aria-hidden="true" />
          </div>
          {auctionResults.length ? (
            <ol className="ranking-list">
              {auctionResults.map((player, index) => (
                <li key={player.id}>
                  <span className="rank-number">{index + 1}</span>
                  <div>
                    <strong>{player.name}</strong>
                    <span>{skillLabel(player.skillSet)}</span>
                  </div>
                  <strong>{player.soldPrice ? formatPrice(player.soldPrice) : statusLabel(player.status)}</strong>
                </li>
              ))}
            </ol>
          ) : (
            <div className="empty-state compact">Results will appear after a player is sold or marked unsold.</div>
          )}
        </section>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Timeline</p>
              <h2>Activity</h2>
            </div>
            <Activity size={18} aria-hidden="true" />
          </div>
          <ol className="activity-list">
            {state.events.map((event) => (
              <li key={event.id}>
                <span>{event.message}</span>
                <time>{new Date(event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
              </li>
            ))}
          </ol>
        </section>
      </section>
    </main>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="stat">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActivePlayer({ player, currentBid }: { player: Player; currentBid: ClientAuctionState["currentBid"] }) {
  return (
    <div className="active-player">
      <div className="player-metrics">
        <Metric label="Skill" value={skillLabel(player.skillSet)} />
        <Metric label="Base" value={formatPrice(player.basePrice)} />
        <Metric label="Batting" value={`${player.battingStrength}/100`} />
        <Metric label="Bowling" value={`${player.bowlingStrength}/100`} />
      </div>
      <div className="bid-spotlight">
        <WalletCards aria-hidden="true" />
        <span>Current Bid</span>
        <strong>{currentBid ? formatPrice(currentBid.amount) : formatPrice(player.basePrice)}</strong>
        <small>{currentBid ? currentBid.teamName : "Base price"}</small>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function TeamCard({ team }: { team: TeamView }) {
  return (
    <article className="team-card" style={{ "--team-accent": team.accent } as React.CSSProperties}>
      <div className="team-card-header">
        <div>
          <h3>{team.name}</h3>
          <p>{team.managerName}</p>
        </div>
        <strong>{formatPrice(team.remainingBudget)}</strong>
      </div>
      <div className="budget-track">
        <span style={{ width: `${Math.min(100, (team.spent / team.budget) * 100)}%` }} />
      </div>
      <ul>
        {team.rosterPlayers.length ? (
          team.rosterPlayers.map((player) => (
            <li key={player.id}>
              <span>
                <strong>{player.name}</strong>
                <small>{skillLabel(player.skillSet)}</small>
              </span>
              <strong>{formatPrice(player.soldPrice ?? 0)}</strong>
            </li>
          ))
        ) : (
          <li className="muted-row">No players sold yet</li>
        )}
      </ul>
    </article>
  );
}

function PlayerRow({ player }: { player: Player }) {
  return (
    <article className="player-row">
      <div>
        <strong>{player.name}</strong>
        <span>
          {skillLabel(player.skillSet)} - {formatPrice(player.basePrice)}
        </span>
      </div>
      <span className={`status-pill status-${player.status}`}>{statusLabel(player.status)}</span>
    </article>
  );
}

function rankAuctionResults(players: Player[]): Player[] {
  return players
    .filter((player) => player.status === "sold" || player.status === "unsold")
    .sort((left, right) => {
      const statusDifference = Number(left.status === "unsold") - Number(right.status === "unsold");
      if (statusDifference !== 0) {
        return statusDifference;
      }

      if (left.status === "sold" && right.status === "sold") {
        return (right.soldPrice ?? 0) - (left.soldPrice ?? 0);
      }

      return left.auctionOrder - right.auctionOrder;
    });
}

export default App;
