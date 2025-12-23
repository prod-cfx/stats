/**
 * 跨端计时器工具：可注入自定义 now 函数以便测试
 */
export class Timer {
  private startTime: number

  constructor(private readonly now: () => number = () => Date.now()) {
    this.startTime = this.now()
  }

  /** 返回自构造/重置以来的毫秒数 */
  getElapsedTime(): number {
    return this.now() - this.startTime
  }

  /** 重置计时基准点 */
  reset(): void {
    this.startTime = this.now()
  }
}
