const express = require('express');
const router = express.Router();
const fs = require('fs');
const yaml = require('js-yaml');
const SQLiteManager = require('./SQLiteManager'); // 引入 SQLiteManager
const sqliteManager = new SQLiteManager(); // 实例化 SQLiteManager
const crypto = require('crypto');

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

module.exports = router;