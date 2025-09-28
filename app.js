const express = require('express');
const fs = require('fs');
const yaml = require('js-yaml');
const SQLiteManager = require('./services/SQLiteManager'); // 引入 SQLiteManager
const apiRoutes = require('./services/api'); // 引入 API 路由
const boardRoutes = require('./services/board'); // 引入 Board 路由
const MonitoringEngine = require('./services/engine'); // 引入监控引擎

const app = express();
const sqliteManager = new SQLiteManager(); // 实例化 SQLiteManager
const monitoringEngine = new MonitoringEngine(); // 实例化监控引擎

// 使用 express.static 提供静态资源
app.use(express.static('public'));
app.use(express.json());

// 引入 API 路由
app.use('/api', apiRoutes);

// 引入 Board 路由
app.use('/board', boardRoutes);

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

// 获取配置
const { maintenance, password, port } = config;

// 初始化 SQLite 数据库
sqliteManager.init().then(() => {
    console.log('SQLite database initialized successfully.');
}).catch((error) => {
    console.error('Failed to initialize SQLite database:', error);
    process.exit(1);
});

// 初始化并启动监控引擎
monitoringEngine.init().then(() => {
    monitoringEngine.start();
}).catch((error) => {
    console.error('Failed to start monitoring engine:', error);
});

// 安装并使用 cookie-parser 中间件
const cookieParser = require('cookie-parser');
app.use(cookieParser());

// 启动服务器
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
    if (maintenance) {
        console.log('The application is currently in maintenance mode.');
    }
});

// 程序退出时关闭数据库连接和 stop monitoring engine
process.on('SIGINT', () => {
    sqliteManager.close();
    monitoringEngine.stop();
    process.exit(0);
});