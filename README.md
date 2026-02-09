# claude-pipe

Talk to [Claude Code](https://docs.anthropic.com/en/docs/claude-code) through Telegram or Discord. Send a message, and Claude responds — with full access to read files, run commands, and work with your codebase.

Built with TypeScript. Runs locally on your machine. Inspired by [openclaw/openclaw](https://github.com/openclaw/openclaw).

## What it does

Claude Pipe connects your chat apps to the Claude Code CLI. When you send a message in Telegram or Discord, it:

1. Picks up your message
2. Passes it to Claude (with access to your workspace)
3. Sends Claude's response back to the chat

Claude remembers previous messages in the conversation, so you can have ongoing back-and-forth sessions. It can read and edit files, run shell commands, and search the web — all the things Claude Code normally does, but triggered from your chat app.

## Getting started

You'll need [Node.js](https://nodejs.org/) 20+ and the [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) installed.

**1. Clone and install**

```bash
git clone https://github.com/georgi/claude-pipe.git
cd claude-pipe
npm install
```

**2. Configure**

```bash
cp .env.example .env
```

Open `.env` and fill in the values:

- **`CLAUDEPIPE_WORKSPACE`** — the directory Claude can access (e.g. your project folder)
- **`CLAUDEPIPE_TELEGRAM_ENABLED`** / **`CLAUDEPIPE_DISCORD_ENABLED`** — turn on the channels you want
- **`CLAUDEPIPE_TELEGRAM_TOKEN`** / **`CLAUDEPIPE_DISCORD_TOKEN`** — bot tokens from [BotFather](https://t.me/botfather) or the [Discord Developer Portal](https://discord.com/developers/applications)
- **`CLAUDEPIPE_TELEGRAM_ALLOW_FROM`** / **`CLAUDEPIPE_DISCORD_ALLOW_FROM`** — restrict who can talk to the bot (leave empty to allow everyone)

See `.env.example` for all available options, including transcript logging and summary prompt templates.

**3. Run**

```bash
npm run dev
```

That's it. Send a message to your bot and Claude will reply.

## How it works

```
Telegram / Discord
       ↓
  Your message comes in
       ↓
  Claude Code CLI processes it
  (reads files, runs commands, thinks)
       ↓
  Response sent back to chat
```

Sessions are saved to a local JSON file, so conversations survive restarts. Each chat gets its own session.

Claude operates within the workspace directory you configure. File access and shell commands are restricted to that directory for safety.

## Configuration reference

All settings go in your `.env` file.

| Variable | What it does |
|---|---|
| `CLAUDEPIPE_WORKSPACE` | Root directory Claude can access |
| `CLAUDEPIPE_SESSION_STORE_PATH` | Where to save session data (default: `data/sessions.json`) |
| `CLAUDEPIPE_TELEGRAM_ENABLED` | Enable Telegram (`true`/`false`) |
| `CLAUDEPIPE_TELEGRAM_TOKEN` | Telegram bot token |
| `CLAUDEPIPE_TELEGRAM_ALLOW_FROM` | Comma-separated list of allowed Telegram user IDs |
| `CLAUDEPIPE_DISCORD_ENABLED` | Enable Discord (`true`/`false`) |
| `CLAUDEPIPE_DISCORD_TOKEN` | Discord bot token |
| `CLAUDEPIPE_DISCORD_ALLOW_FROM` | Comma-separated list of allowed Discord user IDs |
| `CLAUDEPIPE_EXEC_TIMEOUT_SEC` | Timeout for shell commands (default: 60) |
| `CLAUDEPIPE_MAX_TOOL_ITERATIONS` | Max tool calls per turn (default: 20) |
| `CLAUDEPIPE_SUMMARY_PROMPT_ENABLED` | Enable summary prompt templates |
| `CLAUDEPIPE_SUMMARY_PROMPT_TEMPLATE` | Template for summary requests (supports `{{workspace}}` and `{{request}}`) |
| `CLAUDEPIPE_TRANSCRIPT_LOG_ENABLED` | Log conversations to a file |
| `CLAUDEPIPE_TRANSCRIPT_LOG_PATH` | Path for transcript log file |
| `CLAUDEPIPE_TRANSCRIPT_LOG_MAX_BYTES` | Max transcript file size before rotation |
| `CLAUDEPIPE_TRANSCRIPT_LOG_MAX_FILES` | Number of rotated transcript files to keep |

## Development

```bash
npm run build       # compile TypeScript
npm run dev         # run in development mode
npm run test:run    # run tests
```

## Current limitations

- Text only — no images, voice messages, or file attachments yet
- Runs locally, not designed for server deployment
- No scheduled or background tasks
