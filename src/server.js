const express = require('express');
const db = require('./db/database');
const { loadIpList, pingIp, getIpList } = require('./utils/ping');
const status = require('./api/status');
const addIp = require('./api/addIp');
const deleteIp = require('./api/deleteIp');
const setStatus = require('./api/setStatus');
const updatePosition = require('./api/updatePosition');
const updateSize = require('./api/updateSize');

const app = express();

app.use(express.json());
app.use(express.static('public'));

// 初始化 IP 列表和定时 ping
loadIpList().then(() => {
  setInterval(() => pingIp(), 30 * 1000);
  pingIp();
});

// 状态监控表格页面
app.get('/', (req, res) => {
  db.all(`SELECT * FROM ping_records ORDER BY timestamp DESC LIMIT 50`, (err, records) => {
    if (err) {
      res.send('获取状态记录失败');
      return;
    }
    let html = `
      <h1>IP 状态监控</h1>
      <table border="1">
        <tr>
          <th>IP</th>
          <th>编号</th>
          <th>时间</th>
          <th>状态</th>
          <th>延迟 (ms)</th>
        </tr>`;
    records.forEach(record => {
      const ipItem = getIpList().find(item => item.ip === record.ip);
      const number = ipItem ? ipItem.number : '-';
      const statusText = record.status === 1 ? '使用中' : record.status === 2 ? '维修中' : '空闲中';
      html += `
        <tr>
          <td>${record.ip}</td>
          <td>${number}</td>
          <td>${record.timestamp}</td>
          <td>${statusText}</td>
          <td>${record.latency || '-'}</td>
        </tr>`;
    });
    html += `</table>`;
    res.send(html);
  });
});

// API 路由
app.get('/status', status);
app.post('/add-ip', addIp);
app.post('/delete-ip', deleteIp);
app.post('/set-status', setStatus);
app.post('/update-position', updatePosition);
app.post('/update-size', updateSize);

app.listen(3000, () => {
  console.log('状态监控页面运行在 http://localhost:3000');
  console.log('状态 API 运行在 http://localhost:3000/status');
  console.log('前端页面运行在 http://localhost:3000/index.html');
});

process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('关闭数据库失败:', err);
    console.log('数据库已关闭');
    process.exit(0);
  });
});