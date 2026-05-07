const path = require('path');
const fs = require('fs');

const announceDir = path.join(__dirname, '../../public/audio/announce');

function safePreMp3Name(name) {
  const base = path.basename(String(name));
  if (!/^pre[a-zA-Z0-9_-]*\.mp3$/i.test(base)) return null;
  return base;
}

/**
 * GET /announce-pres
 * 列出 public/audio/announce 下所有 pre*.mp3（文件名须为 pre 开头、仅字母数字下划线连字符、.mp3 结尾）
 */
function listAnnouncePres(req, res) {
  try {
    if (!fs.existsSync(announceDir)) {
      return res.json({ files: [] });
    }
    const names = fs
      .readdirSync(announceDir, { withFileTypes: true })
      .filter((d) => d.isFile())
      .map((d) => d.name)
      .filter((name) => safePreMp3Name(name));
    names.sort((a, b) => a.localeCompare(b, 'en'));
    res.json({ files: names });
  } catch (e) {
    console.error('listAnnouncePres:', e);
    res.status(500).json({ error: e.message || '读取预录音列表失败' });
  }
}

module.exports = { listAnnouncePres, safePreMp3Name };
