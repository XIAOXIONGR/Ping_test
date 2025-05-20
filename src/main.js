const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const { loadIpList, pingIp, getIpList } = require('./utils/ping');
const status = require('./api/status');
const addIp = require('./api/addIp');
const deleteIp = require('./api/deleteIp');
const setStatus = require('./api/setStatus');
const updatePosition = require('./api/updatePosition');
const updateSize = require('./api/updateSize');

// 日志设置
const logPath = path.join(app.getPath('userData'), 'app.log');
function log(message) {
    const timestamp = new Date().toISOString();
    try {
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
    } catch (err) {
        console.error('Failed to write log:', err);
    }
}

// 处理 Squirrel 安装事件
if (require('electron-squirrel-startup')) {
    log('Squirrel 事件触发，退出应用程序');
    app.quit();
    return;
}

// 初始化 Express
const serverApp = express();
serverApp.use(express.json());
serverApp.use(express.static(path.join(__dirname, '../public')));

// 初始化数据库
const dbPath = path.join(app.getPath('userData'), 'ping.db');
log(`Database path: ${dbPath}`);
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        log(`数据库连接失败: ${err.message}`);
    } else {
        log('数据库连接成功');
        // 在连接成功后创建表
        initializeTables();
    }
});

// 创建表
function initializeTables() {
    db.run(
        `CREATE TABLE IF NOT EXISTS ip_list (
            ip TEXT PRIMARY KEY,
            number TEXT,
            status INTEGER DEFAULT 0,
            position_x INTEGER,
            position_y INTEGER,
            width INTEGER,
            height INTEGER
        )`,
        (err) => {
            if (err) {
                log(`创建 ip_list 表失败: ${err.message}`);
            } else {
                log('ip_list 表初始化成功');
            }
        }
    );
    db.run(
        `CREATE TABLE IF NOT EXISTS ping_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT,
            status INTEGER,
            latency INTEGER,
            timestamp TEXT
        )`,
        (err) => {
            if (err) {
                log(`创建 ping_records 表失败: ${err.message}`);
            } else {
                log('ping_records 表初始化成功');
            }
        }
    );
}

// 确保 ping.db 存在并复制
function ensureDatabaseFile() {
    return new Promise((resolve, reject) => {
        if (fs.existsSync(dbPath)) {
            log('ping.db 已存在于用户数据目录');
            resolve();
            return;
        }
        // 打包环境下的 ping.db 路径
        const sourceDbPath = path.join(
            process.resourcesPath,
            'ping.db'
        );
        const fallbackDbPath = path.join(__dirname, 'ping.db'); // 开发环境
        const finalSourcePath = fs.existsSync(sourceDbPath) ? sourceDbPath : fallbackDbPath;

        if (!fs.existsSync(finalSourcePath)) {
            log('源 ping.db 不存在，将创建新数据库');
            resolve(); // SQLite 会创建空文件
            return;
        }

        try {
            fs.copyFileSync(finalSourcePath, dbPath);
            log(`复制 ping.db 从 ${finalSourcePath} 到用户数据目录`);
            resolve();
        } catch (err) {
            log(`复制 ping.db 失败: ${err.message}`);
            reject(err);
        }
    });
}

// 初始化 IP 列表和定时 ping
async function initializePing() {
    try {
        await loadIpList();
        log('IP 列表加载完成');
        setInterval(() => {
            pingIp().catch(err => log(`Ping IP 失败: ${err.message}`));
        }, 30 * 1000);
        await pingIp();
        log('初始 Ping IP 完成');
    } catch (err) {
        log(`初始化 Ping 失败: ${err.message}`);
    }
}

// 状态监控表格页面
serverApp.get('/', (req, res) => {
    db.all(`SELECT * FROM ping_records ORDER BY timestamp DESC LIMIT 50`, (err, records) => {
        if (err) {
            log(`获取状态记录失败: ${err.message}`);
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
serverApp.get('/status', status);
serverApp.post('/add-ip', addIp);
serverApp.post('/delete-ip', deleteIp);
serverApp.post('/set-status', setStatus);
serverApp.post('/update-position', updatePosition);
serverApp.post('/update-size', updateSize);

async function startServer() {
    // 确保 ping.db 存在
    await ensureDatabaseFile();

    // 启动 Express 服务器
    return new Promise((resolve, reject) => {
        const server = serverApp.listen(0, () => {
            const port = server.address().port;
            log(`服务器启动: http://localhost:${port}`);
            global.serverPort = port;
            resolve(port);
        }).on('error', (err) => {
            log(`服务器启动失败: ${err.message}`);
            if (err.code === 'EADDRINUSE') {
                log('端口被占用，尝试其他端口');
                server.listen(0, () => {
                    const port = server.address().port;
                    log(`服务器启动: http://localhost:${port}`);
                    global.serverPort = port;
                    resolve(port);
                });
            } else {
                reject(err);
            }
        });
    });
}

function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true,
            enableRemoteModule: false,
            backgroundThrottling: false,
            spellcheck: false
        },
        show: false,
        frame: true,
        focusable: true,
        alwaysOnTop: false,
        backgroundColor: '#ffffff',
        hasShadow: true,
        thickFrame: true
    });

    // 加载 index.html
    const indexPath = path.join(__dirname, '../public/index.html');
    log(`Loading file: ${indexPath}`);
    win.loadFile(indexPath).catch(err => {
        log(`Failed to load index.html: ${err.message}`);
        console.error('Failed to load index.html:', err);
    });

    // 开发环境下打开 DevTools
    if (process.env.NODE_ENV === 'development') {
        win.webContents.openDevTools();
    }

    // 窗口准备好后显示
    win.once('ready-to-show', () => {
        win.show();
        win.focus();
        win.webContents.focus();
    });

    // 添加窗口焦点管理
    win.on('focus', () => {
        win.webContents.send('window-focused');
        win.webContents.focus();
    });

    win.on('blur', () => {
        win.webContents.send('window-blurred');
    });

    // 捕获渲染错误
    win.webContents.on('render-process-gone', (event, details) => {
        log(`Render process crashed: ${JSON.stringify(details)}`);
    });

    // 保存窗口引用
    global.mainWindow = win;

    // 处理 IPC 消息
    ipcMain.handle('get-port', () => {
        return global.serverPort;
    });

    ipcMain.on('focus-window', () => {
        if (!win.isFocused()) {
            win.focus();
            win.webContents.focus();
        }
    });

    ipcMain.on('toggle-dev-tools', () => {
        if (win.webContents.isDevToolsOpened()) {
            win.webContents.closeDevTools();
        } else {
            win.webContents.openDevTools();
        }
    });

    // 添加新的 IPC 消息处理
    ipcMain.on('set-input-focus', (event, inputId) => {
        win.webContents.executeJavaScript(`
            (function() {
                const element = document.getElementById('${inputId}');
                if (element) {
                    element.focus();
                    element.click();
                }
            })();
        `);
    });

    ipcMain.on('request-input-focus', () => {
        win.webContents.executeJavaScript(`
            (function() {
                const activeElement = document.activeElement;
                if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'SELECT')) {
                    activeElement.focus();
                    activeElement.click();
                }
            })();
        `);
    });

    // 添加 webContents 事件监听
    win.webContents.on('did-finish-load', () => {
        win.webContents.executeJavaScript(`
            (function() {
                document.addEventListener('focusin', (e) => {
                    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                        window.api.setInputFocus(e.target.id);
                    }
                });
            })();
        `);
    });

    return win;
}

app.whenReady().then(async () => {
    try {
        await startServer();
        await initializePing();
        createWindow();

        // 处理前端请求端口的 IPC
        ipcMain.handle('get-port', () => global.serverPort);

        app.on('activate', () => {
            if (BrowserWindow.getAllWindows().length === 0) createWindow();
        });
    } catch (err) {
        log(`主进程错误: ${err.message}`);
        console.error('Main process error:', err);
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('quit', () => {
    if (serverApp._server) {
        serverApp._server.close(() => {
            log('服务器已关闭');
        });
    }
    db.close((err) => {
        if (err) {
            log(`数据库关闭失败: ${err.message}`);
        } else {
            log('数据库已关闭');
        }
    });
});