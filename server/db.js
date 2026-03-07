// Datenbank-Modul: SQLite-Verbindung, Schema und Standarddaten

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'smutje.db');

// Sicherstellen, dass das Verzeichnis existiert
const fs = require('fs');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL-Modus für bessere Performance bei gleichzeitigen Lesezugriffen
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tabellen erstellen
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    token TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    user TEXT NOT NULL,
    text TEXT NOT NULL,
    ts DATETIME DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel);
  CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);
`);

// Standard-Channels anlegen (falls nicht vorhanden)
const insertChannel = db.prepare('INSERT OR IGNORE INTO channels (name) VALUES (?)');
for (const ch of ['allgemein', 'küche', 'rezepte', 'dienste']) {
  insertChannel.run(ch);
}

// Standard-User anlegen (Tokens aus Umgebungsvariablen)
const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, token) VALUES (?, ?)');
const defaultUsers = [
  { name: 'andreas', envKey: 'TOKEN_ANDREAS' },
  { name: 'marco', envKey: 'TOKEN_MARCO' },
  { name: 'lea', envKey: 'TOKEN_LEA' },
  { name: 'toni', envKey: 'TOKEN_TONI' },
];

for (const u of defaultUsers) {
  const token = process.env[u.envKey];
  if (token) {
    insertUser.run(u.name, token);
  }
}

// Prepared Statements für häufige Abfragen
const stmts = {
  getUserByToken: db.prepare('SELECT * FROM users WHERE token = ?'),
  getChannels: db.prepare('SELECT name FROM channels ORDER BY id'),
  getMessages: db.prepare(
    'SELECT user, text, ts FROM messages WHERE channel = ? ORDER BY ts DESC LIMIT 50'
  ),
  insertMessage: db.prepare(
    'INSERT INTO messages (channel, user, text) VALUES (?, ?, ?)'
  ),
};

module.exports = { db, stmts };
