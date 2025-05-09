// ping.js
const ping = require('ping');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');

const app = express();

// 连接数据库
const db = new sqlite3.Database('ping.db', (err) => {
  if (err) console.error('数据库连接失败:', err);
  else console.log('数据库连接成功');
});

// 创建表
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS ping_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    status INTEGER,
    latency REAL,
    timestamp TEXT
  )`);

  // 插入初始数据（可选，方便测试）
  db.run(`INSERT OR IGNORE INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`, 
    ['192.168.137.1', 0, null, new Date().toISOString()]);
});

// 您的 IP 地址
const targetIp = '192.168.137.1';

// 定时 ping
async function pingIp() {
  try {
    const res = await ping.promise.probe(targetIp, { timeout: 2 });
    const status = res.alive ? 1 : 0; // 1: 在线, 0: 离线
    const latency = res.alive ? parseFloat(res.avg) : null; // 平均延迟（毫秒）
    const timestamp = new Date().toISOString();

    // 插入状态记录
    db.run(
      `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
      [targetIp, status, latency, timestamp],
      (err) => {
        if (err) {
          console.error('插入记录失败:', err);
        } else {
          console.log(`IP ${targetIp}: ${status === 1 ? '在线' : '离线'} (延迟: ${latency || '-'}ms, ${timestamp})`);
        }
      }
    );
  } catch (error) {
    console.error('Ping 错误:', error);
  }
}

// 每 30 秒 ping 一次
setInterval(pingIp, 30 * 1000);

// 首次运行
pingIp();

// Web 界面查看状态（表格页面）
app.get('/', (req, res) => {
  db.all(`SELECT * FROM ping_records WHERE ip = ? ORDER BY timestamp DESC LIMIT 10`, [targetIp], (err, records) => {
    if (err) {
      res.send('获取状态记录失败');
      return;
    }
    let html = `
      <h1>IP 状态监控 (${targetIp})</h1>
      <table border="1">
        <tr>
          <th>时间</th>
          <th>状态</th>
          <th>延迟 (ms)</th>
        </tr>`;
    records.forEach(record => {
      html += `
        <tr>
          <td>${record.timestamp}</td>
          <td>${record.status === 1 ? '在线' : '离线'}</td>
          <td>${record.latency || '-'}</td>
        </tr>`;
    });
    html += `</table>`;
    res.send(html);
  });
});

// API 路由，返回最新状态
app.get('/status', (req, res) => {
  db.get(`SELECT * FROM ping_records WHERE ip = ? ORDER BY timestamp DESC LIMIT 1`, [targetIp], (err, record) => {
    if (err) {
      res.status(500).json({ error: '获取状态失败' });
      return;
    }
    if (!record) {
      res.status(404).json({ error: '无状态记录' });
      return;
    }
    res.json({
      ip: record.ip,
      status: record.status, // 1: 在线, 0: 离线
      latency: record.latency,
      timestamp: record.timestamp
    });
  });
});

// 设置静态文件目录
app.use(express.static('public'));

app.listen(3000, () => {
  console.log('状态监控页面运行在 http://localhost:3000');
  console.log('状态 API 运行在 http://localhost:3000/status');
  console.log('前端页面运行在 http://localhost:3000/index.html');
});

// 程序退出时关闭数据库
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('关闭数据库失败:', err);
    console.log('数据库已关闭');
    process.exit(0);
  });
});