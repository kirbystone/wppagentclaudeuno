interface Props {
  role: "user" | "assistant" | "human";
  content: string;
  createdAt: number;
}

function formatTime(unix: number): string {
  return new Date(unix * 1000).toLocaleTimeString("es", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ role, content, createdAt }: Props) {
  const isUser = role === "user";

  const bubbleClass = isUser
    ? "bg-white border border-gray-200 text-gray-800 self-start"
    : role === "human"
    ? "bg-amber-100 text-amber-900 self-end"
    : "bg-emerald-100 text-emerald-900 self-end";

  const label = role === "assistant" ? "Bot" : role === "human" ? "Humano" : null;

  return (
    <div className={`flex flex-col max-w-[75%] ${isUser ? "items-start" : "items-end"}`}>
      {label && (
        <span className="text-xs text-gray-400 mb-0.5 px-1">{label}</span>
      )}
      <div className={`rounded-2xl px-4 py-2 text-sm ${bubbleClass}`}>
        {content}
      </div>
      <span className="text-xs text-gray-400 mt-0.5 px-1">{formatTime(createdAt)}</span>
    </div>
  );
}
