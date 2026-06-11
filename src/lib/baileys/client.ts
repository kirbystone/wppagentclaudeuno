import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "node:path";
import fs from "node:fs";
import { setConnectionState, getConnectionState } from "../db";
import { startMessageHandler } from "./handler";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const logger = pino({ level: "silent" });

export interface BotHandle {
  sock: ReturnType<typeof makeWASocket>;
  shutdown: () => Promise<void>;
}

let handle: BotHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isStarting = false;

// Códigos que indican sesión irrecuperable — requieren credenciales nuevas
const FATAL_CODES = new Set([
  DisconnectReason.loggedOut, // 401
  DisconnectReason.forbidden, // 403
  500,                        // badSession
]);

function clearAuth(): void {
  try {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    console.log("[bot] Credenciales eliminadas OK");
  } catch (e) {
    console.error("[bot] Error eliminando credenciales:", e);
  }
}

export function forceRestart(): void {
  console.log("[bot] forceRestart() — limpiando estado y reiniciando...");
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (handle) {
    try { handle.sock.ev.removeAllListeners("creds.update"); } catch {}
    try { handle.sock.end(undefined); } catch {}
    handle = null;
  }
  isStarting = false;
  clearAuth();
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });
  start().catch((err) => console.error("[bot] Error en forceRestart:", err));
}

export async function start(): Promise<void> {
  if (isStarting) { console.log("[bot] start() ya en progreso, ignorando"); return; }
  if (handle) { console.log("[bot] start() ignorado — socket ya activo"); return; }
  isStarting = true;
  try {
    console.log("[bot] start() — leyendo auth state...");
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    console.log("[bot] auth state OK. Obteniendo versión WA...");

    let version: [number, number, number] | undefined;
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), 8_000)
      );
      const fetched = await Promise.race([fetchLatestBaileysVersion(), timeout]);
      version = fetched.version;
      console.log(`[bot] Versión WA Web: ${version.join(".")}`);
    } catch (err) {
      console.warn("[bot] fetchLatestBaileysVersion falló/timeout — usando bundled:", (err as Error).message);
    }

    console.log("[bot] Creando socket WA...");
    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      browser: Browsers.macOS("Desktop"),
      markOnlineOnConnect: false,
      syncFullHistory: false,
    });
    console.log("[bot] Socket creado — esperando eventos de conexión...");

    handle = {
      sock,
      shutdown: async () => {
        try { await sock.logout(); } catch {}
        try { sock.end(undefined); } catch {}
      },
    };

    isStarting = false;

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log("[bot] QR generado — esperando escaneo...");
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const qrTerminal = require("qrcode-terminal") as { generate: (qr: string, opts: { small: boolean }) => void };
          qrTerminal.generate(qr, { small: true });
        } catch {}
        setConnectionState({ status: "qr", qr_string: qr, phone: null });
      }

      if (connection === "connecting") {
        console.log("[bot] connection.update: connecting");
        const current = getConnectionState();
        if (current.status === "disconnected") {
          setConnectionState({ status: "connecting" });
        }
      }

      if (connection === "open") {
        const rawId = sock.user?.id ?? "";
        const phone = rawId.split(":")[0];
        console.log(`[bot] Conectado como ${phone}`);
        setConnectionState({ status: "connected", qr_string: null, phone });
      }

      if (connection === "close") {
        const code = (lastDisconnect?.error as { output?: { statusCode?: number } })?.output?.statusCode;
        console.log(`[bot] Conexión cerrada — code ${code}`);

        if (FATAL_CODES.has(code as number)) {
          console.log(`[bot] Sesión inválida (code ${code}) — eliminando credenciales para QR nuevo...`);

          // Cancelar reconexión pendiente
          if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

          // Quitar listener de creds.update ANTES de borrar archivos — previene que saveCreds los restaure
          sock.ev.removeAllListeners("creds.update");
          try { sock.end(undefined); } catch {}
          handle = null;

          // Pequeña espera para que cierren operaciones de archivo en curso
          setTimeout(() => {
            clearAuth();
            setConnectionState({ status: "disconnected", qr_string: null, phone: null });
            start().catch((err) => console.error("[bot] Error en reinicio post-logout:", err));
          }, 1_000);
          return;
        }

        scheduleReconnect(code ?? 0);
      }
    });

    startMessageHandler(sock);
  } catch (err) {
    console.error("[bot] ERROR CRÍTICO en start():", err);
    isStarting = false;
    setTimeout(() => start(), 10_000);
  }
}

export async function sendOutbox(phone: string, content: string): Promise<void> {
  if (!handle) throw new Error("Bot no conectado");
  const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
  await handle.sock.sendMessage(jid, { text: content });
}

function scheduleReconnect(code: number): void {
  if (reconnectTimer) return;
  const delay = code === 440 ? 15_000 : 5_000;
  console.log(`[bot] Reconectando en ${delay / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (handle) {
      try { handle.sock.end(undefined); } catch {}
      handle = null;
    }
    start().catch((err) => console.error("[bot] Error en start() tras reconexión:", err));
  }, delay);
}
