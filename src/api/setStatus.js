const db = require('../db/database');
const { loadIpList, pingIp } = require('../utils/ping');

async function setStatus(req, res) {
  const { ip, status } = req.body;
  if (!ip || status === undefined || ![0, 1, 2].includes(status)) {
    return res.status(400).json({ error: 'IP 和有效状态（0, 1, 2）不能为空' });
  }

  try {
    const ipExists = await new Promise((resolve, reject) => {
      db.get(`SELECT 1 FROM ip_list WHERE ip = ?`, [ip], (err, row) => {
        if (err) reject(err);
        else resolve(!!row);
      });
    });

    if (!ipExists) {
      return res.status(404).json({ error: `IP ${ip} 不存在` });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE ip_list SET status = ? WHERE ip = ?`,
        [status, ip],
        (err) => {
          if (err) {
            console.error(`更新 ${ip} 状态失败:`, err);
            reject(err);
          } else {
            console.log(`更新 ${ip} 状态为 ${status}`);
            resolve();
          }
        }
      );
    });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
        [ip, status, null, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error(`插入 ${ip} 状态记录失败:`, err);
            reject(err);
          } else {
            console.log(`记录插入: IP ${ip}, 状态 ${status}, 延迟: -`);
            resolve();
          }
        }
      );
    });

    await loadIpList();
    await pingIp();
    res.json({ message: '状态更新成功', ip, status });
  } catch (error) {
    console.error(`设置 ${ip} 状态失败:`, error);
    res.status(500).json({ error: '设置状态失败' });
  }
}

module.exports = setStatus;