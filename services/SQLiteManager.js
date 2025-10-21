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
        
        // 创建 monitor_tcp_results 表用于存储TCP监控结果
        const createMonitorTcpResultsTableQuery = `
            CREATE TABLE IF NOT EXISTS monitor_tcp_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monitor_id INTEGER NOT NULL,
                timestamp DATETIME NOT NULL,
                success BOOLEAN NOT NULL,
                response_time INTEGER,
                error_message TEXT,
                FOREIGN KEY (monitor_id) REFERENCES monitor_tcp (id)
            );
        `;
        
        // 创建 monitor_udp_results 表用于存储UDP监控结果
        const createMonitorUdpResultsTableQuery = `
            CREATE TABLE IF NOT EXISTS monitor_udp_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monitor_id INTEGER NOT NULL,
                timestamp DATETIME NOT NULL,
                success BOOLEAN NOT NULL,
                response_time INTEGER,
                error_message TEXT,
                FOREIGN KEY (monitor_id) REFERENCES monitor_udp (id)
            );
        `;
        
        // 创建 monitor_http_results 表用于存储HTTP(S)监控结果
        const createMonitorHttpResultsTableQuery = `
            CREATE TABLE IF NOT EXISTS monitor_http_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                monitor_id INTEGER NOT NULL,
                timestamp DATETIME NOT NULL,
                success BOOLEAN NOT NULL,
                response_time INTEGER,
                status_code INTEGER,
                response_body TEXT,
                error_message TEXT,
                FOREIGN KEY (monitor_id) REFERENCES monitor_http (id)
            );
        `;
        
        // 创建 page 表用于存储页面配置
        const createPageTableQuery = `
            CREATE TABLE IF NOT EXISTS page (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at DATETIME NOT NULL,
                enabled BOOLEAN DEFAULT 1,
                route TEXT,
                config TEXT
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
                    }
                });
                
                this.db.run(createMonitorTcpResultsTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    }
                });
                
                this.db.run(createMonitorUdpResultsTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    }
                });
                
                this.db.run(createMonitorHttpResultsTableQuery, (err) => {
                    if (err) {
                        reject(err);
                    }
                });
                
                this.db.run(createPageTableQuery, (err) => {
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
                VALUES (?, ?, datetime('now', 'localtime'), ?)
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
                SET last_executed = datetime('now', 'localtime')
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
    
    // 存储TCP监控结果
    addTcpMonitorResult(monitorId, success, responseTime, errorMessage) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO monitor_tcp_results (monitor_id, timestamp, success, response_time, error_message)
                VALUES (?, datetime('now', 'localtime'), ?, ?, ?)
            `;
            this.db.run(query, [monitorId, success ? 1 : 0, responseTime, errorMessage], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
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
                SET last_executed = datetime('now', 'localtime')
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
    
    // 存储UDP监控结果
    addUdpMonitorResult(monitorId, success, responseTime, errorMessage) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO monitor_udp_results (monitor_id, timestamp, success, response_time, error_message)
                VALUES (?, datetime('now', 'localtime'), ?, ?, ?)
            `;
            this.db.run(query, [monitorId, success ? 1 : 0, responseTime, errorMessage], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
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
                SET last_executed = datetime('now', 'localtime')
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
    
    // 存储HTTP(S)监控结果
    addHttpMonitorResult(monitorId, success, responseTime, statusCode, responseBody, errorMessage) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO monitor_http_results (monitor_id, timestamp, success, response_time, status_code, response_body, error_message)
                VALUES (?, datetime('now', 'localtime'), ?, ?, ?, ?, ?)
            `;
            this.db.run(query, [monitorId, success ? 1 : 0, responseTime, statusCode, responseBody, errorMessage], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // 页面相关方法
    
    // 添加页面
    addPage(enabled = true, route = null, config = null) {
        return new Promise((resolve, reject) => {
            const query = `
                INSERT INTO page (created_at, enabled, route, config)
                VALUES (datetime('now', 'localtime'), ?, ?, ?)
            `;
            this.db.run(query, [enabled ? 1 : 0, route, config], function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }

    // 更新页面
    updatePage(id, enabled, route, config) {
        return new Promise((resolve, reject) => {
            const query = `
                UPDATE page 
                SET enabled = ?, route = ?, config = ?
                WHERE id = ?
            `;
            this.db.run(query, [enabled ? 1 : 0, route, config, id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 删除页面
    deletePage(id) {
        return new Promise((resolve, reject) => {
            const query = `DELETE FROM page WHERE id = ?`;
            this.db.run(query, [id], (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    // 获取所有页面
    getAllPages() {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM page`;
            this.db.all(query, [], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert enabled from 0/1 to boolean
                    const pages = rows.map(row => ({
                        ...row,
                        enabled: row.enabled === 1
                    }));
                    resolve(pages);
                }
            });
        });
    }

    // 根据ID获取单个页面
    getPageById(id) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM page WHERE id = ?`;
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

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
        }
    }
    
    // 根据路由获取页面
    getPageByRoute(route) {
        return new Promise((resolve, reject) => {
            const query = `SELECT * FROM page WHERE route = ? AND enabled = 1`;
            this.db.get(query, [route], (err, row) => {
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
    
    // 获取TCP监控项最近的结果
    getRecentTcpMonitorResults(monitorId, count = 5) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT success, timestamp 
                FROM monitor_tcp_results 
                WHERE monitor_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            this.db.all(query, [monitorId, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
    
    // 获取UDP监控项最近的结果
    getRecentUdpMonitorResults(monitorId, count = 5) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT success, timestamp 
                FROM monitor_udp_results 
                WHERE monitor_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            this.db.all(query, [monitorId, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
    
    // 获取HTTP监控项最近的结果
    getRecentHttpMonitorResults(monitorId, count = 5) {
        return new Promise((resolve, reject) => {
            const query = `
                SELECT success, timestamp 
                FROM monitor_http_results 
                WHERE monitor_id = ? 
                ORDER BY timestamp DESC 
                LIMIT ?
            `;
            this.db.all(query, [monitorId, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }
    
    // 删除超过1小时的TCP监控结果
    deleteOldTcpResults() {
        return new Promise((resolve, reject) => {
            const query = `
                DELETE FROM monitor_tcp_results 
                WHERE timestamp < datetime('now', '-1 hour')
            `;
            this.db.run(query, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Deleted ${this.changes} old TCP monitor results`);
                    resolve(this.changes);
                }
            });
        });
    }
    
    // 删除超过1小时的UDP监控结果
    deleteOldUdpResults() {
        return new Promise((resolve, reject) => {
            const query = `
                DELETE FROM monitor_udp_results 
                WHERE timestamp < datetime('now', '-1 hour')
            `;
            this.db.run(query, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Deleted ${this.changes} old UDP monitor results`);
                    resolve(this.changes);
                }
            });
        });
    }
    
    // 删除超过1小时的HTTP监控结果
    deleteOldHttpResults() {
        return new Promise((resolve, reject) => {
            const query = `
                DELETE FROM monitor_http_results 
                WHERE timestamp < datetime('now', '-1 hour')
            `;
            this.db.run(query, [], function(err) {
                if (err) {
                    reject(err);
                } else {
                    console.log(`Deleted ${this.changes} old HTTP monitor results`);
                    resolve(this.changes);
                }
            });
        });
    }
}

module.exports = SQLiteManager;