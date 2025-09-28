const fs = require('fs');
const yaml = require('js-yaml');
const SQLiteManager = require('./SQLiteManager');

// 读取配置文件
const configPath = './config.yml';
let config = {};
try {
    const fileContents = fs.readFileSync(configPath, 'utf8');
    config = yaml.load(fileContents);
} catch (e) {
    console.error('Error reading or parsing config.yml:', e);
    process.exit(1);
}

const { maintenance } = config;

// 获取最近的TCP监控记录
async function getRecentTcpMonitorResults(session, monitorId, count) {
    // 验证维护模式
    if (!maintenance) {
        return { success: false, message: '系统未处于维护模式' };
    }

    const db = new SQLiteManager();
    await db.init();

    try {
        // 验证会话
        const isValidSession = await db.validateSession(session);
        if (!isValidSession) {
            return { success: false, message: '无效的会话' };
        }

        // 获取最近的记录
        const query = `
            SELECT * FROM monitor_tcp_results 
            WHERE monitor_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        
        const results = await new Promise((resolve, reject) => {
            db.db.all(query, [monitorId, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert success from 0/1 to boolean
                    const formattedResults = rows.map(row => ({
                        ...row,
                        success: row.success === 1
                    }));
                    resolve(formattedResults);
                }
            });
        });

        return { success: true, results };
    } catch (error) {
        console.error('Error fetching TCP monitor results:', error);
        return { success: false, message: '获取监控记录失败' };
    } finally {
        db.close();
    }
}

// 获取最近的UDP监控记录
async function getRecentUdpMonitorResults(session, monitorId, count) {
    // 验证维护模式
    if (!maintenance) {
        return { success: false, message: '系统未处于维护模式' };
    }

    const db = new SQLiteManager();
    await db.init();

    try {
        // 验证会话
        const isValidSession = await db.validateSession(session);
        if (!isValidSession) {
            return { success: false, message: '无效的会话' };
        }

        // 获取最近的记录
        const query = `
            SELECT * FROM monitor_udp_results 
            WHERE monitor_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        
        const results = await new Promise((resolve, reject) => {
            db.db.all(query, [monitorId, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert success from 0/1 to boolean
                    const formattedResults = rows.map(row => ({
                        ...row,
                        success: row.success === 1
                    }));
                    resolve(formattedResults);
                }
            });
        });

        return { success: true, results };
    } catch (error) {
        console.error('Error fetching UDP monitor results:', error);
        return { success: false, message: '获取监控记录失败' };
    } finally {
        db.close();
    }
}

// 获取最近的HTTP监控记录
async function getRecentHttpMonitorResults(session, monitorId, count) {
    // 验证维护模式
    if (!maintenance) {
        return { success: false, message: '系统未处于维护模式' };
    }

    const db = new SQLiteManager();
    await db.init();

    try {
        // 验证会话
        const isValidSession = await db.validateSession(session);
        if (!isValidSession) {
            return { success: false, message: '无效的会话' };
        }

        // 获取最近的记录
        const query = `
            SELECT * FROM monitor_http_results 
            WHERE monitor_id = ? 
            ORDER BY timestamp DESC 
            LIMIT ?
        `;
        
        const results = await new Promise((resolve, reject) => {
            db.db.all(query, [monitorId, count], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    // Convert success from 0/1 to boolean
                    const formattedResults = rows.map(row => ({
                        ...row,
                        success: row.success === 1
                    }));
                    resolve(formattedResults);
                }
            });
        });

        return { success: true, results };
    } catch (error) {
        console.error('Error fetching HTTP monitor results:', error);
        return { success: false, message: '获取监控记录失败' };
    } finally {
        db.close();
    }
}

module.exports = {
    getRecentTcpMonitorResults,
    getRecentUdpMonitorResults,
    getRecentHttpMonitorResults
};