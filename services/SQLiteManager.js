const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class SQLiteManager {
    constructor() {
        this.db = null;
    }

    async init() {
        try {
            // 确保根目录下存在 database.db 文件
            const dbPath = path.join(__dirname, '..', 'database.db');
            this.db = new sqlite3.Database(dbPath, (err) => {
                if (err) {
                    console.error('Error opening database:', err.message);
                }
            });

            // 初始化表结构
            await this.createTables();
        } catch (error) {
            console.error('Error initializing SQLite database:', error);
            process.exit(1);
        }
    }

    async createTables() {
        // 只创建 sessions 表
        const createSessionsTableQuery = `
            CREATE TABLE IF NOT EXISTS sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session TEXT NOT NULL,
                ip_address TEXT NOT NULL,
                timestamp DATETIME NOT NULL,
                user_agent TEXT NOT NULL,
                logged_out BOOLEAN DEFAULT 0
            );
        `;

        // 创建 monitor_tcp 表
        const createMonitorTcpTableQuery = `
            CREATE TABLE IF NOT EXISTS monitor_tcp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL,
                port INTEGER NOT NULL,
                enabled BOOLEAN DEFAULT 1,
                last_executed DATETIME,
                interval_seconds INTEGER DEFAULT 60
            );
        `;

        // 创建 monitor_udp 表
        const createMonitorUdpTableQuery = `
            CREATE TABLE IF NOT EXISTS monitor_udp (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ip TEXT NOT NULL,
                port INTEGER NOT NULL,
                enabled BOOLEAN DEFAULT 1,
                last_executed DATETIME,
                interval_seconds INTEGER DEFAULT 60
            );
        `;

        // 创建 monitor_http 表
        const createMonitorHttpTableQuery = `
            CREATE TABLE IF NOT EXISTS monitor_http (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                url TEXT NOT NULL,
                method TEXT NOT NULL DEFAULT 'GET',
                enabled BOOLEAN DEFAULT 1,
                last_executed DATETIME,
                interval_seconds INTEGER DEFAULT 60,
                headers TEXT,
                body TEXT,
                form_data TEXT,
                body_type TEXT DEFAULT 'none'
            );
        `;

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(createSessionsTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    }
                });
                
                this.db.run(createMonitorTcpTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    }
                });
                
                this.db.run(createMonitorUdpTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    }
                });
                
                this.db.run(createMonitorHttpTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    // 创建会话方法
    createSession(session, ipAddress, userAgent) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO sessions (session, ip_address, timestamp, user_agent)
                VALUES (?, ?, datetime('now'), ?)
            `;
            this.db.run(query, [session, ipAddress, userAgent], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 验证会话方法
    validateSession(session) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT * FROM sessions 
                WHERE session = ? AND logged_out = 0
            `;
            this.db.get(query, [session], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(!!row);
                }
            });
        });
    }

    // TCP监控相关方法
    
    // 添加TCP监控项
    addTcpMonitor(ip, port, enabled = true, intervalSeconds = 60) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO monitor_tcp (ip, port, enabled, interval_seconds)
                VALUES (?, ?, ?, ?)
            `;
            this.db.run(query, [ip, port, enabled ? 1 : 0, intervalSeconds], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // 更新TCP监控项
    updateTcpMonitor(id, ip, port, enabled, intervalSeconds) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE monitor_tcp 
                SET ip = ?, port = ?, enabled = ?, interval_seconds = ?
                WHERE id = ?
            `;
            this.db.run(query, [ip, port, enabled ? 1 : 0, intervalSeconds, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 删除TCP监控项
    deleteTcpMonitor(id) {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM monitor_tcp WHERE id = ?`;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 获取所有TCP监控项
    getAllTcpMonitors() {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM monitor_tcp`;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert enabled from 0/1 to boolean
                    const monitors = rows.map(row => ({
                        ...row,
                        enabled: row.enabled === 1
                    }));
                    resolve(monitors);
                }
            });
        });
    }

    // 根据ID获取单个TCP监控项
    getTcpMonitorById(id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM monitor_tcp WHERE id = ?`;
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        // Convert enabled from 0/1 to boolean
                        row.enabled = row.enabled === 1;
                    }
                    resolve(row);
                }
            });
        });
    }

    // 更新上次执行时间
    updateLastExecutedTcp(id) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE monitor_tcp 
                SET last_executed = datetime('now')
                WHERE id = ?
            `;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // UDP监控相关方法
    
    // 添加UDP监控项
    addUdpMonitor(ip, port, enabled = true, intervalSeconds = 60) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO monitor_udp (ip, port, enabled, interval_seconds)
                VALUES (?, ?, ?, ?)
            `;
            this.db.run(query, [ip, port, enabled ? 1 : 0, intervalSeconds], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // 更新UDP监控项
    updateUdpMonitor(id, ip, port, enabled, intervalSeconds) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE monitor_udp 
                SET ip = ?, port = ?, enabled = ?, interval_seconds = ?
                WHERE id = ?
            `;
            this.db.run(query, [ip, port, enabled ? 1 : 0, intervalSeconds, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 删除UDP监控项
    deleteUdpMonitor(id) {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM monitor_udp WHERE id = ?`;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 获取所有UDP监控项
    getAllUdpMonitors() {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM monitor_udp`;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert enabled from 0/1 to boolean
                    const monitors = rows.map(row => ({
                        ...row,
                        enabled: row.enabled === 1
                    }));
                    resolve(monitors);
                }
            });
        });
    }

    // 根据ID获取单个UDP监控项
    getUdpMonitorById(id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM monitor_udp WHERE id = ?`;
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        // Convert enabled from 0/1 to boolean
                        row.enabled = row.enabled === 1;
                    }
                    resolve(row);
                }
            });
        });
    }

    // 更新UDP上次执行时间
    updateLastExecutedUdp(id) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE monitor_udp 
                SET last_executed = datetime('now')
                WHERE id = ?
            `;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // HTTP监控相关方法
    
    // 添加HTTP监控项
    addHttpMonitor(url, method, enabled = true, intervalSeconds = 60, headers = null, body = null, formData = null, bodyType = 'none') {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO monitor_http (url, method, enabled, interval_seconds, headers, body, form_data, body_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;
            this.db.run(query, [url, method, enabled ? 1 : 0, intervalSeconds, headers, body, formData, bodyType], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // 更新HTTP监控项
    updateHttpMonitor(id, url, method, enabled, intervalSeconds, headers, body, formData, bodyType) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE monitor_http 
                SET url = ?, method = ?, enabled = ?, interval_seconds = ?, headers = ?, body = ?, form_data = ?, body_type = ?
                WHERE id = ?
            `;
            this.db.run(query, [url, method, enabled ? 1 : 0, intervalSeconds, headers, body, formData, bodyType, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 删除HTTP监控项
    deleteHttpMonitor(id) {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM monitor_http WHERE id = ?`;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 获取所有HTTP监控项
    getAllHttpMonitors() {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM monitor_http`;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert enabled from 0/1 to boolean and parse JSON fields
                    const monitors = rows.map(row => ({
                        ...row,
                        enabled: row.enabled === 1,
                        headers: row.headers ? JSON.parse(row.headers) : null,
                        body: row.body,
                        form_data: row.form_data ? JSON.parse(row.form_data) : null
                    }));
                    resolve(monitors);
                }
            });
        });
    }

    // 根据ID获取单个HTTP监控项
    getHttpMonitorById(id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM monitor_http WHERE id = ?`;
            this.db.get(query, [id], (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    if (row) {
                        // Convert enabled from 0/1 to boolean and parse JSON fields
                        row.enabled = row.enabled === 1;
                        row.headers = row.headers ? JSON.parse(row.headers) : null;
                        row.form_data = row.form_data ? JSON.parse(row.form_data) : null;
                    }
                    resolve(row);
                }
            });
        });
    }

    // 更新HTTP上次执行时间
    updateLastExecutedHttp(id) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE monitor_http 
                SET last_executed = datetime('now')
                WHERE id = ?
            `;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = SQLiteManager;