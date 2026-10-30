import { getStore } from '@netlify/blobs';
import fs from 'fs';
import path from 'path';
import { InternalRoom } from '../types/game';

const STORE_NAME = 'secret-agent-rooms';
const LOCAL_STORE_DIR = path.resolve(process.cwd(), '.netlify/blobs-local');
const LOCAL_STORE_FILE = path.join(LOCAL_STORE_DIR, 'rooms.json');

interface LocalStoreData {
  rooms: Record<string, { data: InternalRoom; version: number; updatedAt: string }>;
}

/**
 * In-memory serverless runtime cache (safe across warm invocations).
 * Short TTL (1.5s) prevents stale reads across concurrent instances.
 */
interface CacheEntry {
  room: InternalRoom;
  version: number;
  cachedAt: number;
}
const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1500;

/**
 * Check if the runtime is Netlify Production (or AWS Lambda).
 */
export function isProductionEnvironment(): boolean {
  return process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Check if Netlify Blobs runtime environment is available.
 */
export function isNetlifyBlobsAvailable(): boolean {
  if (typeof globalThis.netlifyBlobsContext !== 'undefined') return true;
  if (process.env.NETLIFY_BLOBS_CONTEXT) return true;
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) return true;
  return false;
}

/**
 * Get Netlify Blobs store instance with strong consistency.
 */
function getNetlifyStore() {
  const options: { name: string; consistency: 'strong'; siteID?: string; token?: string } = {
    name: STORE_NAME,
    consistency: 'strong',
  };
  if (process.env.NETLIFY_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN) {
    options.siteID = process.env.NETLIFY_SITE_ID;
    options.token = process.env.NETLIFY_BLOBS_TOKEN;
  }
  return getStore(options);
}

/**
 * Read local persistent store (for local dev and testing).
 */
function readLocalStore(): LocalStoreData {
  try {
    if (!fs.existsSync(LOCAL_STORE_FILE)) {
      return { rooms: {} };
    }
    const raw = fs.readFileSync(LOCAL_STORE_FILE, 'utf-8');
    return JSON.parse(raw) as LocalStoreData;
  } catch {
    return { rooms: {} };
  }
}

/**
 * Write local persistent store.
 */
function writeLocalStore(data: LocalStoreData): void {
  try {
    if (!fs.existsSync(LOCAL_STORE_DIR)) {
      fs.mkdirSync(LOCAL_STORE_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_STORE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to write local store:', err);
  }
}

export class RoomStorage {
  /**
   * Retrieve a room by its 6-character code with strong consistency.
   */
  static async getRoom(roomCode: string): Promise<{ room: InternalRoom | null; version?: number }> {
    const key = `room_${roomCode.toUpperCase()}`;

    // 1. Check warm serverless memory cache first
    const cached = memoryCache.get(key);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return { room: cached.room, version: cached.version };
    }

    // 2. Fetch from Netlify Blobs if context is available
    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getNetlifyStore();
        const res = await store.getWithMetadata(key, { consistency: 'strong', type: 'json' });
        if (!res || !res.data) {
          memoryCache.delete(key);
          return { room: null };
        }
        const room = res.data as InternalRoom;
        const version = typeof res.metadata?.version === 'number' ? res.metadata.version : room.version;
        memoryCache.set(key, { room, version, cachedAt: Date.now() });
        return { room, version };
      } catch (err) {
        console.error('Netlify Blobs getRoom error:', err);
        // In production, do NOT read from local disk
        if (isProductionEnvironment()) {
          return { room: null };
        }
      }
    } else if (isProductionEnvironment()) {
      // In production, if Blobs is not available, do NOT read from local disk
      return { room: null };
    }

    // 3. Local fallback (only for local development & unit test runs)
    const local = readLocalStore();
    const entry = local.rooms[key];
    if (!entry) return { room: null };
    return { room: entry.data, version: entry.version };
  }

  /**
   * Save a room with conditional write support:
   * - onlyIfNew: prevents room code collisions on creation
   * - expectedVersion: prevents concurrent overwrite / capacity races
   */
  static async saveRoom(
    room: InternalRoom,
    options?: { onlyIfNew?: boolean; expectedVersion?: number }
  ): Promise<{ success: boolean; error?: string }> {
    const key = `room_${room.roomCode.toUpperCase()}`;
    const nextVersion = (room.version || 0) + 1;
    const roomToSave: InternalRoom = {
      ...room,
      version: nextVersion,
      updatedAt: new Date().toISOString(),
    };

    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getNetlifyStore();
        if (options?.onlyIfNew) {
          // Check if key already exists in Netlify Blobs with strong consistency
          const existing = await store.get(key, { consistency: 'strong' });
          if (existing) {
            return { success: false, error: 'Room code already exists' };
          }
        }

        if (typeof options?.expectedVersion === 'number') {
          const current = await store.getWithMetadata(key, { consistency: 'strong', type: 'json' });
          if (current && current.metadata?.version !== options.expectedVersion) {
            return { success: false, error: 'Concurrent room update conflict' };
          }
        }

        const setOpts: {
          metadata: { version: number; roomCode: string };
          onlyIfNew?: boolean;
        } = {
          metadata: { version: nextVersion, roomCode: room.roomCode },
        };
        if (options?.onlyIfNew) {
          setOpts.onlyIfNew = true;
        }

        const writeRes = await store.setJSON(key, roomToSave, setOpts);
        if (options?.onlyIfNew && writeRes && 'modified' in writeRes && writeRes.modified === false) {
          return { success: false, error: 'Room code already exists' };
        }

        // Keep local memory cache synchronized
        memoryCache.set(key, { room: roomToSave, version: nextVersion, cachedAt: Date.now() });
        return { success: true };
      } catch (err) {
        console.error('Netlify Blobs saveRoom error:', err);
        // In production, fail explicitly. NEVER silently fall back to local read-only disk!
        if (isProductionEnvironment()) {
          return {
            success: false,
            error: `Production storage failure: ${err instanceof Error ? err.message : 'Unable to persist to Netlify Blobs'}`,
          };
        }
      }
    } else if (isProductionEnvironment()) {
      // In production without Blobs, fail explicitly
      return {
        success: false,
        error: 'Production cloud storage is not available. Netlify Blobs must be initialized.',
      };
    }

    // Local persistent storage (only for local development and unit tests)
    const local = readLocalStore();
    const existing = local.rooms[key];

    if (options?.onlyIfNew && existing) {
      return { success: false, error: 'Room code already exists' };
    }

    if (typeof options?.expectedVersion === 'number') {
      if (!existing || existing.version !== options.expectedVersion) {
        return { success: false, error: 'Concurrent room update conflict' };
      }
    }

    local.rooms[key] = {
      data: roomToSave,
      version: nextVersion,
      updatedAt: roomToSave.updatedAt,
    };
    writeLocalStore(local);
    memoryCache.set(key, { room: roomToSave, version: nextVersion, cachedAt: Date.now() });
    return { success: true };
  }

  /**
   * Delete a room.
   */
  static async deleteRoom(roomCode: string): Promise<boolean> {
    const key = `room_${roomCode.toUpperCase()}`;
    memoryCache.delete(key);

    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getNetlifyStore();
        await store.delete(key);
        if (isProductionEnvironment()) {
          return true;
        }
      } catch (err) {
        console.error('Netlify Blobs deleteRoom error:', err);
        if (isProductionEnvironment()) {
          return false;
        }
      }
    } else if (isProductionEnvironment()) {
      return false;
    }

    const local = readLocalStore();
    if (local.rooms[key]) {
      delete local.rooms[key];
      writeLocalStore(local);
      return true;
    }
    return false;
  }
}
