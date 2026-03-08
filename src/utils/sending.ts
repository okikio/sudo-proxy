/**
 * Creates a JSON Response using the web-standard Response API.
 * Compatible with all Nitro targets (Node.js, Cloudflare Workers, Deno, Bun).
 */
export function sendJson(
  data: Record<string, unknown>,
  status = 200,
): Response {
  return Response.json(data, { status });
}
