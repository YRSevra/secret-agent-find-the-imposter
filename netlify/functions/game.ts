import type { Handler } from '@netlify/functions';
import { connectLambda } from '@netlify/blobs';
import { RoomManager } from '../../src/server/roomManager';
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

  // 1. Initialize Netlify Blobs Lambda context from the execution event
  const lambdaEvent = event as unknown as { blobs?: string; headers: Record<string, string> };
  if (lambdaEvent.blobs) {
    try {
      connectLambda({ blobs: lambdaEvent.blobs, headers: lambdaEvent.headers || {} });
    } catch (err) {
      console.error('[CRITICAL] Netlify Blobs connectLambda failed:', err);
    }
  }

  // Check if running on Netlify production where Blobs context is required
  const isNetlifyProduction = process.env.NETLIFY === 'true' || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
  const isBlobsConfigured =
    typeof globalThis.netlifyBlobsContext !== 'undefined' || Boolean(process.env.NETLIFY_BLOBS_CONTEXT);

  if (isNetlifyProduction && !isBlobsConfigured) {
    console.error('[CRITICAL] Netlify production environment detected without active Blobs context.');
    return {
      statusCode: 503,
      headers: HEADERS,
      body: JSON.stringify({
        success: false,
        error: 'Agency cloud storage subsystem unavailable. Netlify Blobs context failed to initialize.',
        code: 'STORAGE_UNAVAILABLE',
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
      else if (response.code === 'STORAGE_UNAVAILABLE') statusCode = 503;
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
