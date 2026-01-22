module.exports = {
  apps: [
    {
      name: "backend",  // AI Backend 主应用
      cwd: "/opt/ai-monorepo",  // 项目根目录
      script: "./scripts/dx",  // 使用 dx 命令
      args: "start backend --prod",  // 启动参数
      interpreter: "none",  // 不使用特定解释器
      watch: false,  // 不监控文件变化
      autorestart: true,  // 进程崩溃时自动重启
      max_restarts: 10,  // 最多重启10次
      restart_delay: 3000,  // 重启前等待3秒
      instances: 1,  // 单实例运行
      exec_mode: "fork",  // fork模式
      merge_logs: true,  // 合并日志
      log_date_format: "YYYY-MM-DD HH:mm:ss",  // 日志时间格式
      max_logs_backup: 7,  // 只保留7天的日志文件
      log_type: "raw",  // 日志类型
      // 内存限制
      max_memory_restart: "1G"
    }
  ]
};
