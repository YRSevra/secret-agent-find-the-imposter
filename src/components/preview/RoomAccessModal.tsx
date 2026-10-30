import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { AvatarPicker } from '../ui/AvatarPicker';
import { PlusCircle, LogIn, AlertCircle } from 'lucide-react';
import { GameApiService } from '../../services/gameApi';
import { GameMode } from '../../types/game';
import { DEFAULT_AVATAR_ID } from '../../constants/avatars';

interface RoomAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'join' | 'create';
}

export const RoomAccessModal: React.FC<RoomAccessModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'join',
}) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'join' | 'create'>(initialMode);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [avatarId, setAvatarId] = useState(DEFAULT_AVATAR_ID);
  const [gameMode, setGameMode] = useState<GameMode>('classic');
  const [roomCode, setRoomCode] = useState('');

  // Loading & Error states
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resetForm = () => {
    setErrorMessage(null);
    setIsLoading(false);
  };

  const handleTabChange = (tab: 'join' | 'create') => {
    setActiveTab(tab);
    resetForm();
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = displayName.trim();
    if (cleanName.length < 2) {
      setErrorMessage('Operative codename must be at least 2 characters.');
      return;
    }
    if (cleanName.length > 16) {
      setErrorMessage('Operative codename cannot exceed 16 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await GameApiService.createRoom({
        displayName: cleanName,
        avatarId,
        gameMode,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Failed to establish private room transmission.');
        setIsLoading(false);
        return;
      }

      onClose();
      navigate(`/room/${res.data.room.roomCode}`);
    } catch {
      setErrorMessage('Network transmission failure. Verify backend connectivity.');
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanName = displayName.trim();
    const cleanCode = roomCode.trim().toUpperCase();

    if (cleanName.length < 2) {
      setErrorMessage('Operative codename must be at least 2 characters.');
      return;
    }
    if (cleanCode.length !== 6) {
      setErrorMessage('Room code must be exactly 6 characters.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await GameApiService.joinRoom({
        roomCode: cleanCode,
        displayName: cleanName,
        avatarId,
      });

      if (!res.success || !res.data) {
        setErrorMessage(res.error || 'Unable to join specified room.');
        setIsLoading(false);
        return;
      }

      onClose();
      navigate(`/room/${res.data.room.roomCode}`);
    } catch {
      setErrorMessage('Network transmission failure. Verify backend connectivity.');
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="OPERATIVE ROOM TERMINAL"
      classification="SECURITY PROTOCOL LEVEL 3"
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-between w-full">
          <span className="text-[10px] font-mono text-agency-muted">
            {activeTab === 'create'
              ? 'HOST PROTOCOL: SERVER-AUTHORITATIVE ROOM'
              : 'INFILTRATION: 6-CHAR ENCRYPTED CODE'}
          </span>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isLoading}>
            ABORT
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Tab switchers */}
        <div className="grid grid-cols-2 p-1 bg-agency-surface border border-agency-border rounded-lg">
          <button
            type="button"
            onClick={() => handleTabChange('join')}
            disabled={isLoading}
            className={`py-2 text-xs font-mono font-bold tracking-wider rounded transition-all flex items-center justify-center gap-2 ${
              activeTab === 'join'
                ? 'bg-agency-card text-agency-accent border border-agency-border shadow-sm'
                : 'text-agency-muted hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            JOIN MISSION
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('create')}
            disabled={isLoading}
            className={`py-2 text-xs font-mono font-bold tracking-wider rounded transition-all flex items-center justify-center gap-2 ${
              activeTab === 'create'
                ? 'bg-agency-card text-agency-accent border border-agency-border shadow-sm'
                : 'text-agency-muted hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            CREATE ROOM
          </button>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-3 bg-agency-warning/10 border border-agency-warning/40 rounded-lg flex items-start gap-2.5 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-agency-warning shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-agency-warning leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {activeTab === 'create' ? (
          /* CREATE ROOM FORM */
          <form onSubmit={handleCreateRoom} className="space-y-4">
            <Input
              label="HOST CODENAME"
              placeholder="e.g. AGENT_CIPHER"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              helperText="Your operative callsign visible to all joined players (2–16 characters)."
              maxLength={16}
              disabled={isLoading}
              required
            />

            {/* Avatar Picker Component */}
            <AvatarPicker
              selectedId={avatarId}
              onSelect={setAvatarId}
            />

            {/* Game Mode Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium uppercase tracking-wider text-agency-muted">
                MISSION PROTOCOL (GAME MODE)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setGameMode('classic')}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    gameMode === 'classic'
                      ? 'bg-agency-surface border-agency-accent shadow-glow-sm'
                      : 'bg-agency-card border-agency-border hover:border-agency-borderLight'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-white">CLASSIC</span>
                    <Badge variant="classified" size="sm">
                      3–8 PLAYERS
                    </Badge>
                  </div>
                  <p className="text-[11px] text-agency-muted">
                    Full circle interrogation, discussion & majority vote
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setGameMode('duel')}
                  disabled={isLoading}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    gameMode === 'duel'
                      ? 'bg-agency-surface border-agency-accent shadow-glow-sm'
                      : 'bg-agency-card border-agency-border hover:border-agency-borderLight'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-mono font-bold text-white">DUEL</span>
                    <Badge variant="warning" size="sm">
                      2 PLAYERS
                    </Badge>
                  </div>
                  <p className="text-[11px] text-agency-muted">
                    High-stakes 1-on-1 psychological clash & bluff calls
                  </p>
                </button>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                isLoading={isLoading}
                disabled={displayName.trim().length < 2}
              >
                GENERATE ROOM & ENTER TERMINAL
              </Button>
            </div>
          </form>
        ) : (
          /* JOIN ROOM FORM */
          <form onSubmit={handleJoinRoom} className="space-y-4">
            <Input
              label="OPERATIVE CODENAME"
              placeholder="e.g. SHADOW_RECON"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              helperText="Your callsign in this operation (2–16 characters)."
              maxLength={16}
              disabled={isLoading}
              required
            />

            <AvatarPicker
              selectedId={avatarId}
              onSelect={setAvatarId}
            />

            <Input
              label="6-CHARACTER ROOM CODE"
              placeholder="XK79PQ"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              isCodeInput
              maxLength={6}
              disabled={isLoading}
              helperText="Enter the 6-character code provided by your mission host."
              required
            />

            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                fullWidth
                isLoading={isLoading}
                disabled={displayName.trim().length < 2 || roomCode.trim().length !== 6}
              >
                VALIDATE & ENTER ROOM
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
