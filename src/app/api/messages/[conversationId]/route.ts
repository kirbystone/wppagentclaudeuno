import { NextRequest, NextResponse } from "next/server";
import {
  getConversationById,
  getMessages,
  insertMessage,
  enqueueOutbox,
} from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
}

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = parseInt(conversationId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const convo = getConversationById(id);
  if (!convo) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const messages = getMessages(id, 100);
  return NextResponse.json(messages);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { conversationId } = await params;
  const id = parseInt(conversationId, 10);

  if (isNaN(id)) {
    return NextResponse.json({ error: "ID inválido" }, { status: 400 });
  }

  const convo = getConversationById(id);
  if (!convo) {
    return NextResponse.json({ error: "Conversación no encontrada" }, { status: 404 });
  }

  const body = await req.json() as { content?: string };
  if (!body.content?.trim()) {
    return NextResponse.json({ error: "Contenido vacío" }, { status: 400 });
  }

  const content = body.content.trim();

  // Insertar como 'human' (visible en dashboard inmediatamente)
  insertMessage(id, "human", content);

  // Encolar en outbox para que el proceso bot lo envíe vía Baileys
  enqueueOutbox(id, convo.phone, content);

  return NextResponse.json({ ok: true });
}
