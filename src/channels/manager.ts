import type { ClaudePipeConfig } from '../config/schema.js'
import { MessageBus } from '../core/bus.js'
import type { Logger } from '../core/types.js'
import type { Channel } from './base.js'
import { DiscordChannel } from './discord.js'
import { TelegramChannel } from './telegram.js'

/**
 * Owns channel adapter lifecycle and outbound message dispatching.
 */
export class ChannelManager {
  private readonly channels: Channel[]
  private dispatcherRunning = false

  constructor(
    config: ClaudePipeConfig,
    private readonly bus: MessageBus,
    private readonly logger: Logger
  ) {
    this.channels = [
      new TelegramChannel(config, bus, logger),
      new DiscordChannel(config, bus, logger)
    ]
  }

  /** Starts all adapters and launches outbound dispatcher. */
  async startAll(): Promise<void> {
    for (const channel of this.channels) {
      await channel.start()
    }

    this.dispatcherRunning = true
    void this.dispatchOutbound()
  }

  /** Stops outbound dispatch and all channel adapters. */
  async stopAll(): Promise<void> {
    this.dispatcherRunning = false

    for (const channel of this.channels) {
      await channel.stop()
    }
  }

  private async dispatchOutbound(): Promise<void> {
    while (this.dispatcherRunning) {
      const msg = await this.bus.consumeOutbound()
      const channel = this.channels.find((ch) => ch.name === msg.channel)

      if (!channel) {
        this.logger.warn('channel.unknown', { channel: msg.channel })
        continue
      }

      await channel.send(msg)
    }
  }
}
