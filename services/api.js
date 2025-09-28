const express = require('express');
const router = express.Router();
const fs = require('fs');
const yaml = require('js-yaml');
const SQLiteManager = require('./SQLiteManager'); // 引入 SQLiteManager
const sqliteManager = new SQLiteManager(); // 实例化 SQLiteManager
const crypto = require('crypto');
const {
    getRecentTcpMonitorResults,
    getRecentUdpMonitorResults,
    getRecentHttpMonitorResults
} = require('./query'); // 引入查询函数

// 登录 API
router.post('/login', async (req, res) => {
    try {
        // 确保 SQLiteManager 已初始化
        await sqliteManager.init();

        const { password } = req.body;

        // 读取配置文件
        const configPath = './config.yml';
        let config = {};
        try {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            config = yaml.load(fileContents);
        } catch (e) {
            console.error('Error reading or parsing config.yml:', e);
            return res.status(500).json({ success: false, message: '服务器配置错误' });
        }

        const { maintenance, password: configPassword } = config;

        // 检查是否处于维护模式
        if (!maintenance) {
            return res.status(403).json({ success: false, message: '系统未处于维护模式' });
        }

        // 验证密码
        if (password !== configPassword) {
            return res.status(401).json({ success: false, message: '密码错误' });
        }

        // 创建会话
        const session = crypto.randomBytes(32).toString('hex');
        const ipAddress = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
        const userAgent = req.headers['user-agent'];

        await sqliteManager.createSession(session, ipAddress, userAgent);

        res.json({ success: true, session });
    } catch (err) {
        console.error('Login error:', err.message);
        res.status(500).json({ success: false, message: '登录失败' });
    }
});

// 中间件：验证会话和维护模式
const validateSessionAndMaintenance = async (req, res, next) => {
    try {
        // 读取配置文件
        const configPath = './config.yml';
        let config = {};
        try {
            const fileContents = fs.readFileSync(configPath, 'utf8');
            config = yaml.load(fileContents);
        } catch (e) {
            console.error('Error reading or parsing config.yml:', e);
            return res.status(500).json({ success: false, message: '服务器配置错误' });
        }

        const { maintenance } = config;

        // 检查是否处于维护模式
        if (!maintenance) {
            return res.status(403).json({ success: false, message: '系统未处于维护模式' });
        }

        // 验证会话
        const session = req.headers['authorization'] || req.cookies?.session;
        if (!session) {
            return res.status(401).json({ success: false, message: '未提供会话信息' });
        }

        const isValid = await sqliteManager.validateSession(session);
        if (!isValid) {
            return res.status(401).json({ success: false, message: '无效的会话' });
        }

        next();
    } catch (err) {
        console.error('Session validation error:', err.message);
        res.status(500).json({ success: false, message: '验证失败' });
    }
};

// TCP监控API端点

// 添加TCP监控项
router.post('/tcp-monitor', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { ip, port, enabled, intervalSeconds } = req.body;
        
        // 基本验证
        if (!ip || !port) {
            return res.status(400).json({ success: false, message: 'IP和端口是必需的' });
        }
        
        const id = await sqliteManager.addTcpMonitor(ip, port, enabled, intervalSeconds);
        res.json({ success: true, id, message: 'TCP监控项添加成功' });
    } catch (err) {
        console.error('Add TCP monitor error:', err.message);
        res.status(500).json({ success: false, message: '添加TCP监控项失败' });
    }
});

// 更新TCP监控项
router.put('/tcp-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        const { ip, port, enabled, intervalSeconds } = req.body;
        
        // 检查监控项是否存在
        const existingMonitor = await sqliteManager.getTcpMonitorById(id);
        if (!existingMonitor) {
            return res.status(404).json({ success: false, message: 'TCP监控项不存在' });
        }
        
        await sqliteManager.updateTcpMonitor(id, ip, port, enabled, intervalSeconds);
        res.json({ success: true, message: 'TCP监控项更新成功' });
    } catch (err) {
        console.error('Update TCP monitor error:', err.message);
        res.status(500).json({ success: false, message: '更新TCP监控项失败' });
    }
});

// 删除TCP监控项
router.delete('/tcp-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查监控项是否存在
        const existingMonitor = await sqliteManager.getTcpMonitorById(id);
        if (!existingMonitor) {
            return res.status(404).json({ success: false, message: 'TCP监控项不存在' });
        }
        
        await sqliteManager.deleteTcpMonitor(id);
        res.json({ success: true, message: 'TCP监控项删除成功' });
    } catch (err) {
        console.error('Delete TCP monitor error:', err.message);
        res.status(500).json({ success: false, message: '删除TCP监控项失败' });
    }
});

// 获取所有TCP监控项
router.get('/tcp-monitors', validateSessionAndMaintenance, async (req, res) => {
    try {
        const monitors = await sqliteManager.getAllTcpMonitors();
        res.json({ success: true, monitors });
    } catch (err) {
        console.error('Get TCP monitors error:', err.message);
        res.status(500).json({ success: false, message: '获取TCP监控项失败' });
    }
});

// 获取单个TCP监控项
router.get('/tcp-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        const monitor = await sqliteManager.getTcpMonitorById(id);
        
        if (!monitor) {
            return res.status(404).json({ success: false, message: 'TCP监控项不存在' });
        }
        
        res.json({ success: true, monitor });
    } catch (err) {
        console.error('Get TCP monitor error:', err.message);
        res.status(500).json({ success: false, message: '获取TCP监控项失败' });
    }
});

// UDP监控API端点

// 添加UDP监控项
router.post('/udp-monitor', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { ip, port, enabled, intervalSeconds } = req.body;
        
        // 基本验证
        if (!ip || !port) {
            return res.status(400).json({ success: false, message: 'IP和端口是必需的' });
        }
        
        const id = await sqliteManager.addUdpMonitor(ip, port, enabled, intervalSeconds);
        res.json({ success: true, id, message: 'UDP监控项添加成功' });
    } catch (err) {
        console.error('Add UDP monitor error:', err.message);
        res.status(500).json({ success: false, message: '添加UDP监控项失败' });
    }
});

// 更新UDP监控项
router.put('/udp-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        const { ip, port, enabled, intervalSeconds } = req.body;
        
        // 检查监控项是否存在
        const existingMonitor = await sqliteManager.getUdpMonitorById(id);
        if (!existingMonitor) {
            return res.status(404).json({ success: false, message: 'UDP监控项不存在' });
        }
        
        await sqliteManager.updateUdpMonitor(id, ip, port, enabled, intervalSeconds);
        res.json({ success: true, message: 'UDP监控项更新成功' });
    } catch (err) {
        console.error('Update UDP monitor error:', err.message);
        res.status(500).json({ success: false, message: '更新UDP监控项失败' });
    }
});

// 删除UDP监控项
router.delete('/udp-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查监控项是否存在
        const existingMonitor = await sqliteManager.getUdpMonitorById(id);
        if (!existingMonitor) {
            return res.status(404).json({ success: false, message: 'UDP监控项不存在' });
        }
        
        await sqliteManager.deleteUdpMonitor(id);
        res.json({ success: true, message: 'UDP监控项删除成功' });
    } catch (err) {
        console.error('Delete UDP monitor error:', err.message);
        res.status(500).json({ success: false, message: '删除UDP监控项失败' });
    }
});

// 获取所有UDP监控项
router.get('/udp-monitors', validateSessionAndMaintenance, async (req, res) => {
    try {
        const monitors = await sqliteManager.getAllUdpMonitors();
        res.json({ success: true, monitors });
    } catch (err) {
        console.error('Get UDP monitors error:', err.message);
        res.status(500).json({ success: false, message: '获取UDP监控项失败' });
    }
});

// 获取单个UDP监控项
router.get('/udp-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        const monitor = await sqliteManager.getUdpMonitorById(id);
        
        if (!monitor) {
            return res.status(404).json({ success: false, message: 'UDP监控项不存在' });
        }
        
        res.json({ success: true, monitor });
    } catch (err) {
        console.error('Get UDP monitor error:', err.message);
        res.status(500).json({ success: false, message: '获取UDP监控项失败' });
    }
});

// HTTP监控API端点

// 添加HTTP监控项
router.post('/http-monitor', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { url, method, enabled, intervalSeconds, headers, body, formData, bodyType } = req.body;
        
        // 基本验证
        if (!url || !method) {
            return res.status(400).json({ success: false, message: 'URL和请求方法是必需的' });
        }
        
        // 验证请求方法
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        if (!validMethods.includes(method.toUpperCase())) {
            return res.status(400).json({ success: false, message: '无效的请求方法' });
        }
        
        // 验证bodyType
        const validBodyTypes = ['none', 'form-data', 'x-www-form-urlencoded'];
        const bodyTypeValue = bodyType || 'none';
        if (!validBodyTypes.includes(bodyTypeValue)) {
            return res.status(400).json({ success: false, message: '无效的body类型' });
        }
        
        // 处理headers为JSON字符串
        const headersStr = headers ? JSON.stringify(headers) : null;
        
        // 根据bodyType处理数据
        let bodyStr = null;
        let formDataStr = null;
        
        if (bodyTypeValue === 'form-data' || bodyTypeValue === 'x-www-form-urlencoded') {
            formDataStr = formData ? JSON.stringify(formData) : null;
        } else if (body) {
            bodyStr = body;
        }
        
        const id = await sqliteManager.addHttpMonitor(url, method, enabled, intervalSeconds, headersStr, bodyStr, formDataStr, bodyTypeValue);
        res.json({ success: true, id, message: 'HTTP监控项添加成功' });
    } catch (err) {
        console.error('Add HTTP monitor error:', err.message);
        res.status(500).json({ success: false, message: '添加HTTP监控项失败' });
    }
});

// 更新HTTP监控项
router.put('/http-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        const { url, method, enabled, intervalSeconds, headers, body, formData, bodyType } = req.body;
        
        // 检查监控项是否存在
        const existingMonitor = await sqliteManager.getHttpMonitorById(id);
        if (!existingMonitor) {
            return res.status(404).json({ success: false, message: 'HTTP监控项不存在' });
        }
        
        // 验证请求方法
        const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];
        if (!validMethods.includes(method.toUpperCase())) {
            return res.status(400).json({ success: false, message: '无效的请求方法' });
        }
        
        // 验证bodyType
        const validBodyTypes = ['none', 'form-data', 'x-www-form-urlencoded'];
        const bodyTypeValue = bodyType || 'none';
        if (!validBodyTypes.includes(bodyTypeValue)) {
            return res.status(400).json({ success: false, message: '无效的body类型' });
        }
        
        // 处理headers为JSON字符串
        const headersStr = headers ? JSON.stringify(headers) : null;
        
        // 根据bodyType处理数据
        let bodyStr = null;
        let formDataStr = null;
        
        if (bodyTypeValue === 'form-data' || bodyTypeValue === 'x-www-form-urlencoded') {
            formDataStr = formData ? JSON.stringify(formData) : null;
        } else if (body) {
            bodyStr = body;
        }
        
        await sqliteManager.updateHttpMonitor(id, url, method, enabled, intervalSeconds, headersStr, bodyStr, formDataStr, bodyTypeValue);
        res.json({ success: true, message: 'HTTP监控项更新成功' });
    } catch (err) {
        console.error('Update HTTP monitor error:', err.message);
        res.status(500).json({ success: false, message: '更新HTTP监控项失败' });
    }
});

// 删除HTTP监控项
router.delete('/http-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        
        // 检查监控项是否存在
        const existingMonitor = await sqliteManager.getHttpMonitorById(id);
        if (!existingMonitor) {
            return res.status(404).json({ success: false, message: 'HTTP监控项不存在' });
        }
        
        await sqliteManager.deleteHttpMonitor(id);
        res.json({ success: true, message: 'HTTP监控项删除成功' });
    } catch (err) {
        console.error('Delete HTTP monitor error:', err.message);
        res.status(500).json({ success: false, message: '删除HTTP监控项失败' });
    }
});

// 获取所有HTTP监控项
router.get('/http-monitors', validateSessionAndMaintenance, async (req, res) => {
    try {
        const monitors = await sqliteManager.getAllHttpMonitors();
        res.json({ success: true, monitors });
    } catch (err) {
        console.error('Get HTTP monitors error:', err.message);
        res.status(500).json({ success: false, message: '获取HTTP监控项失败' });
    }
});

// 获取单个HTTP监控项
router.get('/http-monitor/:id', validateSessionAndMaintenance, async (req, res) => {
    try {
        const { id } = req.params;
        const monitor = await sqliteManager.getHttpMonitorById(id);
        
        if (!monitor) {
            return res.status(404).json({ success: false, message: 'HTTP监控项不存在' });
        }
        
        res.json({ success: true, monitor });
    } catch (err) {
        console.error('Get HTTP monitor error:', err.message);
        res.status(500).json({ success: false, message: '获取HTTP监控项失败' });
    }
});

// 获取最近的TCP监控记录
router.get('/tcp-monitor/:id/results', validateSessionAndMaintenance, async (req, res) => {
    try {
        const sessionId = req.headers.authorization;
        const monitorId = req.params.id;
        const count = parseInt(req.query.count) || 10; // 默认查询最近10条记录

        if (!sessionId) {
            return res.status(401).json({ success: false, message: '未提供会话ID' });
        }

        const result = await getRecentTcpMonitorResults(sessionId, monitorId, count);
        res.json(result);
    } catch (error) {
        console.error('Error fetching TCP monitor results:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 获取最近的UDP监控记录
router.get('/udp-monitor/:id/results', validateSessionAndMaintenance, async (req, res) => {
    try {
        const sessionId = req.headers.authorization;
        const monitorId = req.params.id;
        const count = parseInt(req.query.count) || 10; // 默认查询最近10条记录

        if (!sessionId) {
            return res.status(401).json({ success: false, message: '未提供会话ID' });
        }

        const result = await getRecentUdpMonitorResults(sessionId, monitorId, count);
        res.json(result);
    } catch (error) {
        console.error('Error fetching UDP monitor results:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 获取最近的HTTP监控记录
router.get('/http-monitor/:id/results', validateSessionAndMaintenance, async (req, res) => {
    try {
        const sessionId = req.headers.authorization;
        const monitorId = req.params.id;
        const count = parseInt(req.query.count) || 10; // 默认查询最近10条记录

        if (!sessionId) {
            return res.status(401).json({ success: false, message: '未提供会话ID' });
        }

        const result = await getRecentHttpMonitorResults(sessionId, monitorId, count);
        res.json(result);
    } catch (error) {
        console.error('Error fetching HTTP monitor results:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

module.exports = router;