const Database = require('better-sqlite3');
const db = new Database(process.env.DB_PATH || 'database.sqlite');
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS players (
  jid TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT 'Player',
  hp INTEGER NOT NULL DEFAULT 100, max_hp INTEGER NOT NULL DEFAULT 100,
  mana INTEGER NOT NULL DEFAULT 50, max_mana INTEGER NOT NULL DEFAULT 50,
  money INTEGER NOT NULL DEFAULT 100000, floor INTEGER NOT NULL DEFAULT 1,
  xp INTEGER NOT NULL DEFAULT 0, level INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS rentals (
  group_jid TEXT PRIMARY KEY, expires_at TEXT NOT NULL, updated_by TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admins (jid TEXT PRIMARY KEY, added_by TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor TEXT, action TEXT NOT NULL, details TEXT
);
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sender TEXT, recipient TEXT, amount INTEGER NOT NULL, note TEXT
);
`);

const defaults = { prefix: process.env.PREFIX || '.', botName: process.env.BOT_NAME || 'ASHIROU BOT V1', rpgEnabled: 'true', rentalRpgOnly: 'false', theme: 'violet', darkMode: 'true', animations: 'true' };
const put = db.prepare('INSERT OR IGNORE INTO settings(key,value) VALUES (?,?)');
for (const [k,v] of Object.entries(defaults)) put.run(k, String(v));
function log(actor, action, details='') {
  db.prepare('INSERT INTO logs(actor,action,details) VALUES (?,?,?)').run(actor || 'system', action, String(details));
}
function setting(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row ? row.value : undefined;
}
function setSetting(key, value) {
  db.prepare('INSERT INTO settings(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, String(value));
}
module.exports = { db, log, setting, setSetting };
