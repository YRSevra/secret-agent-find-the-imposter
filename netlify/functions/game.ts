import type { Handler } from '@netlify/functions';
import { RoomManager } from '../../src/server/roomManager';
import { isProductionEnvironment, isNetlifyBlobsAvailable } from '../../src/server/storage';
import { GameApiRequest } from '../../src/types/game';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: HEADERS,
      body: '',
    };
  }

  // 1. Guard production environment: verify strong-consistency API access credentials
  if (isProductionEnvironment() && !isNetlifyBlobsAvailable()) {
    console.error(
      '[CRITICAL] Netlify production environment detected without strong-consistency API credentials. ' +
        'NETLIFY_SITE_ID and NETLIFY_BLOBS_TOKEN must be configured in Netlify Site Environment Variables.'
    );
    return {
      statusCode: 503,
      headers: HEADERS,
      body: JSON.stringify({
        success: false,
        error:
          'Agency production cloud storage is unconfigured. Netlify Site ID (NETLIFY_SITE_ID) and Personal Access Token (NETLIFY_BLOBS_TOKEN) must be configured in Netlify environment variables.',
        code: 'STORAGE_CONFIG_ERROR',
      }),
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: HEADERS,
      body: JSON.stringify({
        success: false,
        error: 'Method Not Allowed. Use POST with JSON payload.',
        code: 'METHOD_NOT_ALLOWED',
      }),
    };
  }

  try {
    const payload = JSON.parse(event.body || '{}') as GameApiRequest;
    const response = await RoomManager.handleRequest(payload);

    let statusCode = 200;
    if (!response.success) {
      if (response.code === 'ROOM_NOT_FOUND') statusCode = 404;
      else if (response.code === 'UNAUTHORIZED') statusCode = 401;
      else if (response.code === 'STORAGE_UNAVAILABLE' || response.code === 'STORAGE_CONFIG_ERROR') statusCode = 503;
      else statusCode = 400;
    }

    return {
      statusCode,
      headers: HEADERS,
      body: JSON.stringify(response),
    };
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({
        success: false,
        error: 'Malformed JSON payload transmitted to agency terminal.',
        code: 'MALFORMED_JSON',
      }),
    };
  }
};
