import React, { useState } from 'react';
import type { Match, Player, MatchScore } from '../types';
import { scoreFromInputs, QUICK_SCORES } from '../utils/score';

interface Props {
  match: Match;
  getPlayerName: (id: string) => string;
  players: Player[];
  onClose: () => void;
  onSave: (match: Match) => void;
  onCancel: (matchId: number) => void;
  onSwapPlayer: (matchId: number, oldId: string, newId: string) => void;
  onRenamePlayer: (id: string, name: string) => void;
}

export default function ScoreSheet({
  match,
  getPlayerName,
  players,
  onClose,
  onSave,
  onCancel,
  onSwapPlayer,
  onRenamePlayer,
}: Props) {
  const [scoreA, setScoreA] = useState(match.score?.teamA?.toString() ?? '');
  const [scoreB, setScoreB] = useState(match.score?.teamB?.toString() ?? '');
  const [error, setError] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const allMatchPlayerIds = [...match.teamAIds, ...match.teamBIds];

  const handleQuickScore = (a: number, b: number) => {
    setScoreA(a.toString());
    setScoreB(b.toString());
    setError('');
  };

  const handleSave = () => {
    const a = parseInt(scoreA, 10);
    const b = parseInt(scoreB, 10);

    if (isNaN(a) || isNaN(b)) {
      setError('Please enter valid numbers for both scores.');
      return;
    }

    const result: MatchScore | null = scoreFromInputs(a, b);
    if (!result) {
      setError('Invalid badminton score. Check the values and try again.');
      return;
    }

    const flags = [...(match.flags ?? [])];
    if (match.score && !flags.includes('edited')) {
      flags.push('edited');
    }

    const updatedMatch: Match = {
      ...match,
      score: result,
      status: 'completed',
      flags: flags.length > 0 ? flags : undefined,
    };

    onSave(updatedMatch);
  };

  const handleStartRename = (playerId: string) => {
    setRenamingId(playerId);
    setRenameValue(getPlayerName(playerId));
  };

  const handleConfirmRename = () => {
    if (renamingId && renameValue.trim()) {
      onRenamePlayer(renamingId, renameValue.trim());
    }
    setRenamingId(null);
    setRenameValue('');
  };

  const handleSwap = (oldId: string) => {
    const availablePlayers = players.filter(
      (p) => !allMatchPlayerIds.includes(p.id)
    );

    if (availablePlayers.length === 0) {
      window.alert('No available players to swap with.');
      return;
    }

    const options = availablePlayers.map((p) => p.name).join('\n');
    const chosen = window.prompt(
      `Swap ${getPlayerName(oldId)} with:\n\n${options}\n\nType the player name:`
    );

    if (!chosen) return;

    const target = availablePlayers.find(
      (p) => p.name.toLowerCase() === chosen.trim().toLowerCase()
    );

    if (target) {
      onSwapPlayer(match.id, oldId, target.id);
    } else {
      window.alert('Player not found. Please type the exact name.');
    }
  };

  const renderPlayerRow = (playerId: string) => {
    if (renamingId === playerId) {
      return (
        <div key={playerId} className="player-edit-row">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="rename-input"
            autoFocus
          />
          <button className="btn-icon" onClick={handleConfirmRename} title="Save">
            &#10003;
          </button>
        </div>
      );
    }

    return (
      <div key={playerId} className="player-edit-row">
        <span className="player-edit-name">{getPlayerName(playerId)}</span>
        <button
          className="btn-icon"
          onClick={() => handleStartRename(playerId)}
          title="Rename"
        >
          &#9998;
        </button>
        <button
          className="btn-icon"
          onClick={() => handleSwap(playerId)}
          title="Swap"
        >
          &#8644;
        </button>
      </div>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Match {match.id} &bull; Court {match.court}</h2>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Team A */}
        <div className="team-label" style={{ color: 'var(--team-a)' }}>
          Team A: {match.teamAIds.map((id) => getPlayerName(id)).join(' & ')}
        </div>

        {/* Score Inputs */}
        <div className="score-row">
          <input
            type="number"
            className="score-input"
            value={scoreA}
            onChange={(e) => {
              setScoreA(e.target.value);
              setError('');
            }}
            placeholder="0"
            min={0}
            max={30}
          />
          <span className="score-dash">&ndash;</span>
          <input
            type="number"
            className="score-input"
            value={scoreB}
            onChange={(e) => {
              setScoreB(e.target.value);
              setError('');
            }}
            placeholder="0"
            min={0}
            max={30}
          />
        </div>

        {/* Team B */}
        <div className="team-label" style={{ color: 'var(--team-b)' }}>
          Team B: {match.teamBIds.map((id) => getPlayerName(id)).join(' & ')}
        </div>

        {/* Quick Scores */}
        <div className="quick-scores">
          {QUICK_SCORES.map(([a, b]) => (
            <React.Fragment key={`${a}-${b}`}>
              <button
                className="quick-chip"
                onClick={() => handleQuickScore(a, b)}
              >
                {a}-{b}
              </button>
              <button
                className="quick-chip"
                onClick={() => handleQuickScore(b, a)}
              >
                {b}-{a}
              </button>
            </React.Fragment>
          ))}
        </div>

        {/* Error */}
        {error && <p className="error-message">{error}</p>}

        {/* Advanced Section */}
        <div className="advanced-section">
          <button
            className="advanced-toggle"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? '▾' : '▸'} Advanced
          </button>

          {showAdvanced && (
            <div className="advanced-content">
              <h4>Edit Players</h4>
              {allMatchPlayerIds.map((id) => renderPlayerRow(id))}

              <button
                className="btn-danger"
                onClick={() => onCancel(match.id)}
              >
                Cancel This Match
              </button>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-secondary" onClick={handleSave}>
            Save Score
          </button>
        </div>
      </div>
    </div>
  );
}
