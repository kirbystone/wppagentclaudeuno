import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

const dataDir = path.resolve(process.cwd(), "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "messages.db");
const db = new Database(dbPath);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    mode TEXT CHECK(mode IN ('AI','HUMAN')) NOT NULL DEFAULT 'AI',
    last_message_at INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id),
    role TEXT CHECK(role IN ('user','assistant','human')) NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_messages_conv
    ON messages(conversation_id, created_at);

  CREATE TABLE IF NOT EXISTS connection_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    status TEXT CHECK(status IN ('disconnected','qr','connecting','connected'))
      NOT NULL DEFAULT 'disconnected',
    qr_string TEXT,
    phone TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  INSERT OR IGNORE INTO connection_state (id, status) VALUES (1, 'disconnected');

  CREATE TABLE IF NOT EXISTS outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    phone TEXT NOT NULL,
    content TEXT NOT NULL,
    sent INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox(sent, created_at);
`);

// --- Tipos ---

export interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  created_at: number;
}

export interface ConversationWithPreview extends Conversation {
  last_message_preview: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

export interface ConnectionState {
  id: 1;
  status: "disconnected" | "qr" | "connecting" | "connected";
  qr_string: string | null;
  phone: string | null;
  updated_at: number;
}

export interface OutboxItem {
  id: number;
  conversation_id: number;
  phone: string;
  content: string;
  sent: number;
  created_at: number;
}

// --- Statements preparados ---

const stmtGetConvByPhone = db.prepare<[string]>(
  "SELECT * FROM conversations WHERE phone = ?"
);

const stmtInsertConv = db.prepare<[string, string | null]>(
  "INSERT INTO conversations (phone, name) VALUES (?, ?) RETURNING *"
);

const stmtGetConvById = db.prepare<[number]>(
  "SELECT * FROM conversations WHERE id = ?"
);

const stmtInsertMsg = db.prepare<[number, string, string]>(
  "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)"
);

const stmtUpdateLastMsg = db.prepare<[number]>(
  "UPDATE conversations SET last_message_at = unixepoch() WHERE id = ?"
);

const stmtGetMessages = db.prepare<[number, number]>(
  "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?"
);

const stmtGetRecentHistory = db.prepare<[number, number]>(
  "SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?"
);

const stmtSetMode = db.prepare<[string, number]>(
  "UPDATE conversations SET mode = ? WHERE id = ?"
);

const stmtListConversations = db.prepare(
  `SELECT c.*,
     (SELECT content FROM messages m
      WHERE m.conversation_id = c.id
      ORDER BY m.created_at DESC LIMIT 1) AS last_message_preview
   FROM conversations c
   ORDER BY c.last_message_at DESC NULLS LAST`
);

const stmtGetConnectionState = db.prepare<[]>(
  "SELECT * FROM connection_state WHERE id = 1"
);

const stmtEnqueueOutbox = db.prepare<[number, string, string]>(
  "INSERT INTO outbox (conversation_id, phone, content) VALUES (?, ?, ?)"
);

const stmtGetPendingOutbox = db.prepare<[number]>(
  "SELECT * FROM outbox WHERE sent = 0 ORDER BY created_at ASC LIMIT ?"
);

const stmtMarkOutboxSent = db.prepare<[number]>(
  "UPDATE outbox SET sent = 1 WHERE id = ?"
);

const stmtDeleteMessages = db.prepare<[number]>(
  "DELETE FROM messages WHERE conversation_id = ?"
);

const stmtDeleteOutboxPending = db.prepare<[number]>(
  "DELETE FROM outbox WHERE conversation_id = ? AND sent = 0"
);

const stmtDeleteConversation = db.prepare<[number]>(
  "DELETE FROM conversations WHERE id = ?"
);

// --- Helpers transaccionales ---

const txInsertMessage = db.transaction((convId: number, role: string, content: string) => {
  stmtInsertMsg.run(convId, role, content);
  stmtUpdateLastMsg.run(convId);
});

const txDeleteConversation = db.transaction((id: number) => {
  stmtDeleteMessages.run(id);
  stmtDeleteOutboxPending.run(id);
  stmtDeleteConversation.run(id);
});

// --- API pública ---

export function getOrCreateConversation(phone: string, name?: string): Conversation {
  const existing = stmtGetConvByPhone.get(phone) as Conversation | undefined;
  if (existing) return existing;
  const rows = stmtInsertConv.all(phone, name ?? null) as Conversation[];
  return rows[0];
}

export function getConversationById(id: number): Conversation | null {
  return (stmtGetConvById.get(id) as Conversation | undefined) ?? null;
}

export function insertMessage(conversationId: number, role: "user" | "assistant" | "human", content: string): void {
  txInsertMessage(conversationId, role, content);
}

export function getMessages(conversationId: number, limit = 50): Message[] {
  return stmtGetMessages.all(conversationId, limit) as Message[];
}

export function getRecentHistory(conversationId: number, limit = 20): Message[] {
  const rows = stmtGetRecentHistory.all(conversationId, limit) as Message[];
  return rows.reverse();
}

export function setMode(conversationId: number, mode: "AI" | "HUMAN"): void {
  stmtSetMode.run(mode, conversationId);
}

export function listConversations(): ConversationWithPreview[] {
  return stmtListConversations.all() as ConversationWithPreview[];
}

export function getConnectionState(): ConnectionState {
  return stmtGetConnectionState.get() as ConnectionState;
}

export function setConnectionState(update: {
  status?: "disconnected" | "qr" | "connecting" | "connected";
  qr_string?: string | null;
  phone?: string | null;
}): void {
  const current = getConnectionState();

  const newStatus = update.status ?? current.status;
  // Solo actualizar qr_string/phone si se pasan explícitamente en el update
  const newQr = "qr_string" in update ? update.qr_string : current.qr_string;
  const newPhone = "phone" in update ? update.phone : current.phone;

  db.prepare(
    "UPDATE connection_state SET status = ?, qr_string = ?, phone = ?, updated_at = unixepoch() WHERE id = 1"
  ).run(newStatus, newQr ?? null, newPhone ?? null);
}

export function enqueueOutbox(conversationId: number, phone: string, content: string): void {
  stmtEnqueueOutbox.run(conversationId, phone, content);
}

export function getPendingOutbox(limit = 20): OutboxItem[] {
  return stmtGetPendingOutbox.all(limit) as OutboxItem[];
}

export function markOutboxSent(id: number): void {
  stmtMarkOutboxSent.run(id);
}

export function deleteConversation(id: number): void {
  txDeleteConversation(id);
}
