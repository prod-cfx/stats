import { logger } from '../../logger.js'
import { execManager } from '../../exec.js'

export async function handlePackage(cli, args) {
  const target = args[0] || 'backend'
  if (target !== 'backend') {
    logger.error(`暂不支持打包目标: ${target}`)
    logger.info('当前仅支持 ./scripts/dx package backend')
    process.exitCode = 1
    return
  }

  cli.ensureRepoRoot()

  const environment = cli.determineEnvironment()
  const passthroughFlags = cli.args.filter(token =>
    ['--skip-build', '--keep-workdir'].includes(token),
  )
  const extraArgs = passthroughFlags.length > 0 ? ` ${passthroughFlags.join(' ')}` : ''
  const command = `node scripts/lib/backend-package.js --env=${environment}${extraArgs}`

  logger.step(`打包 ${target} (${environment})`)

  await execManager.executeCommand(command, {
    app: 'backend',
    flags: cli.flags,
  })
}
