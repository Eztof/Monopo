/**
 * Client für einen lokalen, OpenAI-kompatiblen LLM-Server — gedacht für KoboldCpp
 * (`chatcompletionsadapter: "AutoGuess"` in der .kcpps-Konfiguration reicht, das
 * ist Standard). Kein SillyTavern nötig: ST ist nur ein Frontend, kein API-Server,
 * den man "anbinden" könnte — wir sprechen direkt mit KoboldCpp.
 *
 * Bewusst nicht Teil der Engine: das hier ist I/O (fetch, async), die Engine
 * (reducer.ts) bleibt synchron und blockiert nie. App.tsx ruft das auf und
 * dispatcht das Ergebnis anschließend wie jede andere Action.
 */

export interface LlmNachricht {
  rolle: "system" | "user" | "assistant";
  text: string;
}

export class LlmFehler extends Error {}

/**
 * Fragt den Chat-Completions-Endpunkt. Wirft LlmFehler bei Netzwerkfehlern, Timeout,
 * einem Nicht-OK-Status oder leerer Antwort — der Aufrufer fällt dann auf die
 * Platzhalter-Antwort zurück (siehe bot.ts: generiereKiAntwort).
 */
export async function frageLlm(endpunkt: string, nachrichten: LlmNachricht[], optionen: { maxTokens?: number; timeoutMs?: number } = {}): Promise<string> {
  const { maxTokens = 200, timeoutMs = 60000 } = optionen;
  const url = `${endpunkt.replace(/\/+$/, "")}/v1/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let antwort: Response;
    try {
      antwort = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "kobold",
          messages: nachrichten.map((n) => ({ role: n.rolle, content: n.text })),
          max_tokens: maxTokens,
          temperature: 0.9,
        }),
        signal: controller.signal,
      });
    } catch (e) {
      if (controller.signal.aborted) throw new LlmFehler(`Keine Antwort von ${endpunkt} innerhalb von ${Math.round(timeoutMs / 1000)}s.`);
      throw new LlmFehler(`${endpunkt} ist nicht erreichbar (läuft KoboldCpp? CORS?): ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!antwort.ok) throw new LlmFehler(`${endpunkt} antwortet mit Status ${antwort.status}.`);
    const daten = (await antwort.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = daten.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) throw new LlmFehler("Antwort enthielt keinen Text.");
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}
