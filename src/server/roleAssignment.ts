import crypto from 'crypto';
import { InternalPlayer, InternalRound, PlayerRole } from '../types/game';
import { SECRET_WORD_CATEGORIES } from '../constants/secretWords';

/**
 * Cryptographically secure random imposter selector.
 * Uses crypto.randomInt to guarantee an equal probability distribution.
 */
export function selectRandomImposter(playerIds: string[]): string {
  if (!playerIds || playerIds.length === 0) {
    throw new Error('Cannot assign imposter role to an empty player pool');
  }
  const index = crypto.randomInt(0, playerIds.length);
  return playerIds[index];
}

/**
 * Select a random secret word and category, avoiding immediate repetition.
 */
export function selectSecretWord(previousWords: string[] = []): { category: string; word: string } {
  // 1. Pick a random category
  const categoryIndex = crypto.randomInt(0, SECRET_WORD_CATEGORIES.length);
  const selectedCat = SECRET_WORD_CATEGORIES[categoryIndex];

  // 2. Filter out words recently used in previous rounds if possible
  const candidateWords = selectedCat.words.filter(
    (w) => !previousWords.map((p) => p.toLowerCase()).includes(w.toLowerCase())
  );

  const wordPool = candidateWords.length > 0 ? candidateWords : selectedCat.words;
  const wordIndex = crypto.randomInt(0, wordPool.length);
  const word = wordPool[wordIndex];

  return {
    category: selectedCat.name,
    word,
  };
}

/**
 * Initialize a new secret round with server-authoritative role assignment.
 */
export function createNewRound(
  players: InternalPlayer[],
  previousWords: string[] = [],
  roundNumber: number = 1
): InternalRound {
  if (players.length < 2) {
    throw new Error('Minimum 2 operatives required for mission initialization');
  }

  const playerIds = players.map((p) => p.playerId);
  const imposterPlayerId = selectRandomImposter(playerIds);
  const { category, word } = selectSecretWord(previousWords);

  const playerRoles: Record<string, PlayerRole> = {};

  for (const p of players) {
    if (p.playerId === imposterPlayerId) {
      playerRoles[p.playerId] = 'IMPOSTER';
    } else {
      playerRoles[p.playerId] = 'AGENT';
    }
  }

  const roundId = `rnd_${crypto.randomBytes(8).toString('hex')}`;

  return {
    roundId,
    roundNumber,
    status: 'ROLE_REVEAL',
    selectedCategory: category,
    secretWord: word,
    imposterPlayerId,
    playerRoles,
    createdAt: new Date().toISOString(),
  };
}
