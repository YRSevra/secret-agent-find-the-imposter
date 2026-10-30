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
 * Check if Netlify Blobs runtime environment is available.
 */
function isNetlifyBlobsAvailable(): boolean {
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

    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getNetlifyStore();
        const res = await store.getWithMetadata(key, { consistency: 'strong', type: 'json' });
        if (!res || !res.data) return { room: null };
        const room = res.data as InternalRoom;
        const version = typeof res.metadata?.version === 'number' ? res.metadata.version : room.version;
        return { room, version };
      } catch (err) {
        console.error('Netlify Blobs getRoom error, falling back to local:', err);
      }
    }

    // Local fallback
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
        return { success: true };
      } catch (err) {
        console.error('Netlify Blobs saveRoom error, falling back to local:', err);
      }
    }

    // Local persistent storage with conditional concurrency handling
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
    return { success: true };
  }

  /**
   * Delete a room.
   */
  static async deleteRoom(roomCode: string): Promise<boolean> {
    const key = `room_${roomCode.toUpperCase()}`;

    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getNetlifyStore();
        await store.delete(key);
      } catch (err) {
        console.error('Netlify Blobs deleteRoom error:', err);
      }
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
