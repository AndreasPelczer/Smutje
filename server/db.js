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

// Tabellen erstellen und Standarddaten anlegen
function initDB() {
  db.exec(`
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

  // Standard-Channels anlegen
  const insertChannel = db.prepare('INSERT OR IGNORE INTO channels (name) VALUES (?)');
  for (const ch of ['allgemein', 'küche', 'rezepte', 'dienste']) {
    insertChannel.run(ch);
  }
}

initDB();

// Prepared Statements für häufige Abfragen
const stmts = {
  getChannels: db.prepare('SELECT id, name FROM channels ORDER BY id'),
  getMessages: db.prepare(`
    SELECT user, text, ts FROM messages
    WHERE channel = ?
    ORDER BY ts DESC
    LIMIT 50
  `),
  insertMessage: db.prepare(
    'INSERT INTO messages (channel, user, text) VALUES (?, ?, ?)'
  ),
};

module.exports = { db, stmts };
