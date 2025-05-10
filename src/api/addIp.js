const db = require('../db/database');
const { pingIp } = require('../utils/ping');

async function addIp(req, res) {
  const { ip, number } = req.body;
  if (!ip || !number) {
    return res.status(400).json({ error: 'IP 和编号不能为空' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ip, number, 0, 0, 40, 150, 150],
        (err) => err ? reject(err) : resolve()
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
        [ip, 0, null, new Date().toISOString()],
        (err) => err ? reject(err) : resolve()
      );
    });

    await loadIpList();
    await pingIp(ipList);
    res.json({ message: 'IP 添加成功', ip, number });
  } catch (error) {
    console.error(`插入 IP ${ip} 失败:`, error);
    res.status(500).json({ error: '添加 IP 失败' });
  }
}

async function loadIpList() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ip_list`, (err, rows) => {
      if (err) return reject(err);
      ipList = rows.map(row => ({
        ip: row.ip,
        number: row.number,
        status: row.status,
        position_x: row.position_x,
        position_y: row.position_y,
        width: row.width,
        height: row.height
      }));
      resolve();
    });
  });
}

module.exports = { addIp };