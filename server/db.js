const Database = require("better-sqlite3");
const path = require("path");

const db = new Database(path.join(__dirname, "assets.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    asset_id TEXT NOT NULL UNIQUE,
    category TEXT NOT NULL,
    photo_path TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    source TEXT NOT NULL DEFAULT 'manual'
  )
`);

module.exports = db;