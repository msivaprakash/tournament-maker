import React, {useState} from 'react';
import {QRCodeSVG} from 'qrcode.react';
import {usePairing} from './usePairing';

interface Props {
  onPaired: (ref: {groupCode: string; tournamentId: string}) => void;
}

export function PairingScreen({onPaired}: Props) {
  const {code, status, pairingUrl, regenerate} = usePairing(onPaired);
  const [manualCode, setManualCode] = useState('');
  const [manualGroup, setManualGroup] = useState('');
  const [manualTournament, setManualTournament] = useState('');
  const [showManual, setShowManual] = useState(false);

  const handleManualConnect = () => {
    if (manualGroup.trim() && manualTournament.trim()) {
      onPaired({groupCode: manualGroup.trim(), tournamentId: manualTournament.trim()});
    }
  };

  if (status === 'expired') {
    return (
      <div className="pairing-screen">
        <div className="pairing-card">
          <div className="pairing-expired">Code expired</div>
          <button className="pairing-btn" onClick={regenerate}>Generate New Code</button>
        </div>
      </div>
    );
  }

  return (
    <div className="pairing-screen">
      <div className="pairing-card">
        <h1 className="pairing-title">🏸 Tournament Status Board</h1>
        <p className="pairing-subtitle">Scan to connect a tournament to this display</p>

        {code && status === 'waiting' && (
          <>
            <div className="qr-container">
              <QRCodeSVG
                value={pairingUrl}
                size={240}
                bgColor="#1A2A3A"
                fgColor="#FFFFFF"
                level="M"
              />
            </div>
            <div className="pairing-code">{code.split('').join(' ')}</div>
            <p className="pairing-url">{pairingUrl}</p>
            <p className="pairing-hint">
              Open Tournament Maker on your phone and pair this display
            </p>
          </>
        )}

        {status === 'generating' && (
          <div className="pairing-loading">Generating code...</div>
        )}

        <div className="pairing-divider">
          <span>or</span>
        </div>

        {!showManual ? (
          <button className="pairing-link" onClick={() => setShowManual(true)}>
            Enter tournament code manually
          </button>
        ) : (
          <div className="manual-entry">
            <input
              className="manual-input"
              placeholder="Group code (e.g. HH-482913)"
              value={manualGroup}
              onChange={e => setManualGroup(e.target.value)}
            />
            <input
              className="manual-input"
              placeholder="Tournament ID"
              value={manualTournament}
              onChange={e => setManualTournament(e.target.value)}
            />
            <button className="pairing-btn" onClick={handleManualConnect}>
              Connect
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
