import React, { useState } from 'react';
import type { Match, Player } from '../types';

interface Props {
  players: Player[];
  nextMatchId: number;
  maxRound: number;
  courts: number;
  onClose: () => void;
  onAdd: (match: Match) => void;
}

export default function AddMatchSheet({
  players,
  nextMatchId,
  maxRound,
  courts,
  onClose,
  onAdd,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [court, setCourt] = useState(1);

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((pid) => pid !== id);
      }
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  };

  const handleCreate = () => {
    if (selectedIds.length !== 4) return;

    const newMatch: Match = {
      id: nextMatchId,
      round: maxRound + 1,
      court,
      teamAIds: [selectedIds[0], selectedIds[1]],
      teamBIds: [selectedIds[2], selectedIds[3]],
      status: 'pending',
      flags: ['added'],
    };

    onAdd(newMatch);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2>Add Custom Match</h2>
          <button className="btn-close" onClick={onClose}>
            &times;
          </button>
        </div>

        {/* Instructions */}
        <p className="modal-instructions">
          Select 4 players (first 2 = Team A, last 2 = Team B)
        </p>

        {/* Player Grid */}
        <div className="player-grid">
          {players.map((player) => {
            const idx = selectedIds.indexOf(player.id);
            const isSelected = idx !== -1;

            return (
              <button
                key={player.id}
                className={`player-chip ${isSelected ? 'player-chip-selected' : ''}`}
                onClick={() => togglePlayer(player.id)}
              >
                {isSelected && <span className="chip-index">{idx + 1}</span>}
                {player.name}
              </button>
            );
          })}
        </div>

        {/* Court Selector */}
        <div className="court-selector">
          <span className="court-label">Court:</span>
          {Array.from({ length: courts }, (_, i) => i + 1).map((num) => (
            <button
              key={num}
              className={`court-btn ${court === num ? 'court-btn-active' : ''}`}
              onClick={() => setCourt(num)}
            >
              {num}
            </button>
          ))}
        </div>

        {/* Warning */}
        <p className="warning-text">
          This match will be flagged as Added in the live view.
        </p>

        {/* Actions */}
        <div className="modal-actions">
          <button className="btn-outline" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={handleCreate}
            disabled={selectedIds.length !== 4}
          >
            Create Match
          </button>
        </div>
      </div>
    </div>
  );
}
