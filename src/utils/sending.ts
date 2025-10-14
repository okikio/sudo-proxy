import { H3Event, EventHandlerRequest } from 'h3';

export async function sendJson(ops: {
  event: H3Event<EventHandlerRequest>;
  data: Record<string, any>;
  status?: number;
}) {
  ops.event.res.status = ops.status ?? 200;
  // await send(ops.event, JSON.stringify(ops.data, null, 2), 'application/json');
  return new Response(JSON.stringify(ops.data, null, 2), {
    headers: new Headers([
      ...ops.event.res.headers,
      ["content-type", "application/json;charset=UTF-8",]
    ])
  })
}
