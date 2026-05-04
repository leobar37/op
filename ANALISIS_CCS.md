# Analisis Profundo: CCS (Claude Code Switch)

> Fecha: 2026-05-03
> Proyecto: @kaitranntt/ccs v7.76.0
> Repositorio: /Users/leobar37/code/opensource/ccs

---

## 1. Arquitectura General del Proyecto

### 1.1 Tipo de Proyecto
CCS es un **monorepo hibrido** compuesto por:
- **Backend CLI** (Node.js/Bun, TypeScript) - Motor principal
- **Dashboard UI** (React 19 + Vite + TailwindCSS v4) - Interfaz web
- **Scripts nativos** (bash/PowerShell) - Bootstrap multiplataforma
- **Configuracion declarativa** (YAML/JSON) - Fuente unica de verdad

### 1.2 Estructura de Carpetas

```
ccs/
|-- src/                    # Codigo fuente TypeScript principal
|   |-- ccs.ts              # Entry point CLI (1776 lineas, orquestador)
|   |-- api/                # Servicios de negocio (profile CRUD, presets)
|   |-- auth/               # Gestion de cuentas y perfiles (profile-registry, commands)
|   |-- bin/                # Entry points para binarios (droid-runtime, codex-runtime)
|   |-- channels/           # Canales oficiales Claude (Telegram, Discord, iMessage)
|   |-- cliproxy/           # Sistema proxy CLIProxyAPI (core del routing)
|   |-- commands/           # Handlers de comandos CLI (~40 comandos)
|   |-- config/             # Sistema de configuracion unificada (YAML schemas)
|   |-- copilot/            # Integracion GitHub Copilot
|   |-- cursor/             # Integracion Cursor IDE
|   |-- delegation/         # Ejecucion headless y gestion de sesiones
|   |-- docker/             # Helpers para deployment Docker
|   |-- droid-settings/     # Adaptador para Factory Droid CLI
|   |-- errors/             # Manejo centralizado de errores
|   |-- glmt/               # Legacy GLMT transformer (compatibilidad)
|   |-- management/         # InstanceManager, SharedManager (cuentas aisladas)
|   |-- proxy/              # Proxy OpenAI-compatible local + daemon
|   |-- services/           # Logging estructurado con request context
|   |-- shared/             # Codigo compartido CLI/UI (presets, routing hints)
|   |-- targets/            # Adaptadores para CLIs destino (Claude, Droid, Codex)
|   |-- types/              # Definiciones de tipos globales
|   |-- utils/              # Utilidades (~45 modulos)
|   |-- web-server/         # Servidor Express + WebSocket (dashboard API)
|
|-- ui/                     # Dashboard React (SPA independiente)
|   |-- src/
|   |   |-- components/     # Componentes UI (shadcn/ui + custom)
|   |   |-- hooks/          # React hooks (~33 hooks)
|   |   |-- lib/            # Utilidades frontend
|   |   |-- pages/          # Paginas/rutas del dashboard
|   |   |-- providers/      # Context providers (React Query, etc.)
|   |   |-- App.tsx         # Router principal
|
|-- lib/                    # Scripts shell nativos (bootstrap)
|   |-- ccs                 # Script bash (npx @kaitranntt/ccs)
|   |-- ccs.ps1             # Script PowerShell
|
|-- tests/                  # Suite de tests
|   |-- unit/               # Tests unitarios (Bun test, ~43 suites)
|   |-- integration/        # Tests de integracion
|   |-- e2e/                # Tests end-to-end
|   |-- npm/                # Tests del paquete npm
|   |-- native/             # Tests de instalacion nativa
|
|-- docs/                   # Documentacion local
|-- config/                 # Configuraciones por defecto
|-- scripts/                # Scripts de build y release
|-- dist/                   # Output compilado (tsc + vite)
```

---

## 2. Patrones de Diseno Utilizados

### 2.1 Adapter Pattern (Target Adapter System)
**Ubicacion:** `src/targets/`

Abstrae la ejecucion de diferentes CLIs objetivo mediante una interfaz comun:

```typescript
interface TargetAdapter {
  readonly type: TargetType;        // 'claude' | 'droid' | 'codex'
  detectBinary(): TargetBinaryInfo | null;
  prepareCredentials(creds: TargetCredentials): Promise<void>;
  buildArgs(profile: string, userArgs: string[]): string[];
  buildEnv(creds: TargetCredentials, profileType: ProfileType): NodeJS.ProcessEnv;
  exec(args: string[], env: NodeJS.ProcessEnv, options?): void;
  supportsProfileType(profileType: ProfileType): boolean;
}
```

**Implementaciones:**
- `ClaudeAdapter` - Entrega credenciales via env vars
- `DroidAdapter` - Escribe a `~/.factory/settings.json`
- `CodexAdapter` - Genera config TOML temporal + env vars

### 2.2 Facade Pattern
**Ubicaciones:**
- `src/cliproxy/index.ts` - Facade del modulo CLIProxy
- `src/cliproxy/auth/auth-handler.ts` - Facade OAuth
- `src/config/index.ts` - Facade de configuracion
- `src/auth/auth-commands.ts` - Facade de comandos auth

### 2.3 Strategy Pattern
**Ubicacion:** `src/cliproxy/config/`, `src/proxy/request-router.ts`

- Routing strategy: `round-robin` vs `fill-first` para seleccion de cuentas
- Proxy routing scenarios: `default`, `background`, `think`, `longContext`, `webSearch`
- Backend selection: `original` vs `plus` para CLIProxyAPI

### 2.4 Dependency Injection (Manual)
**Ubicacion:** `src/commands/config-command.ts`, `src/cliproxy/service-manager.ts`

Los comandos aceptan objetos `deps` inyectables para testing:
```typescript
export async function handleConfigCommand(
  args: string[],
  deps: ConfigCommandDependencies = defaultConfigCommandDependencies
): Promise<void>
```

### 2.5 Layered Architecture
```
CLI Layer (commands/)
    |
Business Logic Layer (api/services/, cliproxy/, auth/)
    |
Configuration Layer (config/, utils/config-manager.ts)
    |
Infrastructure Layer (utils/, web-server/, proxy/)
```

### 2.6 Registry Pattern
**Ubicacion:** `src/targets/target-registry.ts`, `src/commands/root-command-router.ts`

Registro dinamico de comandos y adaptadores:
```typescript
export const ROOT_COMMAND_ROUTES: readonly NamedCommandRoute[] = [
  { name: 'migrate', aliases: ['--migrate'], handle: async (args) => { ... } },
  { name: 'config', handle: async (args) => { ... } },
  // ... ~20 comandos
];
```

### 2.7 Observer Pattern
**Ubicacion:** `src/web-server/websocket.ts`, `src/cliproxy/auth/device-code-handler.ts`

WebSocket broadcasting para actualizaciones en tiempo real del dashboard.

### 2.8 Factory Pattern
**Ubicacion:** `src/config/schemas/unified-config.ts`

```typescript
export function createEmptyUnifiedConfig(): UnifiedConfig { ... }
```

---

## 3. Flujos de Datos Principales

### 3.1 Flujo de Ejecucion de Perfil (Principal)

```
Usuario ejecuta: ccs <perfil> [args...]
         |
         v
+--------------------------------------------------+
|  src/ccs.ts: main()                               |
|  - detectProfile() -> {profile, remainingArgs}   |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  src/auth/profile-detector.ts                     |
|  Resuelve tipo de perfil (4 mecanismos):         |
|  1. CLIProxy hardcoded (gemini, codex, agy)      |
|  2. CLIProxy variants (config.cliproxy.variants) |
|  3. Settings-based (glm, km) - config.profiles   |
|  4. Account-based (profiles.json) - isolated     |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  src/targets/target-resolver.ts                   |
|  - resolveTargetType(args) -> 'claude'|'droid'|'codex'|
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  TargetAdapter.prepareCredentials()               |
|  - Claude: no-op (env vars)                      |
|  - Droid: escribe ~/.factory/settings.json       |
|  - Codex: genera config TOML temporal            |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  src/cliproxy/executor/index.ts                   |
|  - execClaudeWithCLIProxy()                       |
|  - O: inicia proxy si es necesario               |
|  - Construye env vars (ANTHROPIC_BASE_URL, etc)  |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  TargetAdapter.exec()                             |
|  - spawn() del CLI objetivo                      |
|  - wireChildProcessSignals()                     |
|  - stdio: 'inherit' (pasa TTY al hijo)           |
+--------------------------------------------------+
```

### 3.2 Flujo del Proxy (CLIProxy)

```
Claude CLI -> HTTP localhost:8317 (o puerto variant)
         |
         v
+--------------------------------------------------+
|  CLIProxyAPI Binary (Go, auto-descargado)        |
|  - Recibe requests Anthropic API format          |
|  - Transforma a formato del proveedor            |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  Provider-specific routing:                      |
|  - /api/provider/gemini -> Google Gemini         |
|  - /api/provider/codex -> OpenAI Codex           |
|  - /api/provider/agy -> Antigravity              |
|  - /v1/messages -> root-routed (composite)       |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  OpenAI-Compatible Proxy (CCS-owned, opcional)   |
|  - Transforma Anthropic -> OpenAI format         |
|  - Soporta routing por scenario                  |
+--------------------------------------------------+
```

### 3.3 Flujo de Autenticacion OAuth

```
Usuario: ccs cliproxy auth <provider>
         |
         v
+--------------------------------------------------+
|  src/cliproxy/auth/oauth-handler.ts               |
|  - Detecta entorno headless                      |
|  - Selecciona flow: auth_code | device_code      |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  Spawnea CLIProxy binary con flag --auth          |
|  - Abre navegador (o muestra URL)                |
|  - Espera callback en puerto local               |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  Token almacenado en:                             |
|  ~/.ccs/cliproxy/auth/<provider>/*.json          |
|  - Registrado en accounts.json                   |
+--------------------------------------------------+
```

### 3.4 Flujo del Dashboard Web

```
Usuario: ccs config
         |
         v
+--------------------------------------------------+
|  src/commands/config-command.ts                   |
|  - ensureCliproxyService() (fondo)               |
|  - startServer({port, dev?})                     |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  src/web-server/index.ts (Express + WS)          |
|  - REST API en /api/*                            |
|  - WebSocket en /ws                              |
|  - Static files (dist/ui/) o Vite HMR (dev)      |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  React SPA (ui/src/App.tsx)                       |
|  - React Router v7                               |
|  - TanStack Query para data fetching             |
|  - Recharts/Nivo para analytics                  |
+--------------------------------------------------+
```

---

## 4. Sistema de Plugins/Skills/Agents

### 4.1 MCP (Model Context Protocol) Servers
CCS gestiona **MCP servers** como primera clase para proveer herramientas a perfiles de terceros:

**WebSearch MCP:**
- `src/utils/websearch/mcp-installer.ts` - Instala `ccs-websearch` en `~/.claude.json`
- Proveedores: DuckDuckGo (default), Exa, Tavily, Brave, Searxng, Gemini, Grok, OpenCode
- `src/utils/websearch/claude-tool-args.ts` - Inyecta `--websearch` en lanzamientos Claude

**ImageAnalysis MCP:**
- `src/utils/image-analysis/` - Vision via CLIProxy para perfiles de terceros
- Modos: `default`, `screenshot`, `document`
- Rutea directamente a `/api/provider/<backend>/v1/messages`

**Browser MCP:**
- `src/utils/browser/` - Automatizacion de navegador
- Configurable por perfil: `enabled`, `policy` (auto/manual), `eval_mode`

### 4.2 Shared Data Architecture
**Ubicacion:** `src/management/shared-manager.ts`, `src/management/instance-manager.ts`

```
~/.ccs/shared/
|-- commands/     # Symlinked a cada instancia
|-- skills/       # Symlinked a cada instancia
|-- agents/       # Symlinked a cada instancia
|-- settings.json # Config compartida

~/.ccs/instances/<profile>/
|-- session-env/     # Aislado
|-- todos/           # Aislado
|-- logs/            # Aislado
|-- file-history/    # Aislado
```

### 4.3 Hooks System
**Ubicacion:** `src/utils/hooks/`

- `image-analyzer-profile-hook-injector.ts` - Inyecta hooks de analisis por perfil
- `image-analysis-backend-resolver.ts` - Resuelve backend para image analysis
- Hooks son scripts que Claude ejecuta en ciertos eventos

### 4.4 Delegation / Headless Execution
**Ubicacion:** `src/delegation/`

```typescript
class HeadlessExecutor {
  static execute(profile, prompt, options): Promise<ExecutionResult>
}
```

Permite ejecucion no-interactiva: `ccs <perfil> -p "tarea"`

---

## 5. Web Server y API REST

### 5.1 Stack Tecnico
- **Servidor:** Express.js 4.x + http.createServer
- **WebSocket:** ws (WebSocketServer) en path `/ws`
- **Auth:** express-session + bcrypt (opcional, desactivado por defecto)
- **Rate Limiting:** express-rate-limit (login: 5 intentos/15min)
- **Body Parsing:** express.json() con error handler para JSON malformado

### 5.2 Estructura de Rutas
**Ubicacion:** `src/web-server/routes/index.ts`

```
/api/profiles          -> CRUD de perfiles API
/api/accounts          -> Cuentas aisladas Claude
/api/settings          -> Settings de perfiles
/api/config            -> Configuracion unificada
/api/health            -> Health checks
/api/auth              -> Dashboard auth (login/logout)
/api/persist           -> Backup management
/api/cliproxy          -> Variantes, auth, stats, sync
/api/cliproxy/auth     -> OAuth flows
/api/cliproxy/sync     -> Sync perfiles a CLIProxy
/api/cliproxy/catalog  -> Catalogo de modelos
/api/cliproxy/ai-providers -> AI providers management
/api/provider-models   -> Modelos globales CLIProxy
/api/websearch         -> Configuracion WebSearch
/api/browser           -> Configuracion Browser
/api/image-analysis    -> Configuracion ImageAnalysis
/api/copilot           -> GitHub Copilot
/api/cursor            -> Cursor IDE
/api/droid             -> Factory Droid
/api/codex             -> Codex CLI
/api/shared            -> Datos compartidos (commands/skills/agents)
/api/overview          -> Resumen del sistema
/api/usage             -> Analytics de uso
/api/logs              -> Logs estructurados
```

### 5.3 Middleware
- `auth-middleware.ts` - Session-based auth, proteccion de rutas API
- `request-logging-middleware.ts` - Logging de requests
- Rate limiter integrado en login

### 5.4 WebSocket
**Ubicacion:** `src/web-server/websocket.ts`

- Broadcasting de eventos en tiempo real
- File watcher para auto-refresh de config
- Max payload: 1MB (proteccion DoS)

---

## 6. Sistema de Configuracion

### 6.1 Fuente Unica de Verdad: `config.yaml`
**Ubicacion:** `~/.ccs/config.yaml`

```yaml
version: 2
setup_completed: true
default: work

accounts:
  work:
    created: "2024-01-15T10:00:00Z"
    last_used: "2024-01-20T14:30:00Z"
    context_mode: shared
    context_group: team-alpha

profiles:
  glm:
    type: api
    settings: ~/.ccs/glm.settings.json
    target: claude
  hf:
    type: api
    settings: ~/.ccs/hf.settings.json
    target: droid

cliproxy:
  backend: original
  oauth_accounts:
    gemini-primary: user@gmail.com
  providers: [gemini, codex, agy, qwen, kiro, ghcp, claude, kimi, cursor, gitlab]
  variants:
    gemini-work:
      provider: gemini
      account: gemini-primary
      port: 8319
  safety:
    antigravity_ack_bypass: false
  routing:
    strategy: round-robin
    session_affinity: true
    session_affinity_ttl: 1h

proxy:
  port: 8320
  routing:
    default: glm
    think: anthropic
    longContext: glm
    webSearch: gemini

websearch:
  enabled: true
  providers:
    duckduckgo: { enabled: true, max_results: 5 }
    exa: { enabled: false }

global_env:
  enabled: true
  env:
    CCS_WEBSEARCH_ENABLED: "true"

thinking:
  mode: auto
  tiers:
    opus: { default: high, max: xhigh }
    sonnet: { default: medium, max: high }
    haiku: { default: low, max: medium }

browser:
  claude: { enabled: true, policy: auto, eval_mode: readonly }
  codex: { enabled: false, policy: manual }

image_analysis:
  enabled: true
  provider: auto
```

### 6.2 Schemas Modulares
**Ubicacion:** `src/config/schemas/`

Cada dominio tiene su propio schema:
- `auth.ts` - AccountConfig, ProfileConfig, DashboardAuthConfig
- `cliproxy.ts` - CLIProxyConfig, VariantConfig, CompositeVariantConfig
- `providers.ts` - CopilotConfig, CursorConfig, OpenAICompatProxyConfig
- `quota.ts` - QuotaManagementConfig
- `thinking.ts` - ThinkingConfig
- `channels.ts` - OfficialChannelsConfig
- `websearch.ts` - WebSearchConfig
- `browser.ts` - BrowserConfig
- `logging.ts` - LoggingConfig

### 6.3 Loader Unificado
**Ubicacion:** `src/config/unified-config-loader.ts` (1509 lineas)

- Carga `config.yaml` con fallback a `config.json` legacy
- File locking con `proper-lockfile` (5s stale timeout)
- Normalizacion de valores (paths, puertos, duraciones Go-style)
- Cache invalidation

### 6.4 Migration Manager
**Ubicacion:** `src/config/migration-manager.ts`

- Migra v1 (JSON) -> v2 (YAML) automaticamente
- Backup atomico antes de migrar
- Rollback support

---

## 7. Integraciones con Proveedores

### 7.1 Taxonomia de Proveedores

| Tipo | Proveedores | Mecanismo | Config |
|------|-------------|-----------|--------|
| **CLIProxy OAuth** | gemini, codex, agy, qwen, kiro, ghcp, claude, kimi, cursor, gitlab, iflow | OAuth 2.0 / Device Code | Zero config |
| **API Profiles** | glm, km, anthropic, hf, ollama, llamacpp, novita, foundry, mm, deepseek, qwen-api | API Key + Base URL | `*.settings.json` |
| **OpenAI-Compatible** | OpenRouter, Together, custom | API Key + Base URL | `config.yaml: proxy` |
| **Copilot** | GitHub Copilot | OAuth | `config.yaml: copilot` |
| **Cursor** | Cursor IDE | Browser auth | `config.yaml: cursor` |

### 7.2 Model Catalog
**Ubicacion:** `src/cliproxy/model-catalog.ts`

Catalogo interactivo de modelos por proveedor CLIProxy:
- `agy`: Claude Opus 4.6, Sonnet 4.6, Gemini Pro, Flash
- `gemini`: gemini-2.5-pro, gemini-2.5-flash
- `codex`: gpt-5-codex, gpt-5-codex-mini
- `claude`: claude-opus-4, claude-sonnet-4
- `kimi`: kimi-k2, kimi-k2.5

Cada modelo define:
- `thinking`: tipo (budget/levels/none), min/max, niveles permitidos
- `extendedContext`: soporte para ventana 1M
- `nativeImageInput`: vision nativa

### 7.3 Provider Capabilities
**Ubicacion:** `src/cliproxy/provider-capabilities.ts`

Define capacidades por proveedor:
- OAuth flow type (`authorization_code` | `device_code`)
- Callback port
- Token refresh ownership (`ccs` | `cliproxy` | `unsupported`)
- Auth file prefixes
- Aliases

### 7.4 AI Provider Families
**Ubicacion:** `src/cliproxy/ai-providers/`

Gestion de entradas API-key para CLIProxy:
- `gemini-api-key`, `codex-api-key`, `claude-api-key`, `vertex-api-key`
- `openai-compatibility` (conectores nombrados)

### 7.5 OpenAI-Compatible Proxy
**Ubicacion:** `src/proxy/`

Proxy local que transforma Anthropic API -> OpenAI API:
- `request-transformer.ts` - Convierte formato de request
- `sse-stream-transformer.ts` - Transforma SSE streaming
- `proxy-daemon.ts` - Daemon que mantiene el proxy corriendo
- Routing por scenario: default, think, longContext, webSearch, background

---

## 8. Sistema de Autenticacion y OAuth

### 8.1 Arquitectura OAuth

```
+--------------------------------------------------+
|  CCS CLI / Dashboard                              |
|  - triggerOAuth(provider, options)               |
+--------------------------------------------------+
         |
         v
+--------------------------------------------------+
|  OAuth Handler (src/cliproxy/auth/)              |
|  - Detecta headless (SSH, no DISPLAY)            |
|  - Selecciona flow segun provider capabilities   |
+--------------------------------------------------+
         |
    +----+----+
    |         |
    v         v
+--------+  +--------------------------------------+
| Auth   |  | Device Code                          |
| Code   |  | (ghcp, qwen, kiro-aws, kimi)        |
| Flow   |  | - Muestra user_code + URL            |
|        |  | - Polls CLIProxyAPI por token        |
+--------+  +--------------------------------------+
    |
    v
+--------------------------------------+
| Spawnea CLIProxy con --auth flag    |
| - Abre navegador (o muestra URL)    |
| - Callback server en puerto local   |
+--------------------------------------+
    |
    v
+--------------------------------------+
| Token recibido y almacenado         |
| ~/.ccs/cliproxy/auth/<provider>/    |
+--------------------------------------+
```

### 8.2 Multi-Cuenta por Proveedor
**Ubicacion:** `src/cliproxy/accounts/`

- Cada proveedor puede tener multiples cuentas
- Una cuenta designada como `default`
- Cuentas pueden pausarse/resumirse
- Nickname-to-email mapping en `config.yaml`

### 8.3 Token Refresh
**Ubicacion:** `src/cliproxy/auth/token-refresh-worker.ts`

- Worker en background que refresca tokens antes de expirar
- Configurable: intervalo, tiempo preemptivo, max retries
- Ownership: algunos proveedores delegan a CLIProxy, otros a CCS

### 8.4 Dashboard Auth
**Ubicacion:** `src/web-server/middleware/auth-middleware.ts`

- Opcional, desactivado por defecto
- Session-based con express-session
- Password hasheado con bcrypt
- Rate limiting en login

---

## 9. Testing Strategy

### 9.1 Organizacion de Tests

```
tests/
|-- unit/              # ~43 suites, tests rapidos (<1.5s cada uno)
|   |-- commands/      # Tests de comandos CLI
|   |-- cliproxy/      # Tests del proxy
|   |-- web-server/    # Tests de rutas API
|   |-- targets/       # Tests de adaptadores
|   |-- utils/         # Tests de utilidades
|   |-- config/        # Tests de configuracion
|   |-- hooks/         # Tests de hooks MCP
|   |-- auth/          # Tests de autenticacion
|   |-- proxy/         # Tests de proxy OpenAI
|   |-- glmt/          # Tests legacy transformer
|
|-- integration/       # Tests de integracion
|   |-- cursor-daemon-lifecycle.test.ts
|   |-- image-analyzer-hook.test.ts
|   |-- proxy/         # Tests del daemon proxy
|   |-- *.sh           # Shell scripts de smoke test
|
|-- e2e/               # End-to-end
|   |-- image-analyzer-hook.e2e.test.ts
|   |-- openai-provider-routing.e2e.test.ts
|   |-- proxy-command.e2e.test.ts
|
|-- npm/               # Tests del paquete npm
|-- native/            # Tests de instalacion nativa (bash/ps1)
```

### 9.2 Test Buckets
**Ubicacion:** `scripts/run-test-bucket.js`

- `test:fast` - Tests unitarios rapidos (paralelos)
- `test:slow` - Tests que spawnean procesos, bindan puertos, o leen `dist/` (secuenciales)
- `test:all` - Todos los tests
- `test:e2e` - Tests end-to-end

Criterios para "slow":
1. Spawnea child process
2. Binda puerto o habla con localhost
3. Lee `dist/` en runtime
4. Espera timers > 500ms
5. Consistentemente > 1500ms

### 9.3 Framework
- **Runtime:** Bun test (nativo)
- **UI:** Vitest (para el proyecto UI)
- **Assert:** Built-in Bun assertions
- **Mocking:** `bun:test` mock functions
- **Coverage:** @vitest/coverage-v8

### 9.4 CI Pipeline
**Ubicacion:** `.github/workflows/ci.yml`

```
PR -> main/dev
  |
  +-- validate (matrix paralela)
  |     +-- typecheck
  |     +-- lint
  |     +-- format:check
  |
  +-- build
  |     +-- bun run build:all
  |     +-- Upload dist artifact
  |
  +-- test (depends: build)
  |     +-- bun run test:all
  |     +-- bun run test:e2e
```

Self-hosted runners (linux, x64).

---

## 10. Build System y Deployment

### 10.1 Build Pipeline

```
+--------------------------------------------------+
|  bun run build:all                                |
+--------------------------------------------------+
         |
    +----+----+
    |         |
    v         v
+--------+  +--------------------------------------+
| UI     |  | Backend                              |
| Build  |  |                                      |
|        |  | 1. tsc (src/ -> dist/)              |
| cd ui  |  | 2. add-shebang.js                   |
| tsc -b |  | 3. verify-bundle.js                 |
| vite   |  |                                      |
| build  |  | Output: dist/ccs.js                 |
|        |  |         dist/bin/*.js               |
+--------+  +--------------------------------------+
         |
         v
+--------------------------------------------------+
|  dist/ui/ (static files from Vite)               |
|  Served by Express in production                 |
+--------------------------------------------------+
```

### 10.2 Scripts de Build

| Script | Descripcion |
|--------|-------------|
| `build` | `tsc && node scripts/add-shebang.js` |
| `build:watch` | `tsc --watch` |
| `build:server` | Igual que build |
| `build:all` | `ui:build && build:server` |
| `prebuild:all` | Limpia `dist/` y `tsconfig.tsbuildinfo` |
| `postbuild:all` | `verify-bundle.js` (chequea tamano < 1.5MB gzipped) |

### 10.3 Release Automation
**Ubicacion:** `.releaserc.cjs`

- **semantic-release** completamente automatizado
- **main** -> `@latest` en npm
- **dev** -> `@dev` prerelease
- Conventional commits determinan version bump
- Assets: `CHANGELOG.md`, `package.json`

### 10.4 Bootstrap Scripts

**bash:** `lib/ccs`
```bash
#!/usr/bin/env bash
set -euo pipefail
exec npx "@kaitranntt/ccs" "$@"
```

**PowerShell:** `lib/ccs.ps1`
```powershell
& npx $PACKAGE @RemainingArgs
```

### 10.5 Docker
**Ubicacion:** `docker/`

- Multi-stage Dockerfile (bun 1.2.21 + node:20-bookworm-slim)
- Docker Compose con healthcheck
- Volumes persistentes para config y credenciales
- Puertos: 3000 (dashboard), 8317 (CLIProxy)

### 10.6 Quality Gates

```bash
# Secuencia obligatoria pre-commit:
bun run format              # Paso 1: Fix formatting
bun run lint:fix            # Paso 2: Fix lint
bun run validate            # Paso 3: typecheck + lint + format:check + test:fast
bun run validate:ci-parity  # Paso 4: branch check + build + test:all + e2e
```

Husky hooks:
- `pre-commit`: lint/type/format rapidos
- `pre-push`: `validate:ci-parity` en main/dev/hotfix

---

## 11. Observaciones Arquitectonicas Clave

### 11.1 Fortalezas
1. **Adapter pattern bien implementado** - Facil agregar nuevos targets CLI
2. **Configuracion unificada** - Un solo `config.yaml` gobierna todo
3. **Proxy layering** - CLIProxy + OpenAI-compat proxy + sanitization proxies
4. **Testing bucketed** - Separacion inteligente fast/slow para CI eficiente
5. **Cross-platform parity** - bash/PowerShell/Node.js comportamiento identico
6. **Logging estructurado** - Request context con AsyncLocalStorage
7. **Session isolation** - Cuentas Claude realmente aisladas via `CLAUDE_CONFIG_DIR`

### 11.2 Complejidades
1. **ccs.ts es monolitico** (1776 lineas) - Contiene logica de parsing, routing y ejecucion
2. **Multi-format config** - YAML + JSON + settings.json + profiles.json coexisten
3. **Proxy chain compleja** - ToolSanitization -> CodexReasoning -> HTTPS Tunnel -> CLIProxy
4. **OAuth flows diversos** - 10+ proveedores con comportamientos diferentes
5. **State management distribuido** - Tokens en filesystem, config en YAML, accounts en JSON

### 11.3 Flujo de Datos Critico

```
Usuario -> ccs.ts -> ProfileDetector -> TargetResolver -> TargetAdapter
                                              |
                                              v
                                       [Si es CLIProxy]
                                              |
                                              v
                              CLIProxy Executor -> BinaryManager
                                      |              |
                                      v              v
                              ServiceManager    ConfigGenerator
                                      |              |
                                      v              v
                              spawnProxy()    generateConfig()
                                      |
                                      v
                              Session Bridge -> Claude CLI
```

### 11.4 Extension Points

Para agregar un nuevo proveedor:
1. Agregar a `CLIPROXY_PROVIDER_IDS` en `provider-capabilities.ts`
2. Definir `ProviderCapabilities` (OAuth flow, callback port, etc.)
3. Agregar modelos al `MODEL_CATALOG`
4. Crear ruta en `web-server/routes/` (si necesita dashboard)
5. Actualizar `--help` en `help-command.ts`

Para agregar un nuevo target CLI:
1. Implementar `TargetAdapter` en `src/targets/`
2. Registrar en `target-registry.ts`
3. Agregar metadatos en `target-metadata.ts`

---

## 12. Resumen de Archivos Clave

| Archivo | Lineas | Rol |
|---------|--------|-----|
| `src/ccs.ts` | 1776 | Entry point CLI, orquestador principal |
| `src/config/unified-config-loader.ts` | 1509 | Carga y validacion de config.yaml |
| `src/cliproxy/executor/index.ts` | 1429 | Orquestador de ejecucion CLIProxy |
| `src/web-server/routes/index.ts` | 471 | Aggregator de rutas REST |
| `src/cliproxy/provider-capabilities.ts` | 326 | Capacidades por proveedor |
| `src/cliproxy/model-catalog.ts` | 573 | Catalogo de modelos |
| `src/auth/profile-detector.ts` | 619 | Deteccion de tipo de perfil |
| `src/proxy/proxy-daemon.ts` | 741 | Daemon del proxy OpenAI-compatible |
| `src/cliproxy/auth/oauth-handler.ts` | 1120 | Manejador de flujos OAuth |
| `src/cliproxy/accounts/account-manager.ts` | ~500 | Gestion multi-cuenta |
| `src/management/instance-manager.ts` | 291 | Aislamiento de instancias Claude |
| `src/targets/target-adapter.ts` | ~100 | Interfaz del Adapter pattern |
| `src/commands/root-command-router.ts` | ~150 | Router de comandos CLI |
