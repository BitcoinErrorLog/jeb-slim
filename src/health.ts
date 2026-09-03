import { createServer, type Server } from "node:http";

export function listenHealth(port: number, lastPoll: () => number | null): Server {
  const server = createServer((_req, res) => {
    const url = _req.url ?? "/";
    if (!url.startsWith("/healthz")) {
      res.writeHead(404);
      res.end();
      return;
    }
    const ts = lastPoll();
    const lastPollAgeMs = ts === null ? null : Date.now() - ts;
    const body = JSON.stringify({ ok: true, lastPollAgeMs });
    res.writeHead(200, { "content-type": "application/json" });
    res.end(body);
  });
  server.listen(port, "0.0.0.0");
  return server;
}
