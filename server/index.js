// Smutje – Hauptserver: Express (HTTP) + WebSocket auf einem Port

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { stmts } = require('./db');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

app.use(express.json());

// Client-Dateien ausliefern (lokal: ../client, Docker: /client)
const clientDir = process.env.CLIENT_DIR || path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

// --- REST-Endpunkte ---

// Login: Name entgegennehmen, zurückgeben
app.post('/login', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) {
    return res.status(400).json({ error: 'Name fehlt' });
  }
  res.json({ name });
});

// Channels auflisten
app.get('/channels', (req, res) => {
  const channels = stmts.getChannels.all().map((c) => c.name);
  res.json(channels);
});

// Letzte 50 Nachrichten eines Channels
app.get('/messages/:channel', (req, res) => {
  const rows = stmts.getMessages.all(req.params.channel);
  // Chronologische Reihenfolge (älteste zuerst)
  res.json(rows.reverse());
});

// --- WebSocket-Server ---

const wss = new WebSocketServer({ server });

// Verbundene Clients: Map<ws, { name, channel }>
const clients = new Map();

wss.on('connection', (ws) => {
  // Warte auf erste Nachricht mit Name
  let registered = false;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Erste Nachricht muss Name enthalten
    if (!registered) {
      const name = (msg.name || '').trim();
      if (!name) {
        ws.close(4001, 'Name fehlt');
        return;
      }
      registered = true;
      clients.set(ws, { name, channel: 'allgemein' });
      return;
    }

    const client = clients.get(ws);

    // Channel wechseln
    if (msg.type === 'join' && msg.channel) {
      client.channel = msg.channel;
      return;
    }

    // Nachricht senden
    if (msg.type === 'message' && msg.text && msg.text.trim()) {
      const text = msg.text.trim().slice(0, 2000); // Max 2000 Zeichen
      const channel = client.channel;

      // In DB speichern
      stmts.insertMessage.run(channel, client.name, text);

      // An alle Clients im gleichen Channel senden
      const payload = JSON.stringify({
        type: 'message',
        channel,
        user: client.name,
        text,
        ts: new Date().toISOString(),
      });

      for (const [peer, info] of clients) {
        if (info.channel === channel && peer.readyState === 1) {
          peer.send(payload);
        }
      }
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Smutje läuft auf http://localhost:${PORT}`);
});
