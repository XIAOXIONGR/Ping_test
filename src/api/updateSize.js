const db = require('../db/database');
const { loadIpList } = require('../utils/ping');

async function updateSize(req, res) {
  const { ip, width, height } = req.body;
  if (!ip || width === undefined || height === undefined) {
    return res.status(400).json({ error: 'IP 和尺寸信息不能为空' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE ip_list SET width = ?, height = ? WHERE ip = ?`,
        [width, height, ip],
        (err) => {
          if (err) {
            console.error(`更新 ${ip} 尺寸失败:`, err);
            reject(err);
          } else {
            console.log(`更新 ${ip} 尺寸为 (${width}, ${height})`);
            resolve();
          }
        }
      );
    });

    await loadIpList();
    res.json({ message: '尺寸更新成功', ip, width, height });
  } catch (error) {
    res.status(500).json({ error: '更新尺寸失败' });
  }
}

module.exports = updateSize;