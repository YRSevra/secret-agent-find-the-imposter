import type { Handler } from '@netlify/functions';
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
