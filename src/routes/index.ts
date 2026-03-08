import { setResponseHeaders } from 'h3';
import { getBodyBuffer } from '@/utils/body';
import {
  getProxyHeaders,
  getAfterResponseHeaders,
  getBlacklistedHeaders,
} from '@/utils/headers';
import {
  createTokenIfNeeded,
  isAllowedToMakeRequest,
  setTokenHeader,
} from '@/utils/turnstile';

export default defineEventHandler(async (event) => {
  // Handle CORS preflight requests
  // Use event.headers (normalized Headers instance) instead of event.req.headers
  // (event.req is deprecated in h3 v2 and returns the raw Node.js IncomingMessage
  // whose .headers is a plain object without .get())
  if (
    event.method === 'OPTIONS' &&
    event.headers.get('origin') &&
    event.headers.get('access-control-request-method')
  ) {
    setResponseHeaders(event, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400',
    });
    event.node.res.statusCode = 204;
    event.node.res.end();
    return;
  }

  // Reject any other OPTIONS requests
  if (event.method === 'OPTIONS') {
    throw createError({
      statusCode: 405,
      statusMessage: 'Method Not Allowed',
    });
  }

  // Parse destination URL
  const destination = getQuery<{ destination?: string }>(event).destination;
  if (!destination) {
    return await sendJson({
      event,
      status: 200,
      data: {
        message: `Proxy is working as expected (v${
          useRuntimeConfig(event).version
        })`,
      },
    });
  }

  // Check if allowed to make the request
  if (!(await isAllowedToMakeRequest(event))) {
    return await sendJson({
      event,
      status: 401,
      data: {
        error: 'Invalid or missing token',
      },
    });
  }

  // Read body and create token if needed
  const body = await getBodyBuffer(event);
  const token = await createTokenIfNeeded(event);

  // Proxy the request
  try {
    await specificProxyRequest(event, destination, {
      blacklistedHeaders: getBlacklistedHeaders(),
      fetchOptions: {
        redirect: 'follow',
        headers: getProxyHeaders(event.headers),
        body,
      },
      onResponse(outputEvent, response) {
        const headers = getAfterResponseHeaders(response.headers, response.url);
        for (const [name, value] of Object.entries(headers)) {
          event.res.headers.set(name, value);
        }

        if (token) setTokenHeader(event, token);
      },
    });
  } catch (e) {
    console.log('Error fetching', e);
    throw e;
  }
});