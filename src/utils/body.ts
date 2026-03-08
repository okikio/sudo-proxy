import type { H3Event } from 'h3';

export function hasBody(event: H3Event) {
  const method = event.method.toUpperCase();
  return ['PUT', 'POST', 'PATCH', 'DELETE'].includes(method);
}

export async function getBodyBuffer(
  event: H3Event,
): Promise<Uint8Array | undefined> {
  if (!hasBody(event)) return undefined;
  // readRawBody is a Nitro auto-import; returns Buffer (Uint8Array subclass)
  const raw = await readRawBody(event, false);
  return raw ? new Uint8Array(raw) : undefined;
}
