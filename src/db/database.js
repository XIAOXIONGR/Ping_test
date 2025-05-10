const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('ping.db', (err) => {
  if (err) console.error('数据库连接失败:', err);
  else console.log('数据库连接成功');
});

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS ping_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    status INTEGER,
    latency REAL,
    timestamp TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ip_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE,
    number TEXT,
    status INTEGER DEFAULT 0,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 40,
    width REAL DEFAULT 150,
    height REAL DEFAULT 150
  )`);

  db.run(`INSERT OR IGNORE INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    ['192.168.137.1', 'PC01', 0, 0, 40, 150, 150]);
  db.run(`INSERT OR IGNORE INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`, 
    ['192.168.137.1', 0, null, new Date().toISOString()]);
});

module.exports = db;