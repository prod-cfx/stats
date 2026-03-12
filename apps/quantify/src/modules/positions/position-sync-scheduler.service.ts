import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PositionSyncService } from './position-sync.service'

/**
 * 浠撲綅鍚屾瀹氭椂浠诲姟璋冨害鍣?
 * 瀹氭湡鎵ц涓庝氦鏄撴墍鐨勪粨浣嶅璐?
 */
@Injectable()
export class PositionSyncSchedulerService {
  private readonly logger = new Logger(PositionSyncSchedulerService.name)

  constructor(private readonly positionSyncService: PositionSyncService) {}

  /**
   * 姣?0鍒嗛挓鎵ц涓€娆℃壒閲忎粨浣嶅悓姝?
   * 鍙牴鎹笟鍔￠渶姹傝皟鏁撮鐜?
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async handlePositionReconciliation() {
    this.logger.log('Starting scheduled position reconciliation')
    const startTime = Date.now()

    try {
      const results = await this.positionSyncService.syncAllActivePositions()

      const duration = Date.now() - startTime
      const successCount = results.filter(r => r.success).length
      const totalDifferences = results.reduce((sum, r) => sum + r.differences.length, 0)

      this.logger.log(
        `Position reconciliation completed in ${duration}ms: ` +
        `${successCount}/${results.length} accounts successful, ` +
        `${totalDifferences} total differences found`,
      )

      // 璁板綍鏈夐棶棰樼殑璐︽埛
      const failedResults = results.filter(r => !r.success)
      if (failedResults.length > 0) {
        this.logger.warn(
          `${failedResults.length} accounts failed reconciliation: ${
            failedResults.map(r => `${r.userId}(${r.errors?.join(', ')})`).join('; ')
          }`,
        )
      }

      // 璁板綍鏈夋樉钁楀樊寮傜殑璐︽埛
      const significantDiffs = results.filter(r => r.differences.length > 0)
      if (significantDiffs.length > 0) {
        this.logger.log(
          `Found ${significantDiffs.length} accounts with position differences`,
        )
        for (const result of significantDiffs) {
          this.logger.debug(
            `Account ${result.userId}: ${result.differences.map(d =>
              `${d.symbol} ${d.positionSide} ${d.action} (${d.difference})`
            ).join(', ')}`,
          )
        }
      }
    }
    catch (error) {
      this.logger.error(
        `Scheduled position reconciliation failed: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }

  /**
   * 姣忓ぉ鍑屾櫒2鐐规墽琛屽畬鏁寸殑浠撲綅瀹¤
   * 鐢ㄤ簬鐢熸垚鏃ユ姤鍜屾娴嬮暱鏈熸湭淇鐨勫樊寮?
   */
  @Cron('0 2 * * *')
  async handleDailyPositionAudit() {
    this.logger.log('Starting daily position audit')

    try {
      const results = await this.positionSyncService.syncAllActivePositions()

      // 鍙互鍦ㄨ繖閲屾坊鍔犳洿璇︾粏鐨勫璁￠€昏緫锛屼緥濡傦細
      // - 鐢熸垚瀹¤鎶ュ憡
      // - 鍙戦€佸憡璀﹂€氱煡
      // - 璁板綍鍒颁笓闂ㄧ殑瀹¤鏃ュ織琛?

      const totalAccounts = results.length
      const accountsWithDiffs = results.filter(r => r.differences.length > 0).length
      const totalDiffs = results.reduce((sum, r) => sum + r.differences.length, 0)

      this.logger.log(
        `Daily audit completed: ${totalAccounts} accounts checked, ` +
        `${accountsWithDiffs} with differences, ${totalDiffs} total differences`,
      )

      // 淇濆瓨瀹¤缁撴灉鍒版暟鎹簱锛堝彲閫夛級
      // await this.saveAuditResults(results)
    }
    catch (error) {
      this.logger.error(
        `Daily position audit failed: ${(error as Error).message}`,
        (error as Error).stack,
      )
    }
  }
}
