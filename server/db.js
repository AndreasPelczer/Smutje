// Datenbank-Modul: SQLite-Verbindung, Schema und Standarddaten

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'smutje.db');

// Sicherstellen, dass das Verzeichnis existiert
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// WAL-Modus für bessere Performance bei gleichzeitigen Lesezugriffen
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Tabellen erstellen und Standarddaten anlegen
function initDB() {
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
      channel_id INTEGER NOT NULL REFERENCES channels(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      ts DATETIME DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id);
    CREATE INDEX IF NOT EXISTS idx_messages_ts ON messages(ts);
  `);

  // Standard-Channels anlegen
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
}

initDB();

// Prepared Statements für häufige Abfragen
const stmts = {
  getUserByToken: db.prepare('SELECT id, name, token FROM users WHERE token = ?'),
  getChannels: db.prepare('SELECT id, name FROM channels ORDER BY id'),
  getChannelByName: db.prepare('SELECT id, name FROM channels WHERE name = ?'),
  getMessages: db.prepare(`
    SELECT u.name AS user, m.text, m.ts
    FROM messages m
    JOIN users u ON u.id = m.user_id
    JOIN channels c ON c.id = m.channel_id
    WHERE c.name = ?
    ORDER BY m.ts DESC
    LIMIT 50
  `),
  insertMessage: db.prepare(
    'INSERT INTO messages (channel_id, user_id, text) VALUES (?, ?, ?)'
  ),
};

module.exports = { db, stmts, initDB };
