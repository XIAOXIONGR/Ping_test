const db = require('../db/database');
const { loadIpList } = require('../utils/ping');

const MAX_BATCH = 512;

async function batchDeleteIp(req, res) {
  let { ips } = req.body || {};
  if (!ips || !Array.isArray(ips)) {
    return res.status(400).json({ error: '请提供要删除的 IP 列表' });
  }

  ips = [...new Set(ips.map((x) => String(x).trim()).filter(Boolean))];
  if (ips.length === 0) {
    return res.status(400).json({ error: '未选择任何 IP' });
  }
  if (ips.length > MAX_BATCH) {
    return res.status(400).json({ error: `单次最多删除 ${MAX_BATCH} 个 IP` });
  }

  const deleted = [];
  const notFound = [];

  try {
    for (const ip of ips) {
      const ipExists = await new Promise((resolve, reject) => {
        db.get(`SELECT 1 FROM ip_list WHERE ip = ?`, [ip], (err, row) => {
          if (err) reject(err);
          else resolve(!!row);
        });
      });

      if (!ipExists) {
        notFound.push(ip);
        continue;
      }

      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM ip_list WHERE ip = ?`, [ip], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM ping_records WHERE ip = ?`, [ip], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      deleted.push(ip);
    }

    await loadIpList();

    res.json({
      message: '批量删除完成',
      deletedCount: deleted.length,
      deleted,
      notFoundCount: notFound.length,
      notFound,
    });
  } catch (error) {
    console.error('批量删除 IP 失败:', error);
    res.status(500).json({ error: error.message || '批量删除失败' });
  }
}

module.exports = batchDeleteIp;
