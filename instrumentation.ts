export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { setConnectionState, getConnectionState } = await import("./src/lib/db");
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  console.log("[bot] Iniciando bot dentro de Next.js...");

  const { start, forceRestart } = await import("./src/lib/baileys/client");
  start().catch((err) => console.error("[bot] Error fatal en start():", err));

  // Watchdog: si el bot lleva >2 minutos sin conectar ni mostrar QR, forzar reinicio limpio.
  // Cubre cualquier caso donde el handler de 401 falle o el socket quede zombie.
  let lastHealthyAt = Date.now();
  setInterval(() => {
    const state = getConnectionState();
    if (state.status === "connected" || state.status === "qr") {
      lastHealthyAt = Date.now();
      return;
    }
    if (Date.now() - lastHealthyAt > 120_000) {
      console.log("[bot] Watchdog: sin actividad 2min — forzando reinicio con auth limpio...");
      lastHealthyAt = Date.now();
      forceRestart();
    }
  }, 30_000);
}
