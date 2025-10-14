import { H3Event } from 'h3';

export function hasBody(event: H3Event) {
  const method = event.method.toUpperCase();
  return ['PUT', 'POST', 'PATCH', 'DELETE'].includes(method);
}

export async function getBodyBuffer(
  event: H3Event,
): Promise<ArrayBuffer | undefined> {
  if (!hasBody(event)) return;
  return await event.req.arrayBuffer();
}
