const path = require('path');
const fs = require('fs');

const announceDir = path.join(__dirname, '../../public/audio/announce');

function safeSuffixMp3Name(name) {
  const base = path.basename(String(name));
  if (!/^suffix[a-zA-Z0-9_-]*\.mp3$/i.test(base)) return null;
  return base;
}

function listAnnounceSuffix(req, res) {
  try {
    if (!fs.existsSync(announceDir)) {
      return res.json({ files: [] });
    }
    const names = fs
      .readdirSync(announceDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => safeSuffixMp3Name(name));
    names.sort((a, b) => a.localeCompare(b, 'en'));
    res.json({ files: names });
  } catch (e) {
    console.error('listAnnounceSuffix:', e);
    res.status(500).json({ error: e.message || '读取 suffix 列表失败' });
  }
}

module.exports = { listAnnounceSuffix, safeSuffixMp3Name };
