import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { setConnectionState } from "@/lib/db";

export async function POST() {
  setConnectionState({ status: "disconnected", qr_string: null, phone: null });

  // Borrar sesión guardada de Baileys
  const authDir = path.resolve(process.cwd(), "auth");
  try {
    fs.rmSync(authDir, { recursive: true, force: true });
  } catch {}

  // Flag que le indica al proceso bot que se reinicie
  const dataDir = path.resolve(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, ".restart"), "");

  return NextResponse.json({ ok: true });
}
