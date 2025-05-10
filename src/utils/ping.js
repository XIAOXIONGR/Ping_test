const ping = require('ping');
const db = require('../db/database');

async function pingIp(ipList) {
  try {
    for (const item of ipList) {
      let status = item.status;
      let latency = null;

      if (item.status === 0 || item.status === 1) {
        console.log(`尝试 ping IP ${item.ip} (当前状态: ${item.status})`);
        const res = await ping.promise.probe(item.ip, { timeout: 10 });
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
          (err) => err ? reject(err) : resolve()
        );
      });

      if (status !== item.status) {
        await new Promise((resolve, reject) => {
          db.run(`UPDATE ip_list SET status = ? WHERE ip = ?`, [status, item.ip], (err) => {
            err ? reject(err) : resolve();
          });
        });
      }
    }
  } catch (error) {
    console.error('Ping 错误:', error);
  }
}

module.exports = { pingIp };