export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getEnvVar(key: string): string | undefined {
  const g = globalThis as Record<string, unknown>;
  const envObj = g["__env__"] as Record<string, string> | undefined;
  const procEnv = (g["process"] as { env?: Record<string, string> } | undefined)?.env;
  const nodeEnv = (typeof process !== "undefined" ? process.env : undefined) as
    Record<string, string | undefined> | undefined;

  if (key === "GEMINI_API_KEY") {
    const val =
      nodeEnv?.["GEMINI_API_KEY"] || envObj?.["GEMINI_API_KEY"] || procEnv?.["GEMINI_API_KEY"];
    return val && val.trim() ? val.trim() : undefined;
  }

  if (key === "GEMINI_MODEL") {
    return (
      nodeEnv?.["GEMINI_MODEL"] ||
      envObj?.["GEMINI_MODEL"] ||
      procEnv?.["GEMINI_MODEL"] ||
      "gemini-flash-lite-latest"
    );
  }

  if (key === "GROQ_API_KEY") {
    const val = nodeEnv?.["GROQ_API_KEY"] || envObj?.["GROQ_API_KEY"] || procEnv?.["GROQ_API_KEY"];
    return val && val.trim() ? val.trim() : undefined;
  }

  if (key === "OPENAI_API_KEY") {
    return nodeEnv?.["OPENAI_API_KEY"] || envObj?.["OPENAI_API_KEY"] || procEnv?.["OPENAI_API_KEY"];
  }

  if (key === "CUSTOM_LLM_URL") {
    return nodeEnv?.["CUSTOM_LLM_URL"] || envObj?.["CUSTOM_LLM_URL"] || procEnv?.["CUSTOM_LLM_URL"];
  }

  return (
    process.env[key] ||
    envObj?.[key] ||
    procEnv?.[key] ||
    (typeof import.meta !== "undefined"
      ? (import.meta as unknown as { env?: Record<string, string> }).env?.[key]
      : undefined)
  );
}

/**
 * Universal utility to query the active LLM based on environment configuration.
 * Prioritises Gemini Flash Lite Latest, cascades to Groq ultra-fast backup (Qwen 3.8 / GPT OSS), OpenAI, and custom LLM.
 */
export async function queryLLM(messages: ChatMessage[]): Promise<string | null> {
  const customUrl = getEnvVar("CUSTOM_LLM_URL");
  const customKey = getEnvVar("CUSTOM_LLM_KEY");
  const customModel = getEnvVar("CUSTOM_LLM_MODEL");
  const geminiKey = getEnvVar("GEMINI_API_KEY");
  const groqKey = getEnvVar("GROQ_API_KEY");
  const openaiKey = getEnvVar("OPENAI_API_KEY") || getEnvVar("AI_GATEWAY_API_KEY");

  // 1. Google Gemini API (Primary — Fast Low-Latency Flash Models)
  if (geminiKey) {
    const configuredModel = getEnvVar("GEMINI_MODEL");
    const validConfigured =
      configuredModel &&
      !configuredModel.includes("1.5") &&
      !configuredModel.includes("2.0") &&
      !configuredModel.includes("2.5") &&
      configuredModel !== "gemini-3.5-flash" &&
      configuredModel !== "gemini-flash-latest"
        ? configuredModel
        : "gemini-flash-lite-latest";

    const candidateModels = Array.from(
      new Set([validConfigured, "gemini-flash-lite-latest", "gemini-3.5-flash-lite"]),
    );

    const systemInstruction = messages.find((m) => m.role === "system")?.content;
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const body: {
      contents: typeof contents;
      systemInstruction?: { parts: { text: string }[] };
      generationConfig?: { maxOutputTokens: number; temperature?: number };
    } = { contents, generationConfig: { maxOutputTokens: 1500, temperature: 0.2 } };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(12000),
        });

        if (res.ok) {
          const payload = (await res.json()) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const parts = payload.candidates?.[0]?.content?.parts ?? [];
          const text = parts
            .map((p) => p.text)
            .filter(Boolean)
            .join("\n")
            .trim();
          if (text) return text;
        } else {
          console.warn(
            `Gemini model ${model} returned HTTP ${res.status}, cascading to next candidate...`,
          );
        }
      } catch (e) {
        console.warn(`Gemini model ${model} request error:`, e);
      }
    }
  }

  // 2. Groq Ultra-Fast Backup (High Performance Fallback — 500ms response)
  if (groqKey) {
    const groqModels = [
      "qwen/qwen3.8-27b",
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "groq/compound-mini",
    ];

    for (const model of groqModels) {
      try {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens: 1500,
            temperature: 0.2,
          }),
          signal: AbortSignal.timeout(10000),
        });

        if (res.ok) {
          const payload = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const content = payload.choices?.[0]?.message?.content?.trim();
          if (content) return content;
        } else {
          console.warn(`Groq model ${model} returned HTTP ${res.status}, cascading...`);
        }
      } catch (e) {
        console.warn(`Groq model ${model} request error:`, e);
      }
    }
  }

  // 3. Custom / Local LLM (e.g. Ollama, LM Studio, vLLM)
  if (customUrl) {
    try {
      const url = customUrl.endsWith("/chat/completions")
        ? customUrl
        : `${customUrl.replace(/\/+$/, "")}/chat/completions`;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (customKey) {
        headers["Authorization"] = `Bearer ${customKey}`;
      }

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: customModel || "local-model",
          messages,
        }),
      });

      if (res.ok) {
        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return payload.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch (e) {
      console.error("Local LLM API request failed:", e);
    }
  }

  // 4. OpenAI or AI Gateway
  if (openaiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openaiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
        }),
      });

      if (res.ok) {
        const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
        return payload.choices?.[0]?.message?.content?.trim() || null;
      }
    } catch (e) {
      console.error("OpenAI API request failed:", e);
    }
  }

  return null;
}
