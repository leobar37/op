---
name: ccs-core
description: >-
  Comprehensive knowledge base for the CCS (Claude Code Switch) monorepo.
  Covers the full stack: CLI commands, dashboard UI, web-server API,
  CLIProxy routing, target adapters, config.yaml schemas, OAuth flows,
  logging, MCP hooks, and shared data architecture. Use when working on
  any CCS codebase changes, adding features, debugging, or understanding
  the architecture. Triggers on: ccs, cliproxy, target adapter, profile
  switch, config.yaml, droid-settings, web-server, dashboard, OAuth,
  proxy routing, model catalog, logging, mcp, hooks, commands.
version: 1.1.0
---

# CCS Core Skill

Comprehensive reference for the CCS (Claude Code Switch) codebase — a
multi-provider profile and runtime manager for Claude Code, Factory Droid,
Codex CLI, and other compatible targets.

## Project Overview

**Monorepo structure:**
```
ccs/
├── src/           # TypeScript CLI/backend source (Node.js/Bun)
├── ui/            # React 19 + Vite + TailwindCSS v4 dashboard
├── lib/           # bash/PowerShell bootstrap scripts
├── dist/          # Compiled output (tsc + Vite)
├── tests/         # Test suites (unit/integration/e2e)
├── docs/          # Local documentation
└── config/        # Default configurations
```

**Key entry points:**
- `src/ccs.ts` — CLI entry point (profile detection, routing, execution)
- `src/web-server/index.ts` — Express + WebSocket dashboard server
- `src/cliproxy/executor/index.ts` — CLIProxy orchestration
- `ui/src/App.tsx` — Dashboard React router

## 1. CLI Commands

**Location:** `src/commands/`

~40 commands organized in groups:

| Group | Commands |
|-------|----------|
| **Start Here** | `setup`, `config` |
| **Profile Management** | `auth`, `api`, `cliproxy`, `env` |
| **Operations** | `doctor`, `migrate`, `cleanup`, `update`, `persist`, `tokens` |
| **Compatible Runtimes** | `copilot`, `cursor`, `docker` |

**Command routing:** `src/commands/root-command-router.ts`
**Help system:** `src/commands/help-command.ts` (MUST update for new commands)
**Catalog:** `src/commands/command-catalog.ts`

### Command structure:
```typescript
// src/commands/<name>-command.ts
export async function handle<Name>Command(
  args: string[],
  deps?: CommandDependencies
): Promise<void> {
  // Parse args, execute logic, output results
}
```

## 2. Dashboard UI

**Location:** `ui/src/`

**Stack:** React 19, Vite, TailwindCSS v4, TanStack Query, React Router v6, shadcn/ui

**Pages (routes):**
```
/                    → HomePage (overview)
/analytics           → AnalyticsPage (usage charts)
/updates             → UpdatesPage (release notes)
/providers           → ApiPage (API profiles)
/cliproxy            → CliproxyPage (proxy management)
/cliproxy/ai-providers → AI provider config
/cliproxy/control-panel → Proxy control
/provider-models     → Model catalog
/copilot             → GitHub Copilot settings
/codex               → Codex CLI settings
/droid               → Factory Droid settings
/accounts            → Claude accounts
/settings            → Global settings
/health              → System health
/logs                → Structured logs
/shared              → Shared data (commands/skills/agents)
```

**Key directories:**
- `ui/src/components/ui/` — shadcn/ui components
- `ui/src/hooks/` — React hooks (~33 hooks)
- `ui/src/pages/` — Page components
- `ui/src/lib/` — Utilities (query-client, i18n)
- `ui/src/contexts/` — React contexts (auth, privacy)

**Build:** `cd ui && bun run build` → outputs to `dist/ui/`

## 3. Web Server API

**Location:** `src/web-server/`

**Stack:** Express 4.x + WebSocket (`ws` on `/ws`) + session auth (optional)

**Route aggregation:** `src/web-server/routes/index.ts`

```
/api/profiles              → Profile CRUD
/api/accounts              → Isolated Claude accounts
/api/settings              → Profile settings
/api/config                → Unified config (config.yaml)
/api/health                → Health checks
/api/auth                  → Dashboard auth (login/logout)
/api/persist               → Backup management

/api/cliproxy              → Proxy routing, variants
/api/cliproxy/auth         → OAuth flows
/api/cliproxy/sync         → Profile sync to CLIProxy
/api/cliproxy/catalog      → Model catalog
/api/cliproxy/ai-providers → AI provider management
/api/cliproxy/openai-compat→ OpenAI-compatible endpoints
/api/provider-models       → Global model view

/api/websearch             → WebSearch MCP config
/api/browser               → Browser MCP config
/api/image-analysis        → ImageAnalysis MCP config

/api/copilot               → GitHub Copilot
/api/cursor                → Cursor IDE
/api/droid                 → Factory Droid (customModels CRUD)
/api/codex                 → Codex CLI

/api/shared                → Shared data (commands/skills/agents)
/api/overview              → System overview
/api/usage                 → Usage analytics
/api/logs                  → Structured logs
```

**Middleware:**
- `auth-middleware.ts` — Session-based auth, local access protection
- `request-logging-middleware.ts` — Request logging

## 4. Architecture Patterns

### 4.1 Target Adapter Pattern
**Location:** `src/targets/`

Abstracts execution of different CLI targets:

```typescript
interface TargetAdapter {
  readonly type: TargetType; // 'claude' | 'droid' | 'codex'
  detectBinary(): TargetBinaryInfo | null;
  prepareCredentials(creds: TargetCredentials): Promise<void>;
  buildArgs(profile: string, userArgs: string[]): string[];
  buildEnv(creds: TargetCredentials, profileType: ProfileType): NodeJS.ProcessEnv;
  exec(args: string[], env: NodeJS.ProcessEnv, options?): void;
  supportsProfileType(profileType: ProfileType): boolean;
}
```

**Implementations:**
- `ClaudeAdapter` — env vars delivery
- `DroidAdapter` — writes `~/.factory/settings.json` via `droid-settings`
- `CodexAdapter` — temporary TOML config + env vars

### 4.2 Profile Resolution (4 mechanisms)
**Location:** `src/auth/profile-detector.ts`

Priority order:
1. **CLIProxy hardcoded** — gemini, codex, agy → OAuth-based, zero config
2. **CLIProxy variants** — `config.cliproxy.variants` section
3. **Settings-based** — `config.profiles` section → GLM, Kimi, etc.
4. **Account-based** — `profiles.json` → isolated via `CLAUDE_CONFIG_DIR`

### 4.3 Configuration System
**Location:** `src/config/`

- **Source of truth:** `~/.ccs/config.yaml` (v2)
- **Loader:** `src/config/unified-config-loader.ts`
- **Schemas:** `src/config/schemas/` — modular per domain
  - `auth.ts`, `cliproxy.ts`, `providers.ts`, `thinking.ts`, `websearch.ts`, etc.
- **Migration:** `src/config/migration-manager.ts` (v1 JSON → v2 YAML)

### 4.4 Proxy Chain
**Location:** `src/cliproxy/`, `src/proxy/`

```
Claude CLI → localhost:8317 → CLIProxyAPI (Go binary)
                                ↓
                    Provider routing (/api/provider/<name>)
                                ↓
                    Optional: OpenAI-compatible proxy (CCS-owned)
```

**Proxy layers:**
- `ToolSanitizationProxy` — sanitizes tool names
- `CodexReasoningProxy` — handles reasoning params
- `HttpsTunnelProxy` — tunnel configuration
- `CLIProxyAPI` — Go binary, auto-downloaded

### 4.5 OAuth & Authentication
**Location:** `src/cliproxy/auth/`

- **Flows:** Authorization Code + Device Code
- **Handler:** `src/cliproxy/auth/oauth-handler.ts`
- **Token storage:** `~/.ccs/cliproxy/auth/<provider>/`
- **Refresh:** `src/cliproxy/auth/token-refresh-worker.ts`
- **Multi-account:** `src/cliproxy/accounts/account-manager.ts`

### 4.6 Droid Settings Library
**Location:** `src/droid-settings/` (new)

Replaces `src/targets/droid-config-manager.ts`:
- `types.ts` — Zod schemas for `DroidCustomModel`
- `paths.ts` — `~/.factory/settings.json` resolution
- `io.ts` — Atomic read/write with `proper-lockfile`
- `models.ts` — CRUD for `customModels`
- `reasoning.ts` — Provider-specific thinking/reasoning logic
- `validation.ts` — Profile name + Zod validation
- `index.ts` — `DroidSettingsStore` class + legacy aliases

## 5. Logging System

**Location:** `src/services/logging/`

Structured logging with request context via AsyncLocalStorage:

```typescript
// Usage
import { createLogger } from '../services/logging';
const logger = createLogger('module-name');

logger.info('message', { key: 'value' });
logger.stage('dispatch', 'event.name', 'description', metadata, { latencyMs: 100 });
```

**Components:**
- `logger.ts` — Main logger with stage tracking
- `log-context.ts` — AsyncLocalStorage for request context
- `log-storage.ts` — File rotation and archival
- `log-reader.ts` — Log querying and caching
- `log-redaction.ts` — Sensitive key redaction
- `log-paths.ts` — Path resolution within CCS dir

**Dashboard integration:** `src/web-server/routes/logs-routes.ts`

## 6. MCP / Hooks System

**Location:** `src/utils/websearch/`, `src/utils/image-analysis/`, `src/utils/browser/`

CCS manages MCP (Model Context Protocol) servers as first-class features:

### WebSearch MCP
- **Installer:** `src/utils/websearch/mcp-installer.ts`
- **Providers:** DuckDuckGo (default), Exa, Tavily, Brave, Searxng, Gemini, Grok, OpenCode
- **Hook injection:** `src/utils/websearch/profile-hook-injector.ts`

### ImageAnalysis MCP
- **Location:** `src/utils/image-analysis/`
- **Modes:** default, screenshot, document
- **Backend resolver:** `src/utils/image-analysis/backend-resolver.ts`

### Browser MCP
- **Location:** `src/utils/browser/`
- **Config per profile:** enabled, policy (auto/manual), eval_mode
- **Chrome reuse:** `src/utils/browser/chrome-reuse.ts`

## 7. Shared Data Architecture

**Location:** `src/management/shared-manager.ts`, `src/management/instance-manager.ts`

```
~/.ccs/shared/
├── commands/     # Symlinked to each instance
├── skills/       # Symlinked to each instance
├── agents/       # Symlinked to each instance
├── plugins/      # Shared plugins
└── settings.json # Shared config

~/.ccs/instances/<profile>/
├── session-env/     # Isolated
├── todos/           # Isolated
├── logs/            # Isolated
└── file-history/    # Isolated
```

**Dashboard:** `/api/shared` routes, `/shared` page

## 8. File Structure Reference

### Backend (`src/`)
```
src/
├── ccs.ts                    # CLI entry point (orquestador principal)
├── api/                      # Business services (profile CRUD, presets)
├── auth/                     # Account/profile management
│   ├── commands/             # Auth subcommands (create, remove, list)
│   ├── profile-detector.ts   # Resolucion de perfiles (4 mecanismos)
│   └── profile-registry.ts   # Registro de perfiles
├── bin/                      # Runtime entry points (droid-runtime, codex-runtime)
├── channels/                 # Official Claude channels (Telegram, Discord, iMessage)
├── cliproxy/                 # CLIProxy system (core del routing)
│   ├── ai-providers/         # API key management para CLIProxy
│   ├── auth/                 # OAuth flows (oauth-handler, token-refresh)
│   ├── accounts/             # Multi-cuenta por proveedor
│   ├── config/               # Generacion de config CLIProxy
│   ├── executor/             # Orquestador de ejecucion
│   ├── proxy/                # Capas de proxy (sanitization, tunnel)
│   ├── quota/                # Quota management
│   └── sync/                 # Sync perfiles a CLIProxy
├── commands/                 # CLI commands (~40 comandos)
│   ├── root-command-router.ts    # Router principal
│   ├── help-command.ts           # Sistema de ayuda
│   └── command-catalog.ts        # Catalogo de comandos
├── config/                   # Sistema de configuracion unificada
│   ├── schemas/              # Schemas modulares por dominio
│   ├── unified-config-loader.ts  # Carga config.yaml
│   └── migration-manager.ts      # Migracion v1→v2
├── copilot/                  # Integracion GitHub Copilot
├── cursor/                   # Integracion Cursor IDE
├── delegation/               # Ejecucion headless (ccs <profile> -p "task")
├── docker/                   # Helpers Docker
├── droid-settings/           # Libreria de config Droid (NEW)
│   ├── types.ts              # Zod schemas
│   ├── io.ts                 # Read/write atomico
│   ├── models.ts             # CRUD customModels
│   └── index.ts              # DroidSettingsStore
├── errors/                   # Manejo centralizado de errores
├── glmt/                     # Legacy GLMT transformer
├── management/               # InstanceManager, SharedManager
├── proxy/                    # Proxy OpenAI-compatible local
│   ├── server/               # Servidor proxy
│   └── transformers/         # Transformaciones request/response
├── services/                 # Logging estructurado
│   └── logging/              # AsyncLocalStorage, redaction, storage
├── shared/                   # Codigo compartido CLI/UI
├── targets/                  # Target adapters (Claude, Droid, Codex)
│   ├── target-adapter.ts     # Interfaz base
│   ├── target-registry.ts    # Registro de adapters
│   ├── claude-adapter.ts     # Adapter para Claude CLI
│   ├── droid-adapter.ts      # Adapter para Factory Droid
│   └── codex-adapter.ts      # Adapter para Codex CLI
├── types/                    # Definiciones de tipos globales
├── utils/                    # Utilidades (~45 modulos)
│   ├── config-manager.ts     # getCcsDir() - CRITICAL para test isolation
│   ├── websearch/            # WebSearch MCP
│   ├── image-analysis/       # ImageAnalysis MCP
│   ├── browser/              # Browser MCP
│   └── hooks/                # Hook system
└── web-server/               # Dashboard API
    ├── index.ts              # Express + WebSocket server
    ├── routes/               # REST routes (~25 routers)
    ├── services/             # Servicios de rutas
    ├── usage/                # Analytics aggregation
    ├── middleware/           # Auth, logging
    └── websocket.ts          # WebSocket broadcasting
```

### Dashboard (`ui/`)
```
ui/
├── src/
│   ├── App.tsx               # React Router principal
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── layout/           # Layout, ThemeProvider
│   │   └── auth/             # RequireAuth
│   ├── pages/                # Paginas del dashboard
│   │   ├── index.tsx         # HomePage
│   │   ├── droid.tsx         # Droid settings
│   │   ├── cliproxy.tsx      # CLIProxy management
│   │   ├── analytics.tsx     # Usage charts
│   │   └── ...
│   ├── hooks/                # React hooks (~33)
│   ├── contexts/             # AuthContext, PrivacyContext
│   ├── lib/                  # query-client, i18n
│   └── providers/            # Context providers
├── package.json
└── vite.config.ts
```

## Critical Constraints (from CLAUDE.md)

1. **Test isolation** — NEVER touch real `~/.ccs/` or `~/.claude/` in tests. Use `getCcsDir()` which respects `CCS_HOME` env var.
2. **NO emojis in CLI output** — Use ASCII: `[OK]`, `[!]`, `[X]`, `[i]`
3. **TTY-aware colors** — Respect `NO_COLOR`
4. **Non-invasive** — NEVER modify external tool settings without explicit user request
5. **Cross-platform parity** — bash/PowerShell/Node.js identical behavior
6. **CLI documentation** — ALL CLI changes MUST update `--help` handlers
7. **Dashboard parity** — Config features work in both CLI and Dashboard

## Quality Gates

```bash
# Pre-commit sequence:
bun run format              # Step 1
bun run lint:fix            # Step 2
bun run validate            # Step 3: typecheck + lint + format:check + test:fast
bun run validate:ci-parity  # Step 4: + build + test:all + test:e2e
```

## Testing Strategy

- **Fast:** `bun run test:fast` — unit tests, parallel
- **Slow:** `bun run test:slow` — process spawning, port binding
- **E2E:** `bun run test:e2e` — end-to-end
- **Framework:** Bun test (native)

## Adding New Features

### New CLI command:
1. Create handler in `src/commands/<name>-command.ts`
2. Add route in `src/commands/root-command-router.ts`
3. Update `src/commands/help-command.ts`
4. Add tests in `tests/unit/commands/`

### New provider:
1. Add to `CLIPROXY_PROVIDER_IDS` in `provider-capabilities.ts`
2. Define `ProviderCapabilities` (OAuth flow, callback port, etc.)
3. Add models to `MODEL_CATALOG`
4. Create route in `web-server/routes/` if dashboard needed

### New target adapter:
1. Implement `TargetAdapter` in `src/targets/`
2. Register in `target-registry.ts`
3. Add metadata in `target-metadata.ts`

## References

- `references/architecture.md` — Detailed architecture diagrams
- `references/workflows.md` — Common development workflows
- `references/testing.md` — Testing patterns and examples
