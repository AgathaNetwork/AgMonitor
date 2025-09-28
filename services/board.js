const express = require('express');
const router = express.Router();
const SQLiteManager = require('./SQLiteManager');
const fs = require('fs');
const path = require('path');

// 创建数据库实例
const sqliteManager = new SQLiteManager();

// 初始化数据库
sqliteManager.init().catch((error) => {
    console.error('Failed to initialize SQLite database for board:', error);
});

// 处理 /board/xxx 路由
router.get('/:route', async (req, res) => {
    try {
        const route = req.params.route;
        
        // 查询数据库中是否有匹配的页面且启用
        const page = await sqliteManager.getPageByRoute(`${route}`);
        
        if (!page) {
            return res.status(404).send('<h1>Page not found</h1>');
        }
        
        // 读取静态HTML模板
        const rawHtmlPath = path.join(__dirname, '..', 'public', 'raw.html');
        fs.readFile(rawHtmlPath, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading raw.html:', err);
                return res.status(500).send('<h1>Internal server error</h1>');
            }
            
            // 返回静态HTML模板
            res.send(data);
        });
    } catch (error) {
        console.error('Error rendering board page:', error);
        res.status(500).send('<h1>Internal server error</h1>');
    }
});

// 前端专用API接口 - 获取所有页面（仅返回可用性信息）
router.get('/api/frontend/pages', async (req, res) => {
    try {
        // 获取所有页面
        const pages = await sqliteManager.getAllPages();
        
        // 只返回必要的信息
        const simplifiedPages = pages.map(page => ({
            id: page.id,
            route: page.route,
            enabled: page.enabled,
            config: page.config // 添加配置信息
        }));
        
        res.json({ 
            success: true, 
            pages: simplifiedPages 
        });
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 前端专用API接口 - 获取单个TCP监控项（仅返回可用性信息）
router.get('/api/frontend/tcp-monitor/:id', async (req, res) => {
    try {
        const monitorId = req.params.id;
        
        // 获取TCP监控项
        const monitor = await sqliteManager.getTcpMonitorById(monitorId);
        
        if (!monitor) {
            return res.status(404).json({ success: false, message: 'TCP监控项不存在' });
        }
        
        // 只返回必要信息
        const simplifiedMonitor = {
            id: monitor.id,
            ip: monitor.ip,
            port: monitor.port,
            enabled: monitor.enabled,
            interval_seconds: monitor.interval_seconds
        };
        
        res.json({ 
            success: true, 
            monitor: simplifiedMonitor 
        });
    } catch (error) {
        console.error('Error fetching TCP monitor:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 前端专用API接口 - 获取单个UDP监控项（仅返回可用性信息）
router.get('/api/frontend/udp-monitor/:id', async (req, res) => {
    try {
        const monitorId = req.params.id;
        
        // 获取UDP监控项
        const monitor = await sqliteManager.getUdpMonitorById(monitorId);
        
        if (!monitor) {
            return res.status(404).json({ success: false, message: 'UDP监控项不存在' });
        }
        
        // 只返回必要信息
        const simplifiedMonitor = {
            id: monitor.id,
            ip: monitor.ip,
            port: monitor.port,
            enabled: monitor.enabled,
            interval_seconds: monitor.interval_seconds
        };
        
        res.json({ 
            success: true, 
            monitor: simplifiedMonitor 
        });
    } catch (error) {
        console.error('Error fetching UDP monitor:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 前端专用API接口 - 获取单个HTTP监控项（仅返回可用性信息）
router.get('/api/frontend/http-monitor/:id', async (req, res) => {
    try {
        const monitorId = req.params.id;
        
        // 获取HTTP监控项
        const monitor = await sqliteManager.getHttpMonitorById(monitorId);
        
        if (!monitor) {
            return res.status(404).json({ success: false, message: 'HTTP监控项不存在' });
        }
        
        // 只返回必要信息
        const simplifiedMonitor = {
            id: monitor.id,
            url: monitor.url,
            method: monitor.method,
            enabled: monitor.enabled,
            interval_seconds: monitor.interval_seconds
        };
        
        res.json({ 
            success: true, 
            monitor: simplifiedMonitor 
        });
    } catch (error) {
        console.error('Error fetching HTTP monitor:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

module.exports = router;