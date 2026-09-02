/**
 * Einstellung für die optionale LLM-Anbindung (z.B. KoboldCpp, OpenAI-kompatibel).
 * Leer = die KI antwortet weiter mit den eingebauten Platzhalter-Sätzen.
 */
export function LlmPanel({ endpunkt, onChange, fehler }: { endpunkt: string; onChange: (v: string) => void; fehler: string | null }) {
  return (
    <div className="llm-panel">
      <h3>KI-Sprachmodell</h3>
      <p className="llm-hinweis">
        Optional: URL eines OpenAI-kompatiblen Servers (z.B. KoboldCpp) für echte Chatantworten. Leer lassen = Platzhalter-Antworten.
      </p>
      <input type="text" value={endpunkt} onChange={(ev) => onChange(ev.target.value)} placeholder="http://localhost:5001" />
      {fehler && <p className="llm-fehler">{fehler}</p>}
    </div>
  );
}
