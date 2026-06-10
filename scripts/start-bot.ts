// env-loader DEBE ser el primer import — ES modules hoistean todos los imports,
// por lo que cargar .env.local desde aquí garantiza que el resto de módulos
// ya tengan process.env poblado cuando se inicializan.
import "./env-loader";

import path from "node:path";
import fs from "node:fs";
import { setConnectionState } from "../src/lib/db";
import { start } from "../src/lib/baileys/client";

const DATA_DIR = path.resolve(process.cwd(), "data");
const RESTART_FLAG = path.join(DATA_DIR, ".restart");

// Limpiar estado al arrancar
setConnectionState({ status: "disconnected", qr_string: null, phone: null });

console.log("[bot] Iniciando...");
start();

// Poll por flag de reinicio (creado por /api/connection/disconnect)
setInterval(() => {
  if (!fs.existsSync(RESTART_FLAG)) return;

  console.log("[bot] Flag de reinicio detectado — restarting...");
  try {
    fs.unlinkSync(RESTART_FLAG);
  } catch {}

  // Limpiar auth (defensa doble)
  const authDir = path.resolve(process.cwd(), "auth");
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
  } catch {}

  setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  // Reiniciar conexión para generar nuevo QR
  start();
}, 1_000);

// Outbox: enviar mensajes humanos encolados al cliente de WhatsApp
setInterval(async () => {
  const { getPendingOutbox, markOutboxSent } = await import("../src/lib/db");
  const { sendOutbox } = await import("../src/lib/baileys/client");

  const pending = getPendingOutbox(20);
  if (pending.length === 0) return;

  for (const item of pending) {
    try {
      await sendOutbox(item.phone, item.content);
      markOutboxSent(item.id);
      console.log(`[bot] Outbox enviado → ${item.phone}`);
    } catch (err) {
      console.warn(`[bot] Outbox falló para ${item.phone}:`, err);
    }
  }
}, 2_000);
