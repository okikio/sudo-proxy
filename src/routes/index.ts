import { getBodyBuffer } from '@/utils/body';
import { getProxyHeaders, getAfterResponseHeaders } from '@/utils/headers';
import { createTokenIfNeeded, isAllowedToMakeRequest } from '@/utils/turnstile';

/** CORS headers returned on every preflight and proxied response. */
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

  if (event.method === 'OPTIONS') {
    throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' });
  }

  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination) {
    return Response.json({
      message: `Proxy is working as expected (v${
        useRuntimeConfig(event).version
      })`,
    });
  }

  if (!(await isAllowedToMakeRequest(event))) {
    return Response.json(
      { error: 'Invalid or missing token' },
      { status: 401 },
    );
  }

  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  try {
    const upstream = await fetch(destination, {
      method: event.method,
      redirect: 'follow',
      headers: getProxyHeaders(event.headers),
      ...(body !== undefined && { body }),
    });

    // Build response headers from upstream, then overlay CORS/tracking headers.
    // set-cookie is deleted because getAfterResponseHeaders() already remaps it
    // to X-Set-Cookie to prevent the proxy domain from receiving upstream cookies.
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('set-cookie');
    for (const [name, value] of Object.entries(
      getAfterResponseHeaders(upstream.headers, upstream.url),
    )) {
      responseHeaders.set(name, value);
    }
    if (token) responseHeaders.set('X-Token', token);

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  } catch (e) {
    console.error('Error fetching', e);
    throw e;
  }
});
