const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

/** Electron 主进程会设置 userData 下的路径；纯 node server 用项目目录 ping.db */
const dbFile = process.env.PING_DB_PATH
  ? path.resolve(process.env.PING_DB_PATH)
  : path.join(process.cwd(), 'ping.db');

try {
  const dir = path.dirname(dbFile);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
} catch (e) {
  console.error('创建数据库目录失败:', e.message);
}

const db = new sqlite3.Database(dbFile, (err) => {
  if (err) console.error('数据库连接失败:', err);
  else console.log('数据库连接成功:', dbFile);
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
    width REAL DEFAULT 67,
    height REAL DEFAULT 50
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS app_meta (k TEXT PRIMARY KEY, v TEXT)`);

  /**
   * 示例 IP 只会在「该库从未做过种子决策」时插入一次。
   * 若用户删光列表，ip_list 为空也不会再插入（避免删了 PC01 重启又出现）。
   */
  db.get(`SELECT v FROM app_meta WHERE k = 'demo_seed_v1'`, (err, row) => {
    if (err) {
      console.error('读取 app_meta 失败:', err);
      return;
    }
    if (row) return;

    db.get(`SELECT COUNT(*) AS c FROM ip_list`, (e2, r2) => {
      if (e2) {
        console.error('检查 ip_list 失败:', e2);
        db.run(`INSERT OR REPLACE INTO app_meta (k, v) VALUES ('demo_seed_v1', '1')`);
        return;
      }
      const empty = r2 && r2.c === 0;
      if (empty) {
        db.run(
          `INSERT OR IGNORE INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          ['192.168.137.1', 'PC01', 0, 0, 40, 67, 50]
        );
        db.run(`INSERT OR IGNORE INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`, [
          '192.168.137.1',
          0,
          null,
          new Date().toISOString(),
        ]);
      }
      db.run(`INSERT OR REPLACE INTO app_meta (k, v) VALUES ('demo_seed_v1', '1')`);
    });
  });
});

module.exports = db;
