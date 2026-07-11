// dastbadast-multivendor-api/ecosystem.config.js
//
// ⭐ PM2 cluster mode: запускаем N воркеров API на одном сервере.
// Каждый воркер — отдельный процесс, шарящий порт через round-robin.
//
// Запуск: `npm run start:pm2`
// Мониторинг: `pm2 monit`
// Логи: `pm2 logs`
// Reload без downtime: `pm2 reload dastbadast-api`

module.exports = {
  apps: [
    {
      name: "dastbadast-api",
      script: "./src/index.js",
      instances: parseInt(process.env.API_INSTANCES, 10) || 2,
      exec_mode: "cluster",
      // ⭐ Graceful reload: PM2 шлёт SIGTERM, наш handler делает drain → exit
      kill_timeout: 30000,
      wait_ready: true,
      listen_timeout: 10000,
      // Auto-restart
      max_memory_restart: "512M",
      min_uptime: "10s",
      max_restarts: 10,
      // Logs
      out_file: "./logs/out.log",
      error_file: "./logs/err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      // Env
      env: {
        NODE_ENV: "production",
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 8001,
        REDIS_URL: process.env.REDIS_URL || "redis://127.0.0.1:6379",
        ENABLE_REDIS_PUBSUB: "1",
      },
    },
  ],
};
