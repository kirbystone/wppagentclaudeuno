"use client";

interface Props {
  phone: string;
  onDisconnect: () => void;
}

export default function DashboardHeader({ phone, onDisconnect }: Props) {
  async function handleDisconnect() {
    await fetch("/api/connection/disconnect", { method: "POST" });
    onDisconnect();
  }

  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white border-b border-gray-200 shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
        <span className="font-semibold text-gray-900">Agente WhatsApp</span>
        <span className="text-sm text-gray-400">{phone}</span>
      </div>
      <button
        onClick={handleDisconnect}
        className="text-sm text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 px-3 py-1.5 rounded-lg transition-colors"
      >
        Desconectar
      </button>
    </header>
  );
}
