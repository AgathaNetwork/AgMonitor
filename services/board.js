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
        
        // 过滤掉未启用的页面
        const filteredPages = simplifiedPages.filter(page => page.enabled);
        
        res.json({ 
            success: true, 
            pages: filteredPages 
        });
    } catch (error) {
        console.error('Error fetching pages:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});


// 前端专用API接口 - 获取TCP监控项最近5次结果
router.get('/api/frontend/tcp-monitor/:id/results', async (req, res) => {
    try {
        const monitorId = req.params.id;
        const count = parseInt(req.query.count) || 5; // 默认查询最近5条记录

        // 获取最近的TCP监控结果
        const results = await sqliteManager.getRecentTcpMonitorResults(monitorId, count);
        
        res.json({ 
            success: true, 
            results: results 
        });
    } catch (error) {
        console.error('Error fetching TCP monitor results:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 前端专用API接口 - 获取UDP监控项最近5次结果
router.get('/api/frontend/udp-monitor/:id/results', async (req, res) => {
    try {
        const monitorId = req.params.id;
        const count = parseInt(req.query.count) || 5; // 默认查询最近5条记录

        // 获取最近的UDP监控结果
        const results = await sqliteManager.getRecentUdpMonitorResults(monitorId, count);
        
        res.json({ 
            success: true, 
            results: results 
        });
    } catch (error) {
        console.error('Error fetching UDP monitor results:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

// 前端专用API接口 - 获取HTTP监控项最近5次结果
router.get('/api/frontend/http-monitor/:id/results', async (req, res) => {
    try {
        const monitorId = req.params.id;
        const count = parseInt(req.query.count) || 5; // 默认查询最近5条记录

        // 获取最近的HTTP监控结果
        const results = await sqliteManager.getRecentHttpMonitorResults(monitorId, count);
        
        res.json({ 
            success: true, 
            results: results 
        });
    } catch (error) {
        console.error('Error fetching HTTP monitor results:', error);
        res.status(500).json({ success: false, message: '服务器内部错误' });
    }
});

module.exports = router;