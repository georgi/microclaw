import type { CommandDefinition, CommandResult } from '../types.js'
import type { CommandRegistry } from '../registry.js'

/**
 * /help [command]
 * Lists all commands or shows detailed help for a specific command.
 */
export function helpCommand(registry: CommandRegistry): CommandDefinition {
  return {
    name: 'help',
    category: 'utility',
    description: 'Show available commands or help for a specific command',
    usage: '/help [command]',
    aliases: [],
    permission: 'user',
    async execute(ctx): Promise<CommandResult> {
      if (ctx.args.length > 0 && ctx.args[0]) {
        const target = registry.get(ctx.args[0])
        if (!target) {
          return { content: `Unknown command: \`${ctx.args[0]}\``, error: true }
        }
        const lines = [
          `**/${target.name}** — ${target.description}`,
          ...(target.usage ? [`Usage: ${target.usage}`] : []),
          ...(target.aliases && target.aliases.length > 0
            ? [`Aliases: ${target.aliases.map((a) => `/${a}`).join(', ')}`]
            : []),
          `Permission: ${target.permission}`
        ]
        return { content: lines.join('\n') }
      }

      const grouped = new Map<string, CommandDefinition[]>()
      for (const cmd of registry.all()) {
        const list = grouped.get(cmd.category) ?? []
        list.push(cmd)
        grouped.set(cmd.category, list)
      }

      const sections: string[] = []
      for (const [category, commands] of grouped) {
        const heading = category.charAt(0).toUpperCase() + category.slice(1)
        const items = commands.map((c) => `  /${c.name} — ${c.description}`)
        sections.push(`**${heading}:**\n${items.join('\n')}`)
      }

      return { content: sections.join('\n\n') }
    }
  }
}

/**
 * /status
 * Reports basic runtime status.
 */
export function statusCommand(
  getStatus: () => { model: string; workspace: string; channels: string[] }
): CommandDefinition {
  return {
    name: 'status',
    category: 'utility',
    description: 'Show bot runtime status',
    aliases: [],
    permission: 'user',
    async execute(): Promise<CommandResult> {
      const status = getStatus()
      return {
        content:
          `**Status:**\n` +
          `• Model: ${status.model}\n` +
          `• Workspace: ${status.workspace}\n` +
          `• Channels: ${status.channels.join(', ')}`
      }
    }
  }
}

/**
 * /ping
 * Simple health-check.
 */
export function pingCommand(): CommandDefinition {
  return {
    name: 'ping',
    category: 'utility',
    description: 'Health check — replies with pong',
    aliases: [],
    permission: 'user',
    async execute(): Promise<CommandResult> {
      return { content: 'pong 🏓' }
    }
  }
}
