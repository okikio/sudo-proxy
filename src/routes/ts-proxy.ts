import { getCachedSegment } from './m3u8-proxy';

// Check if caching is enabled via environment variable (disabled by default)
const isCacheDisabled = () => process.env.ENABLE_CACHE !== 'true';

/** CORS headers returned on preflight and all proxied responses. */
const CORS_PREFLIGHT_HEADERS: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

export default defineEventHandler(async (event) => {
  // CORS preflight — web-standard Response, no Node.js APIs needed
  if (
    event.method === 'OPTIONS' &&
    event.headers.get('origin') &&
    event.headers.get('access-control-request-method')
  ) {
    return new Response(null, {
      status: 204,
      headers: CORS_PREFLIGHT_HEADERS,
    });
  }

  if (process.env.DISABLE_M3U8 === 'true') {
    throw createError({
      statusCode: 404,
      statusMessage: 'TS proxying is disabled',
    });
  }

  const { url, headers: headersParam } = getQuery(event) as {
    url?: string;
    headers?: string;
  };

  if (!url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'URL parameter is required',
    });
  }

  let customHeaders: Record<string, string> = {};
  try {
    customHeaders = headersParam ? JSON.parse(headersParam) : {};
  } catch {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid headers format',
    });
  }

  const fetchHeaders: HeadersInit = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0',
    ...customHeaders,
  };

  // Serve from cache if available (cache is populated proactively by m3u8-proxy)
  if (!isCacheDisabled()) {
    const cached = getCachedSegment(url);
    if (cached) {
      return new Response(cached.data, {
        status: 200,
        headers: {
          'Content-Type': cached.headers['content-type'] || 'video/mp2t',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*',
          'Access-Control-Allow-Methods': '*',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }
  }

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: fetchHeaders,
    });

    if (!upstream.ok) {
      throw createError({
        statusCode: upstream.status,
        statusMessage: `Failed to fetch TS file: ${upstream.statusText}`,
      });
    }

    // Stream directly when caching is disabled (common path — avoids buffering)
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'video/mp2t',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error)
      throw error;
    console.error('Error proxying TS file:', error);
    throw createError({
      statusCode: 500,
      statusMessage:
        (error instanceof Error ? error.message : null) ||
        'Error proxying TS file',
    });
  }
});
