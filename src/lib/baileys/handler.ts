import type makeWASocket from "@whiskeysockets/baileys";
import type { proto } from "@whiskeysockets/baileys";
import {
  getOrCreateConversation,
  getConversationById,
  insertMessage,
  getRecentHistory,
} from "../db";
import { generateReply } from "../llm";

type WASocket = ReturnType<typeof makeWASocket>;

export function startMessageHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        await handleMessage(sock, msg);
      } catch (err) {
        console.error("[bot] Error procesando mensaje:", err);
      }
    }
  });
}

async function handleMessage(sock: WASocket, msg: proto.IWebMessageInfo): Promise<void> {
  // Ignorar mensajes propios
  if (msg.key.fromMe) return;

  const remoteJid = msg.key.remoteJid ?? "";

  // Ignorar grupos
  if (remoteJid.endsWith("@g.us")) return;

  // Solo mensajes 1:1 — WhatsApp usa @s.whatsapp.net (teléfono) o @lid (ID anónimo nuevo)
  const is1to1 = remoteJid.endsWith("@s.whatsapp.net") || remoteJid.endsWith("@lid");
  if (!is1to1) return;

  // Extraer texto (ignorar audio/imagen/sticker)
  const text =
    msg.message?.conversation ??
    msg.message?.extendedTextMessage?.text;

  if (!text) return;

  const phone = remoteJid.split("@")[0];
  const pushName = (msg as { pushName?: string }).pushName ?? undefined;

  console.log(`[bot] ← Mensaje de ${phone} (${pushName ?? "sin nombre"}): "${text}"`);

  const convo = getOrCreateConversation(phone, pushName);
  insertMessage(convo.id, "user", text);

  // Re-leer para respetar cambios de modo que pudieron ocurrir entre mensajes
  const fresh = getConversationById(convo.id);
  if (!fresh || fresh.mode !== "AI") {
    console.log(`[bot] Chat ${phone} en modo HUMAN — no respondo.`);
    return;
  }

  const history = getRecentHistory(convo.id, 20);
  console.log(`[bot] Llamando LLM con ${history.length} mensajes...`);
  const t0 = Date.now();

  const reply = await generateReply(history);

  console.log(`[bot] LLM respondió en ${Date.now() - t0}ms`);
  insertMessage(convo.id, "assistant", reply);

  await sock.sendMessage(remoteJid, { text: reply });
  console.log(`[bot] → Enviado a ${phone}`);
}
