"use client";

import { useEffect, useRef, useState } from "react";
import MessageBubble from "./MessageBubble";
import ModeToggle from "./ModeToggle";

interface Message {
  id: number;
  conversation_id: number;
  role: "user" | "assistant" | "human";
  content: string;
  created_at: number;
}

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
}

interface Props {
  conversation: Conversation;
  onModeChange: (mode: "AI" | "HUMAN") => void;
  onDelete: () => void;
}

export default function ConversationPanel({ conversation, onModeChange, onDelete }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"AI" | "HUMAN">(conversation.mode);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Cargar mensajes y hacer polling cada 2s
  useEffect(() => {
    setMode(conversation.mode);
    loadMessages();
    const timer = setInterval(loadMessages, 2_000);
    return () => clearInterval(timer);
  }, [conversation.id]);

  // Scroll al final cuando llegan mensajes nuevos
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadMessages() {
    const res = await fetch(`/api/messages/${conversation.id}`);
    if (res.ok) setMessages(await res.json());
  }

  async function handleSend() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`/api/messages/${conversation.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text.trim() }),
      });
      setText("");
      await loadMessages();
    } finally {
      setSending(false);
    }
  }

  async function handleDelete() {
    await fetch(`/api/conversations/${conversation.id}`, { method: "DELETE" });
    setConfirmDelete(false);
    onDelete();
  }

  function handleModeChange(newMode: "AI" | "HUMAN") {
    setMode(newMode);
    onModeChange(newMode);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header del panel */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div>
          <p className="font-semibold text-sm">{conversation.name ?? conversation.phone}</p>
          <p className="text-xs text-gray-400">{conversation.phone}</p>
        </div>
        <div className="flex items-center gap-2">
          <ModeToggle
            conversationId={conversation.id}
            mode={mode}
            onChange={handleModeChange}
          />
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
          >
            Borrar
          </button>
        </div>
      </div>

      {/* Lista de mensajes */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            role={m.role}
            content={m.content}
            createdAt={m.created_at}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-gray-200 px-4 py-3 bg-white shrink-0">
        {mode === "AI" ? (
          <p className="text-sm text-gray-400 text-center">El bot responde automáticamente.</p>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              placeholder="Escribe un mensaje..."
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
            <button
              onClick={handleSend}
              disabled={sending || !text.trim()}
              className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Enviar
            </button>
          </div>
        )}
      </div>

      {/* Diálogo de confirmación de borrado */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="font-semibold text-gray-900 mb-2">Borrar conversación</h3>
            <p className="text-sm text-gray-500 mb-4">
              Se eliminarán todos los mensajes de esta conversación. Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium"
              >
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
