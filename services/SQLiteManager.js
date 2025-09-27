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

        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run(createSessionsTableQuery, (err) => {
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

    // 关闭数据库连接
    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = SQLiteManager;