const db = require('../db/database');
const { loadIpList, pingIp } = require('../utils/ping');

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
        (err) => {
          if (err) {
            console.error(`插入 IP ${ip} 失败:`, err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
        [ip, 0, null, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error(`插入 ${ip} 初始记录失败:`, err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });

    await loadIpList();
    await pingIp();
    res.json({ message: 'IP 添加成功', ip, number });
  } catch (error) {
    res.status(500).json({ error: '添加 IP 失败' });
  }
}

module.exports = addIp;