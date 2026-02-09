import { ChannelManager } from './channels/manager.js'
import {
  CommandHandler,
  CommandRegistry,
  sessionNewCommand,
  sessionListCommand,
  sessionInfoCommand,
  sessionDeleteCommand,
  helpCommand,
  statusCommand,
  pingCommand,
  claudeModelCommand,
  configSetCommand,
  configGetCommand
} from './commands/index.js'
import { loadConfig } from './config/load.js'
import { settingsExist } from './config/settings.js'
import { AgentLoop } from './core/agent-loop.js'
import { MessageBus } from './core/bus.js'
import { ClaudeClient } from './core/claude-client.js'
import { logger } from './core/logger.js'
import { SessionStore } from './core/session-store.js'
import { runOnboarding } from './onboarding/wizard.js'

/** Boots the Claude Pipe runtime and starts channel + agent loops. */
async function main(): Promise<void> {
  if (!settingsExist()) {
    await runOnboarding()
    return
  }

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

  // --- Command system wiring ---
  const registry = new CommandRegistry()

  registry.register(
    sessionNewCommand((key) => claude.startNewSession(key))
  )
  registry.register(
    sessionListCommand(() => {
      // Expose session records from the store
      const entries: Array<{ key: string; updatedAt: string }> = []
      for (const [key, record] of Object.entries(sessionStore.entries())) {
        if (record) entries.push({ key, updatedAt: record.updatedAt })
      }
      return entries
    })
  )
  registry.register(
    sessionInfoCommand((key) => sessionStore.get(key))
  )
  registry.register(
    sessionDeleteCommand((key) => claude.startNewSession(key))
  )
  registry.register(helpCommand(registry))
  registry.register(
    statusCommand(() => ({
      model: config.model,
      workspace: config.workspace,
      channels: [
        ...(config.channels.telegram.enabled ? ['telegram'] : []),
        ...(config.channels.discord.enabled ? ['discord'] : [])
      ]
    }))
  )
  registry.register(pingCommand())
  registry.register(
    claudeModelCommand(() => config.model)
  )

  const mutableConfig: Record<string, string> = {}
  registry.register(
    configSetCommand((key, value) => {
      const allowed = ['summaryPromptEnabled']
      if (!allowed.includes(key)) return false
      mutableConfig[key] = value
      return true
    })
  )
  registry.register(
    configGetCommand((key) => {
      if (key) {
        const val = mutableConfig[key]
        return val !== undefined ? val : undefined
      }
      return { model: config.model, workspace: config.workspace, ...mutableConfig }
    })
  )

  const adminIds = [
    ...config.channels.telegram.allowFrom,
    ...config.channels.discord.allowFrom
  ]
  const commandHandler = new CommandHandler(registry, adminIds)
  agent.setCommandHandler(commandHandler)
  // --- End command system wiring ---

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
