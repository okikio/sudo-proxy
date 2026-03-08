import { H3Event, EventHandlerRequest, setResponseStatus, setResponseHeaders } from 'h3';

export async function sendJson(ops: {
  event: H3Event<EventHandlerRequest>;
  data: Record<string, any>;
  status?: number;
}) {
  setResponseStatus(ops.event, ops.status ?? 200);
  setResponseHeaders(ops.event, { 'content-type': 'application/json;charset=UTF-8' });
  return JSON.stringify(ops.data, null, 2);
}
