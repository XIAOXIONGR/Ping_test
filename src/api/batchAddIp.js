const db = require('../db/database');
const { loadIpList, pingIp } = require('../utils/ping');

const MAX_BATCH = 512;

function parseIPv4(ip) {
  const m = String(ip).trim().match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) throw new Error('IP 格式无效');
  const parts = [m[1], m[2], m[3], m[4]].map((x) => parseInt(x, 10));
  if (parts.some((p) => p < 0 || p > 255)) throw new Error('IP 数值无效');
  return (parts[0] * 0x1000000 + parts[1] * 0x10000 + parts[2] * 0x100 + parts[3]) >>> 0;
}

function formatIPv4(num) {
  const n = num >>> 0;
  return [
    (n >>> 24) & 255,
    (n >>> 16) & 255,
    (n >>> 8) & 255,
    n & 255,
  ].join('.');
}

function formatMachineNumber(prefix, n, digits) {
  const p = String(prefix || '');
  const core = digits > 0 ? String(n).padStart(digits, '0') : String(n);
  return `${p}${core}`;
}

function insertOne(ip, number) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [ip, number, 0, 0, 40, 150, 150],
      function (err) {
        if (err) {
          if (err.message && err.message.includes('UNIQUE')) {
            resolve({ ok: false, reason: 'exists' });
          } else {
            reject(err);
          }
          return;
        }
        db.run(
          `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
          [ip, 0, null, new Date().toISOString()],
          (err2) => {
            if (err2) reject(err2);
            else resolve({ ok: true });
          }
        );
      }
    );
  });
}

async function batchAddIp(req, res) {
  const {
    startIp,
    endIp,
    numberPrefix = '',
    numberStart = 1,
    numberDigits = 2,
  } = req.body || {};

  if (!startIp || !endIp) {
    return res.status(400).json({ error: '起始 IP 与结束 IP 不能为空' });
  }

  let a;
  let b;
  try {
    a = parseIPv4(startIp);
    b = parseIPv4(endIp);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (a > b) {
    return res.status(400).json({ error: '起始 IP 不能大于结束 IP' });
  }

  const total = b - a + 1;
  if (total > MAX_BATCH) {
    return res.status(400).json({ error: `单次最多添加 ${MAX_BATCH} 个 IP` });
  }

  const startNum = parseInt(numberStart, 10);
  if (!Number.isFinite(startNum)) {
    return res.status(400).json({ error: '起始序号无效' });
  }

  const digits = Math.max(0, Math.min(6, parseInt(numberDigits, 10) || 0));

  const added = [];
  const skipped = [];

  for (let offset = 0; offset < total; offset++) {
    const ip = formatIPv4(a + offset);
    const number = formatMachineNumber(numberPrefix, startNum + offset, digits);
    try {
      const r = await insertOne(ip, number);
      if (r.ok) added.push({ ip, number });
      else skipped.push(ip);
    } catch (err) {
      console.error(`批量添加 ${ip} 失败:`, err);
      return res.status(500).json({
        error: err.message || '批量添加失败',
        addedCount: added.length,
        added,
        skipped,
      });
    }
  }

  await loadIpList();
  pingIp().catch((err) => console.error('pingIp 错误:', err));

  res.json({
    message: '批量添加完成',
    addedCount: added.length,
    skippedCount: skipped.length,
    added,
    skipped,
  });
}

module.exports = batchAddIp;
