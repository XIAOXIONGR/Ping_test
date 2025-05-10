const db = require('../db/database');
const { loadIpList } = require('../utils/ping');

async function deleteIp(req, res) {
  const { ip } = req.body;
  if (!ip) {
    return res.status(400).json({ error: 'IP 不能为空' });
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
      db.run(`DELETE FROM ip_list WHERE ip = ?`, [ip], (err) => {
        if (err) {
          console.error(`删除 IP ${ip} 从 ip_list 失败:`, err);
          reject(err);
        } else {
          console.log(`已删除 IP ${ip} 从 ip_list`);
          resolve();
        }
      });
    });

    await new Promise((resolve, reject) => {
      db.run(`DELETE FROM ping_records WHERE ip = ?`, [ip], (err) => {
        if (err) {
          console.error(`删除 IP ${ip} 从 ping_records 失败:`, err);
          reject(err);
        } else {
          console.log(`已删除 IP ${ip} 从 ping_records`);
          resolve();
        }
      });
    });

    await loadIpList();
    res.json({ message: 'IP 删除成功', ip });
  } catch (error) {
    console.error(`删除 IP ${ip} 失败:`, error);
    res.status(500).json({ error: '删除 IP 失败' });
  }
}

module.exports = deleteIp;