import { ChannelManager } from './channels/manager.js'
import { setupCommands } from './commands/index.js'
import { loadConfig } from './config/load.js'
import { readSettings, settingsExist } from './config/settings.js'
import { AgentLoop } from './core/agent-loop.js'
import { MessageBus } from './core/bus.js'
import { ClaudeClient } from './core/claude-client.js'
import { logger } from './core/logger.js'
import { SessionStore } from './core/session-store.js'
import { runOnboarding } from './onboarding/wizard.js'

/** Check if --reconfigure flag was passed */
function isReconfigureMode(): boolean {
  return process.argv.includes('--reconfigure') || process.argv.includes('-r')
}

/** Check if --help flag was passed */
function isHelpMode(): boolean {
  return process.argv.includes('--help') || process.argv.includes('-h')
}

/** Show help message */
function showHelp(): void {
  console.log(
    '\nClaude Pipe - Bot for Telegram and Discord using Claude Code CLI\n\n' +
      'Usage: claude-pipe [options]\n\n' +
      'Options:\n' +
      '  --reconfigure, -r  Reconfigure existing settings\n' +
      '  --help, -h         Show this help message\n\n' +
      'Examples:\n' +
      '  claude-pipe           Start the bot\n' +
      '  claude-pipe -r        Reconfigure settings\n'
  )
}

/** Boots the Claude Pipe runtime and starts channel + agent loops. */
async function main(): Promise<void> {
  // Handle help mode
  if (isHelpMode()) {
    showHelp()
    return
  }

  // Handle reconfigure mode
  if (isReconfigureMode()) {
    if (!settingsExist()) {
      console.error('No settings found. Run onboarding first.')
      process.exit(1)
    }
    const existingSettings = readSettings()
    await runOnboarding(existingSettings)
    return
  }

  // Handle first-time setup
  if (!settingsExist()) {
    await runOnboarding()
    return
  }

  // Normal startup
  const config = loadConfig()
  const bus = new MessageBus()

  const sessionStore = new SessionStore(config.sessionStorePath)
  await sessionStore.init()

  logger.info('startup.config', {
    workspace: config.workspace,
    model: config.model
  })

  const claude = new ClaudeClient(config, sessionStore, logger)
  const agent = new AgentLoop(bus, config, claude, logger)
  const channels = new ChannelManager(config, bus, logger)

  const { handler } = setupCommands({ config, claude, sessionStore })
  agent.setCommandHandler(handler)

  const shutdown = async (signal: string): Promise<void> => {
    logger.info('shutdown.signal', { signal })
    agent.stop()
    await channels.stopAll()
  }

  process.on('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  await channels.startAll()
  await agent.start()
}

main().catch((error: unknown) => {
  logger.error('fatal', {
    error: error instanceof Error ? error.message : String(error)
  })
  process.exitCode = 1
})
