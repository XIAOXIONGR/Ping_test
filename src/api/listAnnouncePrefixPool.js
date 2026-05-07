const path = require('path');
const fs = require('fs');

const poolDir = path.join(__dirname, '../../public/audio/announce/prefix_pool');

function safePoolMp3Name(name) {
  const base = path.basename(String(name));
  if (base !== String(name).replace(/\\/g, '/').split('/').pop()) return null;
  if (!/\.mp3$/i.test(base)) return null;
  if (base.includes('..')) return null;
  if (/[/\\<>|]/.test(base)) return null;
  return base;
}

function listAnnouncePrefixPool(req, res) {
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
    console.error('listAnnouncePrefixPool:', e);
    res.status(500).json({ error: e.message || '读取 prefix_pool 列表失败' });
  }
}

module.exports = { listAnnouncePrefixPool };
