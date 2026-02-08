import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  type SDKMessage,
  type SDKSession,
  type McpSdkServerConfigWithInstance
} from '@anthropic-ai/claude-agent-sdk'

import type { MicroclawConfig } from '../config/schema.js'
import type { ToolRegistry } from './tool-registry.js'
import { createToolMcpServer } from './mcp-server.js'
import { SessionStore } from './session-store.js'
import { TranscriptLogger } from './transcript-logger.js'
import type { Logger, ToolContext } from './types.js'

type AssistantTextBlock = { type: 'text'; text: string }

function isTextBlock(block: unknown): block is AssistantTextBlock {
  if (!block || typeof block !== 'object') return false
  const candidate = block as { type?: unknown; text?: unknown }
  return candidate.type === 'text' && typeof candidate.text === 'string'
}

function extractSessionId(msg: SDKMessage): string | undefined {
  return 'session_id' in msg ? (msg.session_id as string | undefined) : undefined
}

function getAssistantText(msg: SDKMessage): string {
  if (msg.type !== 'assistant') return ''
  return (msg.message.content as unknown[])
    .filter((block: unknown) => isTextBlock(block))
    .map((block: AssistantTextBlock) => block.text)
    .join('')
}

/**
 * Manages Claude SDK V2 sessions and turn execution.
 *
 * Sessions are keyed by normalized conversation key (`channel:chat_id`) and persisted
 * as session IDs through `SessionStore`.
 */
export class ClaudeClient {
  private readonly sessions = new Map<string, SDKSession>()
  private readonly mcpServer: McpSdkServerConfigWithInstance
  private readonly transcript: TranscriptLogger
  private activeToolContext: ToolContext | null = null

  constructor(
    private readonly config: MicroclawConfig,
    private readonly store: SessionStore,
    private readonly registry: ToolRegistry,
    private readonly logger: Logger
  ) {
    this.mcpServer = createToolMcpServer(
      this.registry,
      () => this.activeToolContext,
      this.logger
    )
    this.transcript = new TranscriptLogger(this.config.transcriptLog)
  }

  /**
   * Executes a single conversational turn with tool support.
   */
  async runTurn(conversationKey: string, userText: string, context: ToolContext): Promise<string> {
    const session = this.getOrCreateSession(conversationKey)
    let responseText = ''
    let observedSessionId: string | undefined = this.store.get(conversationKey)?.sessionId

    this.activeToolContext = context

    try {
      await this.transcript.log(conversationKey, { type: 'user', text: userText })
      await session.send(userText)

      for await (const msg of session.stream()) {
        const sid = extractSessionId(msg)
        if (sid) observedSessionId = sid

        await this.transcript.log(conversationKey, { type: msg.type })

        if (msg.type === 'assistant') {
          const assistantText = getAssistantText(msg)
          if (assistantText) {
            responseText = assistantText
            await this.transcript.log(conversationKey, {
              type: 'assistant_text',
              text: assistantText
            })
          }
        }

        if (msg.type === 'result') {
          if (msg.is_error) {
            this.logger.warn('claude.result_error', {
              conversationKey,
              subtype: msg.subtype,
              errors: 'errors' in msg ? msg.errors : undefined
            })
          }
          break
        }
      }

      if (!observedSessionId) {
        try {
          observedSessionId = session.sessionId
        } catch {
          // Ignore: session ID is unavailable until initialized.
        }
      }

      if (observedSessionId) {
        await this.store.set(conversationKey, observedSessionId)
      }

      return responseText || 'I completed processing but have no response to return.'
    } catch (error) {
      this.logger.error('claude.turn_failed', {
        conversationKey,
        error: error instanceof Error ? error.message : String(error)
      })
      return 'Sorry, I hit an error while processing that request.'
    } finally {
      this.activeToolContext = null
    }
  }

  /** Closes all live sessions and releases process resources. */
  closeAll(): void {
    for (const session of this.sessions.values()) {
      session.close()
    }
    this.sessions.clear()
  }

  private getOrCreateSession(conversationKey: string): SDKSession {
    const cached = this.sessions.get(conversationKey)
    if (cached) return cached

    const saved = this.store.get(conversationKey)
    const baseOptions = {
      model: this.config.model,
      cwd: this.config.workspace,
      permissionMode: 'bypassPermissions' as const,
      allowDangerouslySkipPermissions: true,
      systemPrompt: {
        type: 'preset' as const,
        preset: 'claude_code' as const,
        append:
          'You are microclaw. Prefer MCP tools for file/web/shell operations. ' +
          'For normal chat replies, return direct text responses.'
      },
      tools: [] as string[],
      mcpServers: {
        microclaw: this.mcpServer
      }
    }

    const session = saved
      ? unstable_v2_resumeSession(saved.sessionId, baseOptions)
      : unstable_v2_createSession(baseOptions)

    this.sessions.set(conversationKey, session)
    return session
  }
}
