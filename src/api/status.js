const db = require('../db/database');

function status(req, res) {
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
}

module.exports = status;