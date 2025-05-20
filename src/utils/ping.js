const ping = require('ping');
const db = require('../db/database');

let ipList = [];

async function loadIpList() {
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
      resolve(ipList);
    });
  });
}

async function pingIp() {
  try {
    for (const item of ipList) {
      let status = item.status;
      let latency = null;

      if (item.status === 0 || item.status === 1) {
        console.log(`尝试 ping IP ${item.ip} (当前状态: ${item.status})`);
        const res = await ping.promise.probe(item.ip, { timeout: 2 });
        status = res.alive ? 1 : 0;
        latency = res.alive ? parseFloat(res.avg) : null;
        console.log(`Ping 结果: IP ${item.ip}, alive: ${res.alive}, 延迟: ${latency || '-'}ms`);
      } else {
        console.log(`跳过 ping IP ${item.ip} (状态: ${item.status})`);
      }

      const timestamp = new Date().toISOString();
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
    throw error;
  }
}

module.exports = { loadIpList, pingIp, getIpList: () => ipList };