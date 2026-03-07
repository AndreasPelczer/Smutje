// Smutje – Hauptserver: Express (HTTP) + WebSocket auf einem Port

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const { stmts } = require('./db');
const { authMiddleware, authenticateToken } = require('./auth');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);

app.use(express.json());

// Client-Dateien ausliefern
app.use(express.static(path.join(__dirname, '..', 'client')));

// --- REST-Endpunkte ---

// Login: Token prüfen, Username zurückgeben
app.post('/login', (req, res) => {
  const token = req.headers['x-token'] || req.body.token;
  const user = authenticateToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Ungültiges Token' });
  }
  res.json({ name: user.name });
});

// Channels auflisten
app.get('/channels', authMiddleware, (req, res) => {
  const channels = stmts.getChannels.all().map((c) => c.name);
  res.json(channels);
});

// Letzte 50 Nachrichten eines Channels
app.get('/messages/:channel', authMiddleware, (req, res) => {
  const rows = stmts.getMessages.all(req.params.channel);
  // Chronologische Reihenfolge (älteste zuerst)
  res.json(rows.reverse());
});

// --- WebSocket-Server ---

const wss = new WebSocketServer({ server });

// Verbundene Clients: Map<ws, { user, channel }>
const clients = new Map();

wss.on('connection', (ws, req) => {
  // Token aus Query-Parameter lesen (?token=...)
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  const user = authenticateToken(token);

  if (!user) {
    ws.close(4001, 'Nicht authentifiziert');
    return;
  }

  // Standard-Channel: allgemein
  clients.set(ws, { user: user.name, channel: 'allgemein' });

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    const client = clients.get(ws);

    // Channel wechseln
    if (msg.type === 'join') {
      client.channel = msg.channel;
      return;
    }

    // Nachricht senden
    if (msg.type === 'message' && msg.text && msg.text.trim()) {
      const text = msg.text.trim().slice(0, 2000); // Max 2000 Zeichen
      const channel = client.channel;

      // In DB speichern
      stmts.insertMessage.run(channel, client.user, text);

      // An alle Clients im gleichen Channel senden
      const payload = JSON.stringify({
        type: 'message',
        channel,
        user: client.user,
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
