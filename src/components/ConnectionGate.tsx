"use client";

import { useEffect, useState } from "react";
import QRScreen from "./QRScreen";
import DashboardHeader from "./DashboardHeader";
import ConversationList from "./ConversationList";
import ConversationPanel from "./ConversationPanel";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

type AppStatus = "checking" | "disconnected" | "connected";

export default function ConnectionGate() {
  const [appStatus, setAppStatus] = useState<AppStatus>("checking");
  const [connectedPhone, setConnectedPhone] = useState<string>("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Verificar estado inicial
  useEffect(() => {
    fetch("/api/connection/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "connected" && data.phone) {
          setConnectedPhone(data.phone);
          setAppStatus("connected");
        } else {
          setAppStatus("disconnected");
        }
      })
      .catch(() => setAppStatus("disconnected"));
  }, []);

  // Polling de conversaciones cuando está conectado
  useEffect(() => {
    if (appStatus !== "connected") return;
    loadConversations();
    const timer = setInterval(loadConversations, 2_000);
    return () => clearInterval(timer);
  }, [appStatus]);

  async function loadConversations() {
    const res = await fetch("/api/conversations");
    if (res.ok) {
      const data: Conversation[] = await res.json();
      setConversations(data);
    }
  }

  function handleConnected(phone: string) {
    setConnectedPhone(phone);
    setAppStatus("connected");
  }

  function handleDisconnect() {
    setSelectedId(null);
    setConversations([]);
    setAppStatus("disconnected");
  }

  function handleConversationDeleted() {
    setSelectedId(null);
    loadConversations();
  }

  function handleModeChange(id: number, mode: "AI" | "HUMAN") {
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, mode } : c))
    );
  }

  if (appStatus === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">Cargando...</div>
      </div>
    );
  }

  if (appStatus === "disconnected") {
    return <QRScreen onConnected={handleConnected} />;
  }

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex flex-col h-screen">
      <DashboardHeader phone={connectedPhone} onDisconnect={handleDisconnect} />
      <div className="flex flex-1 overflow-hidden">
        {/* Lista lateral */}
        <aside className="w-72 border-r border-gray-200 bg-white flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-600">Conversaciones</h2>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </aside>

        {/* Panel principal */}
        <main className="flex-1 overflow-hidden bg-gray-50">
          {selectedConv ? (
            <ConversationPanel
              key={selectedConv.id}
              conversation={selectedConv}
              onModeChange={(mode) => handleModeChange(selectedConv.id, mode)}
              onDelete={handleConversationDeleted}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-gray-400 text-sm">Selecciona una conversación</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
