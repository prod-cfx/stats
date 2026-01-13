/**
 * 生产环境模块路径解析
 * 在 Node.js 启动时通过 --require 加载，设置正确的模块搜索路径
 */
const path = require('path');
const Module = require('module');

// 计算项目根目录（从 apps/backend/scripts 向上三级）
const projectRoot = path.resolve(__dirname, '../../..');

// 添加项目根目录的 node_modules 到模块搜索路径
const nodeModulesPath = path.join(projectRoot, 'node_modules');

// 保存原始的解析函数
const originalResolveFilename = Module._resolveFilename;

// 重写模块解析函数
Module._resolveFilename = function (request, parent, isMain, options) {
  // 首先尝试默认解析
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (err) {
    // 如果默认解析失败，尝试从项目根目录的 node_modules 解析
    if (err.code === 'MODULE_NOT_FOUND') {
      try {
        const resolvedPath = require.resolve(request, { paths: [nodeModulesPath] });
        return resolvedPath;
      } catch {
        // 如果仍然找不到，抛出原始错误
        throw err;
      }
    }
    throw err;
  }
};

console.log(`[module-paths] 已配置模块路径解析，项目根目录: ${projectRoot}`);
