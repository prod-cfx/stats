/**
 * PM2 进程管理配置文件（CommonJS 格式）
 * 支持开发和生产环境
 *
 * 使用方法：
 *   开发环境:
 *     pm2 start ecosystem.config.cjs
 *     pm2 monit
 *     pm2 logs backend
 *
 *   生产环境:
 *     NODE_ENV=production pm2 start ecosystem.config.cjs --env production
 *     pm2 save
 *     pm2 startup
 *
 *   通用命令:
 *     pm2 restart backend
 *     pm2 stop all
 *     pm2 delete all
 */

const path = require('path');
const projectRoot = __dirname;

// 检测运行环境（支持 NODE_ENV 和 PM2_ENV）
const isProduction = process.env.NODE_ENV === 'production' || process.env.PM2_ENV === 'production';

/**
 * 创建 Backend 配置
 */
function createBackendConfig() {
  if (isProduction) {
    return {
      name: 'backend',
      cwd: path.join(projectRoot, 'apps/backend'),
      script: 'dist/main.js',
      exec_mode: 'cluster',
      instances: 2,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      error_file: path.join(projectRoot, 'logs/pm2-prod/backend-error.log'),
      out_file: path.join(projectRoot, 'logs/pm2-prod/backend-out.log'),
      merge_logs: true,
      autorestart: true,
      watch: false,
    };
  }

  return {
    name: 'backend',
    cwd: projectRoot,
    script: './scripts/dx',
    args: 'start backend --dev',
    env: {
      NODE_ENV: 'development',
      APP_ENV: 'development',
    },
    max_memory_restart: '500M',
    error_file: './logs/pm2/backend-error.log',
    out_file: './logs/pm2/backend-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
  };
}

/**
 * 创建 Front 配置
 */
function createFrontConfig() {
  if (isProduction) {
    return {
      name: 'front',
      cwd: path.join(projectRoot, 'apps/front'),
      script: path.join(projectRoot, 'node_modules/.bin/next'),
      args: 'start -p 3001',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
      max_memory_restart: '1G',
      error_file: path.join(projectRoot, 'logs/pm2-prod/front-error.log'),
      out_file: path.join(projectRoot, 'logs/pm2-prod/front-out.log'),
      merge_logs: true,
      autorestart: true,
      watch: false,
    };
  }

  return {
    name: 'front',
    cwd: projectRoot,
    script: './scripts/dx',
    args: 'start front --dev',
    env: {
      NODE_ENV: 'development',
      APP_ENV: 'development',
    },
    max_memory_restart: '500M',
    error_file: './logs/pm2/front-error.log',
    out_file: './logs/pm2/front-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
  };
}

/**
 * 创建 Admin 配置
 */
function createAdminConfig() {
  if (isProduction) {
    return {
      name: 'admin',
      cwd: path.join(projectRoot, 'apps/admin-front'),
      script: path.join(projectRoot, 'node_modules/.bin/next'),
      args: 'start -p 3500',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
      },
      max_memory_restart: '1G',
      error_file: path.join(projectRoot, 'logs/pm2-prod/admin-error.log'),
      out_file: path.join(projectRoot, 'logs/pm2-prod/admin-out.log'),
      merge_logs: true,
      autorestart: true,
      watch: false,
    };
  }

  return {
    name: 'admin',
    cwd: projectRoot,
    script: './scripts/dx',
    args: 'start admin --dev',
    env: {
      NODE_ENV: 'development',
      APP_ENV: 'development',
    },
    max_memory_restart: '500M',
    error_file: './logs/pm2/admin-error.log',
    out_file: './logs/pm2/admin-out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
  };
}

module.exports = {
  apps: [
    createBackendConfig(),
    createFrontConfig(),
    createAdminConfig(),
  ],
};
