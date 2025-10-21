const SQLiteManager = require('./SQLiteManager');
const net = require('net');
const dgram = require('dgram');
const axios = require('axios');

class MonitoringEngine {
    constructor() {
        this.db = new SQLiteManager();
        this.running = false;
        this.monitoringInterval = null;
        this.cleanupInterval = null;
    }

    async init() {
        await this.db.init();
        console.log('Monitoring engine initialized');
        
        // Run VACUUM on startup to optimize database
        try {
            await this.db.vacuum();
            console.log('Database optimized with VACUUM');
        } catch (error) {
            console.error('Error running VACUUM on startup:', error);
        }
    }

    start() {
        if (this.running) {
            console.log('Monitoring engine is already running');
            return;
        }

        this.running = true;
        console.log('Starting monitoring engine...');
        
        // Run monitoring checks every 1 second
        this.monitoringInterval = setInterval(() => {
            this.performMonitoring();
        }, 1000);
        
        // Run cleanup every 1 minute (60 seconds)
        this.cleanupInterval = setInterval(() => {
            this.performCleanup();
        }, 60000);
        
        // Run initial check
        this.performMonitoring();
    }

    stop() {
        if (!this.running) {
            console.log('Monitoring engine is not running');
            return;
        }

        this.running = false;
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        console.log('Monitoring engine stopped');
    }

    async performMonitoring() {
        console.log('Performing monitoring checks...');
        try {
            await this.checkTcpMonitors();
            await this.checkUdpMonitors();
            await this.checkHttpMonitors();
        } catch (error) {
            console.error('Error during monitoring:', error);
        }
    }

    async performCleanup() {
        console.log('Performing cleanup of old records...');
        try {
            await this.db.deleteOldTcpResults();
            await this.db.deleteOldUdpResults();
            await this.db.deleteOldHttpResults();
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    }

    async checkTcpMonitors() {
        try {
            const monitors = await this.db.getAllTcpMonitors();
            console.log(`Checking ${monitors.length} TCP monitors`);
            
            for (const monitor of monitors) {
                if (!monitor.enabled) {
                    continue;
                }

                // Check if it's time to run this monitor
                if (this.shouldRunMonitor(monitor)) {
                    console.log(`Running TCP monitor ${monitor.id} for ${monitor.ip}:${monitor.port}`);
                    // Update last executed time before running the monitor
                    await this.updateLastExecuted(monitor.id, 'tcp');
                    await this.runTcpMonitor(monitor);
                }
            }
        } catch (error) {
            console.error('Error checking TCP monitors:', error);
        }
    }

    async checkUdpMonitors() {
        try {
            const monitors = await this.db.getAllUdpMonitors();
            console.log(`Checking ${monitors.length} UDP monitors`);
            
            for (const monitor of monitors) {
                if (!monitor.enabled) {
                    continue;
                }

                // Check if it's time to run this monitor
                if (this.shouldRunMonitor(monitor)) {
                    console.log(`Running UDP monitor ${monitor.id} for ${monitor.ip}:${monitor.port}`);
                    // Update last executed time before running the monitor
                    await this.updateLastExecuted(monitor.id, 'udp');
                    await this.runUdpMonitor(monitor);
                }
            }
        } catch (error) {
            console.error('Error checking UDP monitors:', error);
        }
    }

    async checkHttpMonitors() {
        try {
            const monitors = await this.db.getAllHttpMonitors();
            console.log(`Checking ${monitors.length} HTTP(S) monitors`);
            
            for (const monitor of monitors) {
                if (!monitor.enabled) {
                    continue;
                }

                // Check if it's time to run this monitor
                if (this.shouldRunMonitor(monitor)) {
                    console.log(`Running HTTP(S) monitor ${monitor.id} for ${monitor.url}`);
                    // Update last executed time before running the monitor
                    await this.updateLastExecuted(monitor.id, 'http');
                    await this.runHttpMonitor(monitor);
                }
            }
        } catch (error) {
            console.error('Error checking HTTP(S) monitors:', error);
        }
    }

    shouldRunMonitor(monitor) {
        // If never executed, run it
        if (!monitor.last_executed) {
            return true;
        }

        // Calculate next execution time
        const lastExecuted = new Date(monitor.last_executed);
        const nextExecution = new Date(lastExecuted.getTime() + (monitor.interval_seconds * 1000));
        const now = new Date();

        // Run if it's time
        return now >= nextExecution;
    }

    async runTcpMonitor(monitor) {
        const startTime = Date.now();
        let success = false;
        let responseTime = 0;
        let errorMessage = null;

        return new Promise((resolve) => {
            const socket = new net.Socket();
            const timeout = 5000; // 5 seconds timeout

            const connectTimeout = setTimeout(() => {
                socket.destroy();
                success = false;
                responseTime = Date.now() - startTime;
                errorMessage = 'Connection timeout';
                this.saveTcpResult(monitor.id, success, responseTime, errorMessage);
                resolve();
            }, timeout);

            socket.connect(monitor.port, monitor.ip, () => {
                clearTimeout(connectTimeout);
                socket.destroy();
                success = true;
                responseTime = Date.now() - startTime;
                this.saveTcpResult(monitor.id, success, responseTime, errorMessage);
                resolve();
            });

            socket.on('error', (err) => {
                clearTimeout(connectTimeout);
                socket.destroy();
                success = false;
                responseTime = Date.now() - startTime;
                errorMessage = err.message;
                this.saveTcpResult(monitor.id, success, responseTime, errorMessage);
                resolve();
            });
        });
    }

    async runUdpMonitor(monitor) {
        const startTime = Date.now();
        let success = false;
        let responseTime = 0;
        let errorMessage = null;

        return new Promise((resolve) => {
            const client = dgram.createSocket('udp4');
            const timeout = 5000; // 5 seconds timeout
            const message = Buffer.from('ping');

            const connectTimeout = setTimeout(() => {
                client.close();
                success = false;
                responseTime = Date.now() - startTime;
                errorMessage = 'Connection timeout';
                this.saveUdpResult(monitor.id, success, responseTime, errorMessage);
                resolve();
            }, timeout);

            client.send(message, monitor.port, monitor.ip, (err) => {
                clearTimeout(connectTimeout);
                if (err) {
                    client.close();
                    success = false;
                    responseTime = Date.now() - startTime;
                    errorMessage = err.message;
                    this.saveUdpResult(monitor.id, success, responseTime, errorMessage);
                } else {
                    client.close();
                    success = true;
                    responseTime = Date.now() - startTime;
                    this.saveUdpResult(monitor.id, success, responseTime, errorMessage);
                }
                resolve();
            });
        });
    }

    async runHttpMonitor(monitor) {
        const startTime = Date.now();
        let success = false;
        let responseTime = 0;
        let statusCode = null;
        let responseBody = null;
        let errorMessage = null;

        try {
            const config = {
                method: monitor.method,
                url: monitor.url,
                timeout: 5000, // 5 seconds timeout
            };

            // Add headers if provided
            if (monitor.headers) {
                config.headers = monitor.headers;
            }

            // Add body based on body type
            if (monitor.body_type === 'raw' && monitor.body) {
                config.data = monitor.body;
            } else if ((monitor.body_type === 'form-data' || monitor.body_type === 'x-www-form-urlencoded') && monitor.form_data) {
                config.data = monitor.form_data;
            }

            const response = await axios(config);
            
            success = true;
            responseTime = Date.now() - startTime;
            statusCode = response.status;
            responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        } catch (error) {
            responseTime = Date.now() - startTime;
            if (error.response) {
                // Got a response but with error status code
                success = false;
                statusCode = error.response.status;
                responseBody = typeof error.response.data === 'string' ? error.response.data : JSON.stringify(error.response.data);
            } else if (error.request) {
                // Request was made but no response received
                success = false;
                errorMessage = 'No response received';
            } else {
                // Something else happened
                success = false;
                errorMessage = error.message;
            }
        }

        await this.saveHttpResult(monitor.id, success, responseTime, statusCode, responseBody, errorMessage);
    }

    async saveTcpResult(monitorId, success, responseTime, errorMessage) {
        try {
            await this.db.addTcpMonitorResult(monitorId, success, responseTime, errorMessage);
            console.log(`Saved TCP result for monitor ${monitorId}: ${success ? 'Success' : 'Failed'}`);
        } catch (error) {
            console.error(`Error saving TCP result for monitor ${monitorId}:`, error);
        }
    }

    async saveUdpResult(monitorId, success, responseTime, errorMessage) {
        try {
            await this.db.addUdpMonitorResult(monitorId, success, responseTime, errorMessage);
            console.log(`Saved UDP result for monitor ${monitorId}: ${success ? 'Success' : 'Failed'}`);
        } catch (error) {
            console.error(`Error saving UDP result for monitor ${monitorId}:`, error);
        }
    }

    async saveHttpResult(monitorId, success, responseTime, statusCode, responseBody, errorMessage) {
        try {
            await this.db.addHttpMonitorResult(monitorId, success, responseTime, statusCode, responseBody, errorMessage);
            console.log(`Saved HTTP(S) result for monitor ${monitorId}: ${success ? 'Success' : 'Failed'}`);
        } catch (error) {
            console.error(`Error saving HTTP(S) result for monitor ${monitorId}:`, error);
        }
    }

    async updateLastExecuted(monitorId, type) {
        try {
            switch (type) {
                case 'tcp':
                    await this.db.updateLastExecutedTcp(monitorId);
                    break;
                case 'udp':
                    await this.db.updateLastExecutedUdp(monitorId);
                    break;
                case 'http':
                    await this.db.updateLastExecutedHttp(monitorId);
                    break;
            }
        } catch (error) {
            console.error(`Error updating last executed time for ${type} monitor ${monitorId}:`, error);
        }
    }
}

// Run the engine if this file is executed directly
if (require.main === module) {
    const engine = new MonitoringEngine();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('Received SIGINT, shutting down gracefully...');
        engine.stop();
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        console.log('Received SIGTERM, shutting down gracefully...');
        engine.stop();
        process.exit(0);
    });

    // Initialize and start the engine
    engine.init().then(() => {
        engine.start();
    }).catch((error) => {
        console.error('Failed to start monitoring engine:', error);
        process.exit(1);
    });
}

module.exports = MonitoringEngine;