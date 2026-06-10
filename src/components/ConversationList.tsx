"use client";

interface Conversation {
  id: number;
  phone: string;
  name: string | null;
  mode: "AI" | "HUMAN";
  last_message_at: number | null;
  last_message_preview: string | null;
}

interface Props {
  conversations: Conversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

function relativeTime(unix: number | null): string {
  if (!unix) return "";
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return "ahora";
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}

export default function ConversationList({ conversations, selectedId, onSelect }: Props) {
  return (
    <div className="flex flex-col divide-y divide-gray-100 overflow-y-auto">
      {conversations.length === 0 && (
        <p className="p-4 text-sm text-gray-400">Sin conversaciones aún.</p>
      )}
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`flex flex-col gap-0.5 px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
            selectedId === c.id ? "bg-gray-100" : ""
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm truncate">
              {c.name ?? c.phone}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                c.mode === "AI"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {c.mode === "AI" ? "IA" : "HUMAN"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-gray-400 truncate">{c.last_message_preview ?? ""}</p>
            <span className="text-xs text-gray-300 shrink-0">
              {relativeTime(c.last_message_at)}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
