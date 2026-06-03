const commonApp = {
  cwd: __dirname,
  script: 'node',
  instances: 1,
  exec_mode: 'fork',
  watch: false,
  autorestart: true,
  max_restarts: 10,
  restart_delay: 3000,
  merge_logs: true,
  log_date_format: 'YYYY-MM-DD HH:mm:ss',
  max_logs_backup: 7,
}

const commonEnv = {
  APP_ENV: process.env.APP_ENV || 'production',
  NODE_ENV: 'production',
}

module.exports = {
  apps: [
    {
      ...commonApp,
      name: 'quantify-api',
      args: 'apps/quantify/src/main.js',
      max_memory_restart: '1G',
      env: {
        ...commonEnv,
        PORT: 3010,
      },
    },
    {
      ...commonApp,
      name: 'quantify-backtest-worker',
      args: 'apps/quantify/src/worker.backtest.js',
      max_memory_restart: '2G',
      env: {
        ...commonEnv,
      },
    },
  ],
}
