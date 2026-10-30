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
 * Check if the runtime is Netlify Production (or AWS Lambda).
 */
export function isProductionEnvironment(): boolean {
  return process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Check if Netlify Blobs API access credentials (Site ID and Personal Access Token)
 * are configured for strong-consistency origin storage access.
 */
export function isNetlifyBlobsAvailable(): boolean {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  return Boolean(siteID && token);
}

/**
 * Get Netlify Blobs store instance using documented API-access configuration.
 * Connecting via siteID and token routes directly to the origin database (https://api.netlify.com/api/v1/blobs),
 * which guarantees origin-backed strong consistency without relying on edge caching or uncachedEdgeURL.
 */
export function getNetlifyStore() {
  const siteID = process.env.NETLIFY_SITE_ID || process.env.SITE_ID;
  const token = process.env.NETLIFY_BLOBS_TOKEN || process.env.NETLIFY_AUTH_TOKEN;
  const apiURL = process.env.NETLIFY_API_URL;

  if (!siteID || !token) {
    throw new Error(
      'Netlify Blobs API access requires NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN environment variables.'
    );
  }

  const options: { name: string; siteID: string; token: string; apiURL?: string } = {
    name: STORE_NAME,
    siteID,
    token,
  };
  if (apiURL) {
    options.apiURL = apiURL;
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
   * Retrieve a room by its 6-character code directly from authoritative storage.
   * Note: In-memory cache is intentionally omitted to guarantee fresh cross-player synchronization.
   */
  static async getRoom(
    roomCode: string
  ): Promise<{ room: InternalRoom | null; version?: number; etag?: string }> {
    const key = `room_${roomCode.toUpperCase()}`;

    // 1. Fetch from Netlify Blobs if API credentials are configured
    if (isNetlifyBlobsAvailable()) {
      try {
        const store = getNetlifyStore();
        const res = await store.getWithMetadata(key, { type: 'json' });
        if (!res || !res.data) {
          return { room: null };
        }
        const room = res.data as InternalRoom;
        const version = typeof res.metadata?.version === 'number' ? res.metadata.version : room.version;
        return { room, version, etag: res.etag };
      } catch (err) {
        console.error('Netlify Blobs getRoom error:', err);
        if (isProductionEnvironment()) {
          return { room: null };
        }
      }
    } else if (isProductionEnvironment()) {
      // In production without configured API credentials, NEVER read from local disk
      return { room: null };
    }

    // 2. Local fallback (only for local development & unit test runs)
    const local = readLocalStore();
    const entry = local.rooms[key];
    if (!entry) return { room: null };
    return { room: entry.data, version: entry.version };
  }

  /**
   * Save a room with strict conditional write support:
   * - onlyIfNew: atomic CAS rejection if room code already exists on the storage server
   * - expectedVersion: ETag-based optimistic concurrency rejection if modified concurrently
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

        // A. Room Creation: Atomic uniqueness via onlyIfNew (if-none-match: *)
        if (options?.onlyIfNew) {
          const writeRes = await store.setJSON(key, roomToSave, {
            onlyIfNew: true,
            metadata: { version: nextVersion, roomCode: room.roomCode },
          });
          if (writeRes && 'modified' in writeRes && writeRes.modified === false) {
            return { success: false, error: 'Room code already exists' };
          }
          return { success: true };
        }

        // B. Room Update: Version verification and atomic ETag conditional write (if-match)
        if (typeof options?.expectedVersion === 'number') {
          const current = await store.getWithMetadata(key, { type: 'json' });
          if (!current || !current.data) {
            return { success: false, error: 'Room does not exist' };
          }

          const currentVersion =
            typeof current.metadata?.version === 'number'
              ? current.metadata.version
              : (current.data as InternalRoom).version;

          if (currentVersion !== options.expectedVersion) {
            return { success: false, error: 'Concurrent room update conflict' };
          }

          // Atomic ETag conditional write: rejects if another write succeeded in the interim
          const writeRes = await store.setJSON(key, roomToSave, {
            onlyIfMatch: current.etag,
            metadata: { version: nextVersion, roomCode: room.roomCode },
          });

          if (writeRes && 'modified' in writeRes && writeRes.modified === false) {
            return { success: false, error: 'Concurrent room update conflict' };
          }

          return { success: true };
        }

        // C. Unconditional write (initialization/admin reset)
        await store.setJSON(key, roomToSave, {
          metadata: { version: nextVersion, roomCode: room.roomCode },
        });
        return { success: true };
      } catch (err) {
        console.error('Netlify Blobs saveRoom error:', err);
        if (isProductionEnvironment()) {
          return {
            success: false,
            error: `Production storage failure: ${err instanceof Error ? err.message : 'Unable to persist to Netlify Blobs'}`,
          };
        }
      }
    } else if (isProductionEnvironment()) {
      return {
        success: false,
        error:
          'Production cloud storage is unconfigured. Netlify Site ID (NETLIFY_SITE_ID) and Personal Access Token (NETLIFY_BLOBS_TOKEN) must be configured in Netlify environment variables.',
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
