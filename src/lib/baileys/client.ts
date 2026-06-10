import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from "@whiskeysockets/baileys";
import pino from "pino";
import path from "node:path";
import { setConnectionState } from "../db";
import { startMessageHandler } from "./handler";

const AUTH_DIR = path.resolve(process.cwd(), "auth");
const logger = pino({ level: "silent" });

export interface BotHandle {
  sock: ReturnType<typeof makeWASocket>;
  shutdown: () => Promise<void>;
}

let handle: BotHandle | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

export async function start(): Promise<void> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // Siempre obtener la versión más reciente — WhatsApp rechaza versiones viejas con code 405
  let version: [number, number, number] | undefined;
  try {
    const fetched = await fetchLatestBaileysVersion();
    version = fetched.version;
    console.log(`[bot] Versión WA Web: ${version.join(".")}`);
  } catch (err) {
    console.warn("[bot] No se pudo obtener última versión de Baileys:", err);
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    // Fingerprint conocido — custom browser dispara code 440 (connectionReplaced) en loop
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  handle = {
    sock,
    shutdown: async () => {
      try {
        await sock.logout();
      } catch {}
      try {
        sock.end(undefined);
      } catch {}
    },
  };

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("[bot] QR generado — esperando escaneo...");
      // qrcode-terminal como fallback de debugging (sin types oficiales)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const qrTerminal = require("qrcode-terminal") as { generate: (qr: string, opts: { small: boolean }) => void };
      qrTerminal.generate(qr, { small: true });
      setConnectionState({ status: "qr", qr_string: qr, phone: null });
    }

    if (connection === "connecting") {
      const current = (await import("../db")).getConnectionState();
      // Solo bajar a 'connecting' si estamos en 'disconnected' (arranque inicial)
      // No degradar desde 'qr' ni desde 'connected'
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

      if (code === DisconnectReason.loggedOut) {
        // Sesión invalidada — limpiar y esperar nuevo QR
        setConnectionState({ status: "disconnected", qr_string: null, phone: null });
        console.log("[bot] Sesión cerrada (loggedOut). Reconectando para nuevo QR...");
        scheduleReconnect(code);
        return;
      }

      // Para cualquier otro code: NO modificar el estado en DB.
      // El dashboard sigue mostrando el estado anterior mientras el bot reconecta.
      scheduleReconnect(code ?? 0);
    }
  });

  startMessageHandler(sock);
}

export async function sendOutbox(phone: string, content: string): Promise<void> {
  if (!handle) throw new Error("Bot no conectado");
  const jid = phone.includes("@") ? phone : `${phone}@s.whatsapp.net`;
  await handle.sock.sendMessage(jid, { text: content });
}

function scheduleReconnect(code: number): void {
  if (reconnectTimer) return;
  // Code 440 = connectionReplaced — esperar más para no entrar en loop
  const delay = code === 440 ? 15_000 : 5_000;
  console.log(`[bot] Reconectando en ${delay / 1000}s...`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    if (handle) {
      try {
        handle.sock.end(undefined);
      } catch {}
      handle = null;
    }
    start();
  }, delay);
}
