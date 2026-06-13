#!/usr/bin/env node
/**
 * Collaboration server for the widget composer.
 *
 *  - WebSocket (Yjs sync): clients share the composition tree + collaborative
 *    brick state (CollabText/CollabChat) as CRDTs, merged deterministically.
 *    The sync/awareness handling is the classic y-websocket implementation,
 *    vendored here against the SAME yjs@13 + y-protocols@1 the browser client
 *    uses (the published server packages pull an incompatible Yjs fork).
 *  - POST /inject  { room, widget }: server-initiated live push — writes a
 *    composition tree into a room's shared doc; every connected client updates.
 *  - GET  /feed?channel=x (SSE): a live server stream (a random-walk metric)
 *    that the `LiveFeed` brick subscribes to, demonstrating piped-in elements.
 *
 * Run: PORT=1234 node scripts/collab-server.mjs
 */
import http from "node:http";
import { WebSocketServer } from "ws";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";

const HOST = process.env.COLLAB_HOST || "0.0.0.0";
const PORT = Number(process.env.COLLAB_PORT || process.env.PORT || 1234);

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const WS_CONNECTING = 0;
const WS_OPEN = 1;
const PING_TIMEOUT = 30000;

/** docName -> shared doc. */
const docs = new Map();

class WSSharedDoc extends Y.Doc {
  constructor(name) {
    super({ gc: true });
    this.name = name;
    /** conn -> Set<clientID> controlled by that conn (for awareness cleanup). */
    this.conns = new Map();
    this.awareness = new awarenessProtocol.Awareness(this);
    this.awareness.setLocalState(null);

    this.awareness.on("update", ({ added, updated, removed }, conn) => {
      const changed = added.concat(updated, removed);
      if (conn !== null) {
        const ids = this.conns.get(conn);
        if (ids) {
          added.forEach((id) => ids.add(id));
          removed.forEach((id) => ids.delete(id));
        }
      }
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        encoder,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
      );
      const buf = encoding.toUint8Array(encoder);
      this.conns.forEach((_, c) => send(this, c, buf));
    });

    this.on("update", (update) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      const message = encoding.toUint8Array(encoder);
      this.conns.forEach((_, conn) => send(this, conn, message));
    });
  }
}

function getYDoc(docName) {
  let doc = docs.get(docName);
  if (!doc) {
    doc = new WSSharedDoc(docName);
    docs.set(docName, doc);
  }
  return doc;
}

function closeConn(doc, conn) {
  if (doc.conns.has(conn)) {
    const ids = doc.conns.get(conn);
    doc.conns.delete(conn);
    awarenessProtocol.removeAwarenessStates(doc.awareness, Array.from(ids), null);
  }
  conn.close();
}

function send(doc, conn, message) {
  if (conn.readyState !== WS_CONNECTING && conn.readyState !== WS_OPEN) {
    closeConn(doc, conn);
    return;
  }
  try {
    conn.send(message, (err) => err != null && closeConn(doc, conn));
  } catch {
    closeConn(doc, conn);
  }
}

function messageListener(conn, doc, message) {
  try {
    const encoder = encoding.createEncoder();
    const decoder = decoding.createDecoder(message);
    const type = decoding.readVarUint(decoder);
    switch (type) {
      case MESSAGE_SYNC:
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        syncProtocol.readSyncMessage(decoder, encoder, doc, conn);
        if (encoding.length(encoder) > 1) {
          send(doc, conn, encoding.toUint8Array(encoder));
        }
        break;
      case MESSAGE_AWARENESS:
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          conn,
        );
        break;
    }
  } catch (err) {
    console.error("message error:", err);
  }
}

function setupWSConnection(conn, req) {
  conn.binaryType = "arraybuffer";
  const docName = (req.url || "").slice(1).split("?")[0] || "default";
  const doc = getYDoc(docName);
  doc.conns.set(conn, new Set());

  conn.on("message", (msg) => messageListener(conn, doc, new Uint8Array(msg)));

  let pongReceived = true;
  const pingInterval = setInterval(() => {
    if (!pongReceived) {
      if (doc.conns.has(conn)) closeConn(doc, conn);
      clearInterval(pingInterval);
    } else if (doc.conns.has(conn)) {
      pongReceived = false;
      try {
        conn.ping();
      } catch {
        closeConn(doc, conn);
        clearInterval(pingInterval);
      }
    }
  }, PING_TIMEOUT);
  conn.on("pong", () => {
    pongReceived = true;
  });
  conn.on("close", () => {
    closeConn(doc, conn);
    clearInterval(pingInterval);
  });

  // Send sync step 1 + current awareness.
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(doc, conn, encoding.toUint8Array(encoder));

  const states = doc.awareness.getStates();
  if (states.size > 0) {
    const e2 = encoding.createEncoder();
    encoding.writeVarUint(e2, MESSAGE_AWARENESS);
    encoding.writeVarUint8Array(
      e2,
      awarenessProtocol.encodeAwarenessUpdate(doc.awareness, Array.from(states.keys())),
    );
    send(doc, conn, encoding.toUint8Array(e2));
  }
}

// ---- HTTP (inject + SSE) ----
function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const feeds = new Map(); // channel -> Set<res>

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === "POST" && url.pathname === "/inject") {
    try {
      const body = await readJson(req);
      if (!body.widget) {
        res.writeHead(400, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "missing 'widget'" }));
        return;
      }
      const room = body.room || "room-widget";
      const key = body.key || "default";
      const doc = getYDoc(room);
      doc.getMap("canvas").set(key, body.widget);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, room, key }));
    } catch (err) {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/feed") {
    const channel = url.searchParams.get("channel") || "default";
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write("retry: 2000\n\n");
    if (!feeds.has(channel)) feeds.set(channel, new Set());
    feeds.get(channel).add(res);
    req.on("close", () => feeds.get(channel)?.delete(res));
    return;
  }

  res.writeHead(200, { "content-type": "text/plain" });
  res.end("collab-server ok");
});

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", setupWSConnection);
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => wss.emit("connection", ws, request));
});

// Drive SSE feeds with an independent random walk per channel.
const values = new Map();
setInterval(() => {
  for (const [channel, clients] of feeds) {
    if (clients.size === 0) continue;
    const prev = values.get(channel) ?? 50;
    const next = Math.max(0, Math.min(100, prev + (Math.random() - 0.5) * 14));
    values.set(channel, next);
    const payload = JSON.stringify({ t: Date.now(), value: Math.round(next) });
    for (const res of clients) res.write(`data: ${payload}\n\n`);
  }
}, 1000);

server.listen(PORT, HOST, () => {
  console.log(`collab-server: ws + http on ${HOST}:${PORT}`);
});
