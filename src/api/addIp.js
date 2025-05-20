const db = require('../db/database');
const { loadIpList, pingIp } = require('../utils/ping');

async function addIp(req, res) {
  const { ip, number } = req.body;
  if (!ip || !number) {
    return res.status(400).json({ error: 'IP 和编号不能为空' });
  }

  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [ip, number, 0, 0, 40, 150, 150],
        function (err) {
          if (err) {
            console.error(`插入 IP ${ip} 失败:`, err);
            if (err.message.includes('UNIQUE constraint')) {
              reject(new Error('IP 已存在'));
            }
            reject(err);
          } else {
            console.log(`插入 IP ${ip} 成功，变化行数: ${this.changes}`);
            resolve(this.changes);
          }
        }
      );
    });

    if (result === 0) {
      return res.status(400).json({ error: 'IP 已存在，未添加' });
    }

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
        [ip, 0, null, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error(`插入 ${ip} 初始记录失败:`, err);
            reject(err);
          } else {
            console.log(`插入 ${ip} 初始记录成功`);
            resolve();
          }
        }
      );
    });

    await loadIpList();
    pingIp().catch(err => console.error('pingIp 错误:', err));
    res.json({ message: 'IP 添加成功', ip, number });
  } catch (error) {
    console.error('添加 IP 错误:', error);
    res.status(500).json({ error: error.message || '添加 IP 失败' });
  }
}

module.exports = addIp;