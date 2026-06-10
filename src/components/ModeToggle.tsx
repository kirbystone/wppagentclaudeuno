"use client";

interface Props {
  conversationId: number;
  mode: "AI" | "HUMAN";
  onChange: (mode: "AI" | "HUMAN") => void;
}

export default function ModeToggle({ conversationId, mode, onChange }: Props) {
  async function toggle() {
    const next = mode === "AI" ? "HUMAN" : "AI";
    await fetch(`/api/mode/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    });
    onChange(next);
  }

  return (
    <button
      onClick={toggle}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
        mode === "AI"
          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
          : "bg-amber-100 text-amber-800 hover:bg-amber-200"
      }`}
    >
      {mode === "AI" ? "Modo IA" : "Modo Humano"}
    </button>
  );
}
