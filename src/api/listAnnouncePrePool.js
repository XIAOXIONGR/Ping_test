const path = require('path');
const fs = require('fs');

const poolDir = path.join(__dirname, '../../public/audio/announce/pre_pool');

function safePoolMp3Name(name) {
  const base = path.basename(String(name));
  if (base !== String(name).replace(/\\/g, '/').split('/').pop()) return null;
  if (!/\.mp3$/i.test(base)) return null;
  if (base.includes('..')) return null;
  if (/[/\\<>|]/.test(base)) return null;
  return base;
}

/**
 * GET /announce-pre-pool
 * 列出 public/audio/announce/pre_pool/ 下所有 .mp3（用于片头，文件名勿含路径字符）
 */
function listAnnouncePrePool(req, res) {
  try {
    if (!fs.existsSync(poolDir)) {
      return res.json({ files: [] });
    }
    const names = fs
      .readdirSync(poolDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .map((name) => safePoolMp3Name(name))
      .filter(Boolean);
    names.sort((a, b) => a.localeCompare(b, 'zh'));
    res.json({ files: names });
  } catch (e) {
    console.error('listAnnouncePrePool:', e);
    res.status(500).json({ error: e.message || '读取 pre_pool 列表失败' });
  }
}

module.exports = { listAnnouncePrePool, safePoolMp3Name };
