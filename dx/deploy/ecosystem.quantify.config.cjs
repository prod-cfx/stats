module.exports = {
  apps: [
    {
      name: 'quantify',
      cwd: '.',
      script: 'node',
      args: 'apps/quantify/src/main.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      max_memory_restart: '1G',
      max_logs_backup: 7,
      env: {
        APP_ENV: process.env.APP_ENV || 'production',
        NODE_ENV: 'production',
        PORT: 3010,
      },
    },
  ],
}
