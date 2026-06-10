import { NextRequest, NextResponse } from "next/server";
import { getConversationById, setMode } from "@/lib/db";

interface Ctx {
  params: Promise<{ conversationId: string }>;
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

  const body = await req.json() as { mode?: string };
  if (body.mode !== "AI" && body.mode !== "HUMAN") {
    return NextResponse.json({ error: "Modo inválido" }, { status: 400 });
  }

  setMode(id, body.mode);
  return NextResponse.json({ ok: true, mode: body.mode });
}
