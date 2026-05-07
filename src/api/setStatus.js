const db = require('../db/database');
const { loadIpList, pingIp } = require('../utils/ping');

function normStatus(s) {
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || ![0, 1, 2].includes(n)) return null;
  return n;
}

function pickTargetQuery(body) {
  if (!body || typeof body !== 'object') return '';
  if (body.ip != null && String(body.ip).trim() !== '') return String(body.ip).trim();
  if (body.number != null && String(body.number).trim() !== '') return String(body.number).trim();
  return '';
}

function resolveTargetIps(raw) {
  const q = String(raw).trim();
  if (!q) {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    db.all(`SELECT ip FROM ip_list WHERE ip = ?`, [q], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      const fromIp = (rows || []).map((r) => r.ip);
      if (fromIp.length > 0) {
        resolve(fromIp);
        return;
      }
      db.all(`SELECT ip FROM ip_list WHERE number = ?`, [q], (err2, rows2) => {
        if (err2) {
          reject(err2);
        } else {
          resolve((rows2 || []).map((r) => r.ip));
        }
      });
    });
  });
}

async function setStatus(req, res) {
  const status = normStatus(req.body && req.body.status);
  const raw = pickTargetQuery(req.body);

  if (!raw || status === null) {
    return res.status(400).json({
      error: '请填写 IP 或编号，并选择有效状态（空闲/使用中/维修中）',
    });
  }

  try {
    const ips = await resolveTargetIps(raw);
    if (ips.length === 0) {
      return res.status(404).json({ error: `未找到 IP 或编号「${raw}」` });
    }

    for (const ip of ips) {
      const changes = await new Promise((resolve, reject) => {
        db.run(
          `UPDATE ip_list SET status = ? WHERE ip = ?`,
          [status, ip],
          function (err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });

      if (changes === 0) {
        return res.status(404).json({ error: `IP ${ip} 未更新` });
      }

      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
          [ip, status, null, new Date().toISOString()],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    }

    await loadIpList();
    pingIp().catch((err) => console.error('pingIp 错误:', err));
    res.json({
      message: '状态更新成功',
      ips,
      count: ips.length,
      status,
    });
  } catch (error) {
    console.error('设置状态失败:', error);
    res.status(500).json({ error: error.message || '设置状态失败' });
  }
}

module.exports = setStatus;
