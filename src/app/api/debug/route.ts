import { NextResponse } from "next/server";
import { getConnectionState } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const state = getConnectionState();

  const authDir = path.resolve(process.cwd(), "auth");
  const dataDir = path.resolve(process.cwd(), "data");

  let authFiles: string[] = [];
  try { authFiles = fs.readdirSync(authDir); } catch {}

  let dataFiles: string[] = [];
  try { dataFiles = fs.readdirSync(dataDir); } catch {}

  return NextResponse.json({
    cwd: process.cwd(),
    time: new Date().toISOString(),
    connection: state,
    authDir: { path: authDir, files: authFiles },
    dataDir: { path: dataDir, files: dataFiles },
    env: {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY ? "SET" : "MISSING",
      OPENROUTER_MODEL: process.env.OPENROUTER_MODEL ?? "MISSING",
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
