import OpenAI from "openai";
import { SYSTEM_PROMPT } from "./system-prompt";
import type { Message } from "./db";

const BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/v1";
const MODEL = process.env.OLLAMA_MODEL ?? "llama3";

const client = new OpenAI({
  baseURL: BASE_URL,
  apiKey: "ollama", // Ollama no requiere API key real, pero el SDK la exige
});

export async function generateReply(history: Message[]): Promise<string> {
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = history.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.content,
  }));

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    max_tokens: 500,
  });

  return response.choices[0]?.message?.content?.trim() ?? "Lo siento, no pude generar una respuesta.";
}
