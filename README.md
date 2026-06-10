# Agente WhatsApp con IA

Dashboard local para gestionar conversaciones de WhatsApp con respuestas automáticas vía LLM (OpenRouter). Construido con Next.js 16, Baileys, SQLite y Tailwind CSS 4.

## Requisitos

- Node.js 20+ (recomendado 22)
- Una cuenta en [OpenRouter](https://openrouter.ai/) con créditos cargados

## Instalación

```bash
npm install
cp .env.example .env.local
# Editar .env.local con tu OPENROUTER_API_KEY y OPENROUTER_MODEL
```

## Uso en desarrollo

**Terminal 1 — Bot de WhatsApp:**
```bash
npm run start:bot
```

**Terminal 2 — Dashboard:**
```bash
npm run dev
```

Luego abre [localhost:3000](http://localhost:3000) y escanea el QR con tu WhatsApp.

O bien, para correr ambos juntos (producción):
```bash
npm run start:all
```

## Configurar el sistema prompt

Edita `src/lib/system-prompt.ts` con el prompt de tu negocio:

```typescript
export const SYSTEM_PROMPT = `
Eres un asistente de [Tu Negocio]. Responde en español, de forma breve y amable.
Horario de atención: lunes a viernes de 9 a 18 hs.
Si el usuario necesita hablar con una persona, responde: "Déjame derivarte con un asesor."
`.trim();
```

## Modelo de LLM recomendado

Usa `openai/gpt-4o-mini` en tu `.env.local`:
```
OPENROUTER_MODEL=openai/gpt-4o-mini
```

**No uses modelos `:free`** en producción real. Tienen un límite de 50 requests/día sin créditos cargados y fallan con error 429. `gpt-4o-mini` cuesta ~$0.15 por millón de tokens — centavos por mes para uso normal.

## Deploy en EasyPanel / Railway (sin Docker)

El proyecto incluye `nixpacks.toml` y `Procfile` listos para usar.

**Volúmenes persistentes obligatorios:**
- `/app/data` — base de datos SQLite con todas las conversaciones
- `/app/auth` — sesión de WhatsApp Web (sin esto se re-pide QR en cada redespliegue)

Sin estos volúmenes, cada redespliegue pierde todo el historial y obliga a re-escanear el QR.

## Seguridad — IMPORTANTE

El dashboard **no tiene autenticación**. Si lo desplegás a internet, cualquiera con la URL puede:
- Leer todas las conversaciones de WhatsApp
- Enviar mensajes haciéndose pasar por vos

**Antes de exponer a internet**, agrega una capa de autenticación:
- Basic Auth a nivel proxy en EasyPanel/Caddy/Nginx
- Cloudflare Access (gratis, muy fácil de configurar)

Esto es **bloqueante para producción pública**.

## Arquitectura

```
Bot (tsx) ──────── SQLite (WAL) ──────── Next.js
  │                    │                    │
  ├── Baileys           ├── conversations    ├── API Routes
  ├── handler.ts        ├── messages         └── React Dashboard
  └── client.ts         ├── connection_state
                        └── outbox
```

Los dos procesos (bot y Next.js) comparten la base de datos SQLite en modo WAL para acceso concurrente seguro. La comunicación entre procesos se hace por la tabla `connection_state` (estado/QR) y `outbox` (mensajes humanos pendientes de envío).

## Mejoras pendientes (v2)

- Soporte de imágenes salientes (enviar PNG de productos)
- Function calling real con `tools` de OpenRouter
- Auto-toggle a HUMAN cuando el bot detecta frase específica (regex en handler.ts)
- WebSocket en lugar de polling
- Auth básica en Next.js middleware
- Soporte de grupos (actualmente ignorados)
- Soporte de mensajes de voz/audio
