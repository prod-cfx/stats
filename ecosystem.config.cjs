/**
 * PM2 进程管理配置文件（CommonJS 格式）
 * 用于开发环境同时启动和管理 backend、front、admin 三个服务
 *
 * 使用方法：
 *   启动所有服务: pnpm pm2 start ecosystem.config.cjs
 *   实时监控:     pnpm pm2 monit
 *   查看日志:     pnpm pm2 logs backend
 *   重启服务:     pnpm pm2 restart backend
 *   停止所有:     pnpm pm2 stop all
 *   删除所有:     pnpm pm2 delete all
 */

// 动态解析项目根目录（跨平台兼容）
const projectRoot = __dirname;

// 通用配置
const commonConfig = {
  cwd: projectRoot,
  script: './scripts/dx',
  env: {
    NODE_ENV: 'development',
    APP_ENV: 'development',
  },
  max_memory_restart: '500M',
  merge_logs: true,
  autorestart: true,
  watch: false,
};

// 创建应用配置的工厂函数
function createAppConfig(name) {
  return {
    ...commonConfig,
    name,
    args: `start ${name} --dev`,
    error_file: `./logs/pm2/${name}-error.log`,
    out_file: `./logs/pm2/${name}-out.log`,
  };
}

module.exports = {
  apps: [
    createAppConfig('backend'),
    createAppConfig('front'),
    createAppConfig('admin'),
  ],
};
