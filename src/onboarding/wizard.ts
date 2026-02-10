import * as fs from 'node:fs'
import * as path from 'node:path'
import * as readline from 'node:readline'

import { type Settings, writeSettings } from '../config/settings.js'

/* ------------------------------------------------------------------ */
/*  Readline helpers                                                   */
/* ------------------------------------------------------------------ */

function createInterface(): readline.Interface {
  return readline.createInterface({ input: process.stdin, output: process.stdout })
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()))
  })
}

/* ------------------------------------------------------------------ */
/*  Step 1 – Check Claude Code CLI availability                        */
/* ------------------------------------------------------------------ */

async function checkClaudeCli(): Promise<void> {
  const { execFileSync } = await import('node:child_process')
  try {
    execFileSync('claude', ['--version'], { stdio: 'pipe' })
  } catch {
    console.error(
      '\n✖  Claude Code CLI not found.\n' +
        '   Install it first: https://docs.anthropic.com/en/docs/claude-code\n'
    )
    process.exit(1)
  }
  console.log('✔  Claude Code CLI detected.\n')
}

/* ------------------------------------------------------------------ */
/*  Step 2 – Choose channel                                            */
/* ------------------------------------------------------------------ */

async function chooseChannel(
  rl: readline.Interface,
  current?: 'telegram' | 'discord'
): Promise<'telegram' | 'discord'> {
  const currentLabel = current === 'telegram' ? '1' : current === 'discord' ? '2' : ''
  console.log('Which messaging platform do you want to use?\n  1) Telegram\n  2) Discord\n')
  const choice = await ask(rl, `Enter 1 or 2${current ? ` [${currentLabel}]` : ''}: `)
  if (choice === '2') return 'discord'
  if (choice === '1') return 'telegram'
  return current ?? 'telegram'
}

/* ------------------------------------------------------------------ */
/*  Step 3 / 4 – Collect bot credentials                               */
/* ------------------------------------------------------------------ */

async function collectCredentials(
  rl: readline.Interface,
  channel: 'telegram' | 'discord',
  currentToken?: string
): Promise<string> {
  if (channel === 'telegram') {
    console.log(
      '\nCreate a Telegram bot:\n' +
        '  1. Open @BotFather in Telegram\n' +
        '  2. Send /newbot and follow the prompts\n' +
        '  3. Copy the bot token\n'
    )
  } else {
    console.log(
      '\nCreate a Discord bot:\n' +
        '  1. Go to https://discord.com/developers/applications\n' +
        '  2. Create a new application → Bot → Reset Token\n' +
        '  3. Copy the bot token\n'
    )
  }
  let token = ''
  while (!token) {
    const prompt = currentToken
      ? `Paste your bot token [${currentToken.slice(0, 8)}...]: `
      : 'Paste your bot token: '
    const input = await ask(rl, prompt)
    token = input || currentToken || ''
  }
  return token
}

/* ------------------------------------------------------------------ */
/*  Step – Configure optional webhook server                           */
/* ------------------------------------------------------------------ */

interface WebhookSettings {
  enabled: boolean
  port: number
  url: string
  secret: string
}

/* Detect local network IP address */
function detectLocalIp(): string | null {
  const os = require('node:os')
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address
      }
    }
  }
  return null
}

/* Fetch public IP from external service */
async function detectPublicIp(): Promise<string | null> {
  try {
    const response = await fetch('https://api.ipify.org?format=text', {
      signal: AbortSignal.timeout(5000)
    })
    return await response.text()
  } catch {
    return null
  }
}

async function configureWebhook(
  rl: readline.Interface,
  channel: 'telegram' | 'discord',
  currentWebhook?: WebhookSettings
): Promise<WebhookSettings> {
  const disabled: WebhookSettings = { enabled: false, port: 3000, url: '', secret: '' }

  const currentEnabled = currentWebhook?.enabled
  const defaultChoice = currentEnabled ? '2' : '1'

  console.log(
    '\nWould you like to enable webhook mode?\n\n' +
      '  Webhooks let your bot receive messages via HTTP instead of polling.\n' +
      '  Recommended for production deployments and container environments.\n' +
      '  Requires a publicly accessible URL (or a tunnel like ngrok).\n\n' +
      '  1) No  – use default polling/gateway (simpler, great for development)\n' +
      '  2) Yes – configure a webhook server\n'
  )
  const choice = await ask(rl, `Enter 1 or 2 [${defaultChoice}]: `)
  if (choice === '1') return disabled
  if (choice !== '2' && !currentEnabled) return disabled

  const currentPort = currentWebhook?.port ?? 3000
  const portInput = await ask(rl, `Webhook server port [${currentPort}]: `)
  const port = portInput ? Number(portInput) : currentPort

  // Detect IPs for suggestion
  const localIp = detectLocalIp()
  const publicIp = await detectPublicIp()

  let suggestion = ''
  if (publicIp) {
    suggestion = `\n(detected public IP: http://${publicIp}:${port})`
  } else if (localIp) {
    suggestion = `\n(detected local IP: http://${localIp}:${port})`
  }

  const currentUrl = currentWebhook?.url ?? ''
  if (currentUrl) {
    suggestion += `\n(current: ${currentUrl})`
  }

  let url = ''
  while (!url) {
    const prompt = `Public URL${suggestion}\n(e.g. https://yourdomain.com or https://xxx.ngrok-free.app): `
    url = await ask(rl, prompt)
    if (!url && currentUrl) url = currentUrl
  }

  let secret = ''
  const currentSecret = currentWebhook?.secret ?? ''
  if (channel === 'telegram') {
    console.log(
      '\n  Telegram supports a secret token to verify webhook requests.\n' +
        '  Leave blank to keep current or auto-generate one.\n'
    )
    const prompt = currentSecret
      ? `Webhook secret [${currentSecret}]: `
      : 'Webhook secret [auto]: '
    const input = await ask(rl, prompt)
    secret = input || currentSecret || generateSecret()
    if (input || !currentSecret) console.log(`  ✔  Secret: ${secret}`)
  } else {
    console.log(
      '\n  Discord requires your application\'s public key for webhook verification.\n' +
        '  Find it at: https://discord.com/developers/applications → General Information\n'
    )
    while (!secret) {
      const prompt = currentSecret
        ? `Application public key (hex) [${currentSecret.slice(0, 16)}...]: `
        : 'Application public key (hex): '
      const input = await ask(rl, prompt)
      secret = input || currentSecret || ''
    }
    console.log(
      '\n  After starting the bot, set your Interactions Endpoint URL in the\n' +
        `  Discord Developer Portal to: ${url.replace(/\/$/, '')}/webhook/discord\n`
    )
  }

  return { enabled: true, port, url: url.replace(/\/$/, ''), secret }
}

function generateSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/* ------------------------------------------------------------------ */
/*  Step 5 – Choose model                                              */
/* ------------------------------------------------------------------ */

const MODEL_PRESETS: Record<string, string> = {
  '1': 'claude-haiku-4',
  '2': 'claude-sonnet-4-5',
  '3': 'claude-opus-4-5'
}

function getModelChoiceNumber(model: string): string {
  if (model === 'claude-haiku-4') return '1'
  if (model === 'claude-sonnet-4-5') return '2'
  if (model === 'claude-opus-4-5') return '3'
  return '4'
}

async function chooseModel(rl: readline.Interface, currentModel?: string): Promise<string> {
  const defaultChoice = currentModel ? getModelChoiceNumber(currentModel) : '2'
  console.log(
    '\nWhich model would you like to use?\n' +
      '  1) Haiku\n' +
      '  2) Sonnet 4.5\n' +
      '  3) Opus 4.5\n' +
      '  4) Other (free-form entry)\n'
  )
  const choice = await ask(rl, `Enter 1–4 [${defaultChoice}]: `)
  if (choice in MODEL_PRESETS) return MODEL_PRESETS[choice]!

  const currentLabel = currentModel ? ` [${currentModel}]` : ''
  const custom = await ask(rl, `Enter model name (e.g. Minimax, GLM-4.7, Kimi)${currentLabel}: `)
  return custom || currentModel || 'claude-sonnet-4-5'
}

/* ------------------------------------------------------------------ */
/*  Step 6 – Choose workspace + create AGENTS.md                       */
/* ------------------------------------------------------------------ */

const DEFAULT_AGENTS_MD =
  '# AGENTS.md\n\n' +
  'This file configures the Claude agent for this workspace.\n\n' +
  '## Instructions\n\n' +
  '- Answer concisely and accurately.\n' +
  '- When modifying files, explain what changed.\n'

async function chooseWorkspace(rl: readline.Interface, currentWorkspace?: string): Promise<string> {
  const cwd = process.cwd()
  const defaultWorkspace = currentWorkspace || cwd
  const input = await ask(rl, `\nWorkspace path [${defaultWorkspace}]: `)
  const workspace = input || defaultWorkspace

  const resolved = path.resolve(workspace)
  fs.mkdirSync(resolved, { recursive: true })

  const agentsPath = path.join(resolved, 'AGENTS.md')
  if (!fs.existsSync(agentsPath)) {
    fs.writeFileSync(agentsPath, DEFAULT_AGENTS_MD, 'utf-8')
    console.log(`✔  Created ${agentsPath}`)
  } else {
    console.log(`ℹ  ${agentsPath} already exists – skipping.`)
  }

  return resolved
}

/* ------------------------------------------------------------------ */
/*  Main onboarding flow                                               */
/* ------------------------------------------------------------------ */

export async function runOnboarding(existingSettings?: Settings): Promise<Settings> {
  const isReconfigure = !!existingSettings
  console.log(
    isReconfigure
      ? '\n⚙️  Reconfiguring Claude Pipe\n   Press Enter to keep current values.\n'
      : "\n🚀 Welcome to Claude Pipe!\n   Let's get you set up.\n"
  )

  if (!isReconfigure) {
    await checkClaudeCli()
  }

  const rl = createInterface()
  try {
    const channel = await chooseChannel(rl, existingSettings?.channel)
    const token = await collectCredentials(rl, channel, existingSettings?.token)
    const webhook = await configureWebhook(rl, channel, existingSettings?.webhook)
    const model = await chooseModel(rl, existingSettings?.model)
    const workspace = await chooseWorkspace(rl, existingSettings?.workspace)

    const settings: Settings = {
      channel,
      token,
      allowFrom: existingSettings?.allowFrom ?? [],
      model,
      workspace,
      ...(webhook.enabled ? { webhook } : {})
    }

    writeSettings(settings)
    console.log(
      isReconfigure
        ? '\n✔  Settings updated. Run claude-pipe to start the bot.\n'
        : '\n✔  Settings saved. Run claude-pipe again to start the bot.\n'
    )
    return settings
  } finally {
    rl.close()
  }
}
