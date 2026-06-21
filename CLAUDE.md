# CLAUDE.md

Este archivo provee guía a Claude Code (claude.ai/code) para trabajar con este repositorio.

## Comandos

```bash
# Desarrollo
npm run dev          # Solo dashboard Next.js (sin bot)
npm run dev:all      # Bot + dashboard simultáneamente

# Producción
npm run build        # Compilar Next.js
npm run start        # Servidor Next.js producción
npm run start:all    # Bot + servidor producción simultáneamente

# Solo el bot
npm run start:bot    # Correr el bot WhatsApp standalone (via tsx scripts/start-bot.ts)
```

No hay suite de tests en este proyecto.

## Arquitectura

Dos procesos comparten una sola base de datos SQLite (`data/messages.db` en modo WAL):

1. **WhatsApp Bot** — arranca via `scripts/start-bot.ts` o `instrumentation.ts` (hook de Next.js al iniciar el servidor)
2. **Servidor Next.js** — sirve el dashboard React y las rutas API bajo `src/app/api/`

Los procesos se comunican exclusivamente a través de la base de datos: `connection_state` actúa como canal de estado/QR y `outbox` como cola para mensajes enviados desde el dashboard. No hay IPC directo entre procesos.

### Flujo del bot

`instrumentation.ts` → `src/lib/baileys/client.ts` → `src/lib/baileys/handler.ts`

- **client.ts**: Gestiona el ciclo de vida del WebSocket de Baileys (QR → connecting → connected). Las credenciales viven en `auth/` (se borran en cada startup). Escribe el QR y el estado en `connection_state`. Exporta `start()`, `sendOutbox()`, `forceRestart()`.
- **handler.ts**: Procesa mensajes entrantes. Ignora grupos (`@g.us`). Debe aceptar JIDs tanto `@s.whatsapp.net` como `@lid`. Si el modo de la conversación es `HUMAN`, omite la llamada al LLM. Llama a `generateReply()` con los últimos 20 mensajes como contexto.
- **instrumentation.ts**: Ejecuta un watchdog de 2 minutos que llama a `forceRestart()` si el bot se queda colgado.

### Flujo del dashboard

React hace polling a `/api/connection/status` y `/api/conversations` cada 2 segundos. No hay WebSocket ni SSE. La UI parte de `src/components/ConnectionGate.tsx`, que muestra `QRScreen` o el dashboard según el estado del bot.

### Capa de base de datos (`src/lib/db.ts`)

Cinco tablas: `conversations`, `messages`, `connection_state` (singleton), `outbox` e índices asociados. Todo expuesto via funciones tipadas — nunca escribir SQL directo fuera de este archivo.

### Integración LLM (`src/lib/openrouter.ts`)

Usa el SDK de OpenAI apuntando a `https://openrouter.ai/api/v1`. El modelo se configura con `OPENROUTER_MODEL`. El system prompt está en `src/lib/system-prompt.ts` — es el principal punto de personalización de la personalidad del bot.

## Variables de entorno

| Variable | Propósito |
|---|---|
| `OPENROUTER_API_KEY` | Requerido. Desde openrouter.ai |
| `OPENROUTER_MODEL` | ID del modelo (default: `openai/gpt-4o-mini`) |

Copiar `.env.example` a `.env.local` antes de correr localmente.

## Módulos nativos en Windows

`better-sqlite3` es un módulo nativo de Node.js. Si necesita recompilarse, usar PowerShell estándar (no VS Developer Prompt):

```bash
npx node-gyp rebuild
```

## Deploy

Volúmenes persistentes requeridos al desplegar (Docker/EasyPanel/Railway):
- `/app/data` — base de datos SQLite
- `/app/auth` — sesión de WhatsApp (evita re-escanear el QR al reiniciar)

El dashboard **no tiene autenticación**. Agregar Nginx basic auth o Cloudflare Access antes de exponer públicamente.

`nixpacks.toml` apunta a Node 22. `Procfile` es para Heroku/Railway (`npm run start:all`).
