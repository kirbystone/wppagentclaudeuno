export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const fs = await import("node:fs");
  const path = await import("node:path");

  const AUTH_DIR = path.resolve(process.cwd(), "auth");

  // Borrar credenciales viejas para garantizar QR fresco en cada arranque
  try { fs.rmSync(AUTH_DIR, { recursive: true, force: true }); } catch {}

  const { setConnectionState } = await import("./src/lib/db");
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  console.log("[bot] Iniciando bot dentro de Next.js...");

  const { start } = await import("./src/lib/baileys/client");
  start().catch((err) => console.error("[bot] Error fatal en start():", err));
}
