const db = require('../db/database');
const { loadIpList } = require('../utils/ping');

async function updatePosition(req, res) {
  const { ip, position_x, position_y } = req.body;
  if (!ip || position_x === undefined || position_y === undefined) {
    return res.status(400).json({ error: 'IP 和位置信息不能为空' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE ip_list SET position_x = ?, position_y = ? WHERE ip = ?`,
        [position_x, position_y, ip],
        (err) => {
          if (err) {
            console.error(`更新 ${ip} 位置失败:`, err);
            reject(err);
          } else {
            console.log(`更新 ${ip} 位置为 (${position_x}, ${position_y})`);
            resolve();
          }
        }
      );
    });

    await loadIpList();
    res.json({ message: '位置更新成功', ip, position_x, position_y });
  } catch (error) {
    res.status(500).json({ error: '更新位置失败' });
  }
}

module.exports = updatePosition;