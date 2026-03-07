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

// Client-Dateien ausliefern (lokal: ../client, Docker: /client)
const clientDir = process.env.CLIENT_DIR || path.join(__dirname, '..', 'client');
app.use(express.static(clientDir));

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

wss.on('connection', (ws) => {
  // Noch nicht authentifiziert – warte auf erste Nachricht mit Token
  let authenticated = false;

  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    // Erste Nachricht muss Token enthalten
    if (!authenticated) {
      const user = authenticateToken(msg.token);
      if (!user) {
        ws.close(4001, 'Nicht authentifiziert');
        return;
      }
      authenticated = true;
      clients.set(ws, { user, channel: 'allgemein' });
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
      const channelName = client.channel;

      // Channel-ID aus DB holen
      const channel = stmts.getChannelByName.get(channelName);
      if (!channel) return;

      // In DB speichern
      stmts.insertMessage.run(channel.id, client.user.id, text);

      // An alle Clients im gleichen Channel senden
      const payload = JSON.stringify({
        type: 'message',
        channel: channelName,
        user: client.user.name,
        text,
        ts: new Date().toISOString(),
      });

      for (const [peer, info] of clients) {
        if (info.channel === channelName && peer.readyState === 1) {
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
