// ping.js
const ping = require('ping');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');

const app = express();

// 允许解析 JSON 请求体
app.use(express.json());

// 连接数据库
const db = new sqlite3.Database('ping.db', (err) => {
  if (err) console.error('数据库连接失败:', err);
  else console.log('数据库连接成功');
});

// 创建表
db.serialize(() => {
  // ping_records 表：存储所有 IP 的 ping 记录
  db.run(`CREATE TABLE IF NOT EXISTS ping_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT,
    status INTEGER,
    latency REAL,
    timestamp TEXT
  )`);

  // ip_list 表：存储用户添加的 IP、编号、状态、位置和尺寸
  db.run(`CREATE TABLE IF NOT EXISTS ip_list (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ip TEXT UNIQUE,
    number TEXT,
    status INTEGER DEFAULT 0, -- 0: 空闲中, 1: 使用中, 2: 维修中
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 40,
    width REAL DEFAULT 150,
    height REAL DEFAULT 150
  )`);

  // 插入初始数据
  db.run(`INSERT OR IGNORE INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
    ['192.168.137.1', 'PC01', 0, 0, 40, 150, 150]);
  db.run(`INSERT OR IGNORE INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`, 
    ['192.168.137.1', 0, null, new Date().toISOString()]);
});

// 存储当前需要 ping 的 IP 列表
let ipList = [];

// 从数据库加载 IP 列表
function loadIpList() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ip_list`, (err, rows) => {
      if (err) {
        console.error('加载 IP 列表失败:', err);
        reject(err);
        return;
      }
      ipList = rows.map(row => ({
        ip: row.ip,
        number: row.number,
        status: row.status,
        position_x: row.position_x,
        position_y: row.position_y,
        width: row.width,
        height: row.height
      }));
      console.log('已加载 IP 列表:', ipList);
      resolve();
    });
  });
}

// 启动时加载 IP 列表
loadIpList();

// 定时 ping 所有 IP
async function pingIp() {
  try {
    for (const item of ipList) {
      let status = item.status;
      let latency = null;

      // 对状态为 0（空闲中）或 1（使用中）的 IP 进行 ping
      if (item.status === 0 || item.status === 1) {
        console.log(`尝试 ping IP ${item.ip} (当前状态: ${item.status})`);
        const res = await ping.promise.probe(item.ip, { timeout: 10 });
        status = res.alive ? 1 : 0; // 1: 在线, 0: 离线
        latency = res.alive ? parseFloat(res.avg) : null;
        console.log(`Ping 结果: IP ${item.ip}, alive: ${res.alive}, 延迟: ${latency || '-'}ms`);
      } else {
        console.log(`跳过 ping IP ${item.ip} (状态: ${item.status})`);
      }

      const timestamp = new Date().toISOString();

      // 插入状态记录
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
          [item.ip, status, latency, timestamp],
          (err) => {
            if (err) {
              console.error(`插入 ${item.ip} 记录失败:`, err);
              reject(err);
            } else {
              console.log(`记录插入: IP ${item.ip} (${item.number}), 状态 ${status}, 延迟: ${latency || '-'}ms, ${timestamp}`);
              resolve();
            }
          }
        );
      });

      // 如果状态变化，更新 ip_list 表
      if (status !== item.status) {
        await new Promise((resolve, reject) => {
          db.run(
            `UPDATE ip_list SET status = ? WHERE ip = ?`,
            [status, item.ip],
            (err) => {
              if (err) {
                console.error(`更新 ${item.ip} 状态失败:`, err);
                reject(err);
              } else {
                console.log(`更新 ${item.ip} 状态为 ${status}`);
                resolve();
              }
            }
          );
        });
      }
    }
    await loadIpList();
  } catch (error) {
    console.error('Ping 错误:', error);
  }
}

// 每 30 秒 ping 一次
setInterval(pingIp, 30 * 1000);

// 首次运行
pingIp();

// Web 界面查看状态（表格页面）
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
      const ipItem = ipList.find(item => item.ip === record.ip);
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

// API 路由，返回所有 IP 的最新状态
app.get('/status', (req, res) => {
  db.all(`SELECT * FROM ip_list`, (err, ipListRecords) => {
    if (err) {
      res.status(500).json({ error: '获取 IP 列表失败' });
      return;
    }

    if (!ipListRecords || ipListRecords.length === 0) {
      res.status(404).json({ error: '无 IP 记录' });
      return;
    }

    const query = `
      SELECT p.*
      FROM ping_records p
      INNER JOIN (
        SELECT ip, MAX(timestamp) as max_timestamp
        FROM ping_records
        GROUP BY ip
      ) latest
      ON p.ip = latest.ip AND p.timestamp = latest.max_timestamp
    `;
    db.all(query, (err, pingRecords) => {
      if (err) {
        res.status(500).json({ error: '获取状态失败' });
        return;
      }

      const statusList = ipListRecords.map(ipItem => {
        const pingRecord = pingRecords.find(record => record.ip === ipItem.ip);
        return {
          ip: ipItem.ip,
          number: ipItem.number,
          status: pingRecord ? pingRecord.status : ipItem.status,
          latency: pingRecord ? pingRecord.latency : null,
          timestamp: pingRecord ? pingRecord.timestamp : null,
          position_x: ipItem.position_x,
          position_y: ipItem.position_y,
          width: ipItem.width,
          height: ipItem.height
        };
      });
      res.json(statusList);
    });
  });
});

// API 路由，添加新的 IP 和编号
app.post('/add-ip', (req, res) => {
  const { ip, number } = req.body;
  if (!ip || !number) {
    res.status(400).json({ error: 'IP 和编号不能为空' });
    return;
  }

  db.run(
    `INSERT OR IGNORE INTO ip_list (ip, number, status, position_x, position_y, width, height) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [ip, number, 0, 0, 40, 150, 150],
    (err) => {
      if (err) {
        console.error(`插入 IP ${ip} 失败:`, err);
        res.status(500).json({ error: '添加 IP 失败' });
        return;
      }
      db.run(
        `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
        [ip, 0, null, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error(`插入 ${ip} 初始记录失败:`, err);
          }
        }
      );
      loadIpList();
      pingIp();
      res.json({ message: 'IP 添加成功', ip, number });
    }
  );
});

// API 路由，设置 IP 状态
app.post('/set-status', async (req, res) => {
  const { ip, status } = req.body;
  if (!ip || status === undefined || ![0, 1, 2].includes(status)) {
    res.status(400).json({ error: 'IP 和有效状态（0, 1, 2）不能为空' });
    return;
  }

  try {
    // 检查 IP 是否存在
    const ipExists = await new Promise((resolve, reject) => {
      db.get(`SELECT 1 FROM ip_list WHERE ip = ?`, [ip], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(!!row);
        }
      });
    });

    if (!ipExists) {
      res.status(404).json({ error: `IP ${ip} 不存在` });
      return;
    }

    // 更新 ip_list 表
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE ip_list SET status = ? WHERE ip = ?`,
        [status, ip],
        (err) => {
          if (err) {
            console.error(`更新 ${ip} 状态失败:`, err);
            reject(err);
          } else {
            console.log(`更新 ${ip} 状态为 ${status}`);
            resolve();
          }
        }
      );
    });

    // 插入 ping_records 记录
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO ping_records (ip, status, latency, timestamp) VALUES (?, ?, ?, ?)`,
        [ip, status, null, new Date().toISOString()],
        (err) => {
          if (err) {
            console.error(`插入 ${ip} 状态记录失败:`, err);
            reject(err);
          } else {
            console.log(`记录插入: IP ${ip}, 状态 ${status}, 延迟: -`);
            resolve();
          }
        }
      );
    });

    await loadIpList();
    await pingIp();
    res.json({ message: '状态更新成功', ip, status });
  } catch (error) {
    console.error(`设置 ${ip} 状态失败:`, error);
    res.status(500).json({ error: '设置状态失败' });
  }
});

// API 路由，更新 IP 的位置
app.post('/update-position', (req, res) => {
  const { ip, position_x, position_y } = req.body;
  if (!ip || position_x === undefined || position_y === undefined) {
    res.status(400).json({ error: 'IP 和位置信息不能为空' });
    return;
  }

  db.run(
    `UPDATE ip_list SET position_x = ?, position_y = ? WHERE ip = ?`,
    [position_x, position_y, ip],
    (err) => {
      if (err) {
        res.status(500).json({ error: '更新位置失败' });
        return;
      }
      loadIpList();
      res.json({ message: '位置更新成功', ip, position_x, position_y });
    }
  );
});

// API 路由，更新 IP 的尺寸
app.post('/update-size', (req, res) => {
  const { ip, width, height } = req.body;
  if (!ip || width === undefined || height === undefined) {
    res.status(400).json({ error: 'IP 和尺寸信息不能为空' });
    return;
  }

  db.run(
    `UPDATE ip_list SET width = ?, height = ? WHERE ip = ?`,
    [width, height, ip],
    (err) => {
      if (err) {
        res.status(500).json({ error: '更新尺寸失败' });
        return;
      }
      loadIpList();
      res.json({ message: '尺寸更新成功', ip, width, height });
    }
  );
});

// 在 ping.js 的其他 API 路由之后（如 /update-size 之后），添加以下代码：

// API 路由，删除 IP
app.post('/delete-ip', async (req, res) => {
    const { ip } = req.body;
    if (!ip) {
      res.status(400).json({ error: 'IP 不能为空' });
      return;
    }
  
    try {
      // 检查 IP 是否存在
      const ipExists = await new Promise((resolve, reject) => {
        db.get(`SELECT 1 FROM ip_list WHERE ip = ?`, [ip], (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        });
      });
  
      if (!ipExists) {
        res.status(404).json({ error: `IP ${ip} 不存在` });
        return;
      }
  
      // 删除 ip_list 表中的记录
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM ip_list WHERE ip = ?`, [ip], (err) => {
          if (err) {
            console.error(`删除 IP ${ip} 从 ip_list 失败:`, err);
            reject(err);
          } else {
            console.log(`已删除 IP ${ip} 从 ip_list`);
            resolve();
          }
        });
      });
  
      // 删除 ping_records 表中的记录
      await new Promise((resolve, reject) => {
        db.run(`DELETE FROM ping_records WHERE ip = ?`, [ip], (err) => {
          if (err) {
            console.error(`删除 IP ${ip} 从 ping_records 失败:`, err);
            reject(err);
          } else {
            console.log(`已删除 IP ${ip} 从 ping_records`);
            resolve();
          }
        });
      });
  
      await loadIpList();
      res.json({ message: 'IP 删除成功', ip });
    } catch (error) {
      console.error(`删除 IP ${ip} 失败:`, error);
      res.status(500).json({ error: '删除 IP 失败' });
    }
  });

// 设置静态文件目录
app.use(express.static('public'));

app.listen(3000, () => {
  console.log('状态监控页面运行在 http://localhost:3000');
  console.log('状态 API 运行在 http://localhost:3000/status');
  console.log('前端页面运行在 http://localhost:3000/index.html');
});

// 程序退出时关闭数据库
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) console.error('关闭数据库失败:', err);
    console.log('数据库已关闭');
    process.exit(0);
  });
});