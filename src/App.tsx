import { useEffect, useRef, useState } from "react";
import { aktiverAkteur } from "./engine/akteur";
import { baueChatSystemPrompt, baueChatVerlauf, findeUnbeantworteteNachricht, generiereKiAntwort, naechsteAktion } from "./engine/bot";
import { dispatch } from "./engine/reducer";
import { erzeugeSpiel } from "./engine/state";
import type { Action, GameState, SpielerId } from "./engine/types";
import { ActionBar } from "./ui/ActionBar";
import { Board } from "./ui/Board";
import { ChatFenster } from "./ui/ChatFenster";
import { Dice } from "./ui/Dice";
import { EventLog } from "./ui/EventLog";
import { FieldCard } from "./ui/FieldCard";
import { GeldPopups } from "./ui/GeldPopups";
import { frageLlm, LlmFehler } from "./ui/llm";
import { LlmPanel } from "./ui/LlmPanel";
import { PlayerPanel } from "./ui/PlayerPanel";
import { Setup, type SetupErgebnis } from "./ui/Setup";
import { istStummgeschaltet, setzeStumm, spiele, type SoundArt } from "./ui/sound";
import { TradePanel } from "./ui/TradePanel";

function soundFuerAction(action: Action, ergebnisOk: boolean, neuerState: GameState | null): SoundArt {
  if (!ergebnisOk) return "fehler";
  if (neuerState?.phase.typ === "spiel-ende") return "sieg";
  switch (action.typ) {
    case "wuerfeln":
      return "wuerfeln";
    case "kaufen":
      return "kaufen";
    case "haus-bauen":
    case "haus-verkaufen":
      return "bauen";
    case "hypothek-aufnehmen":
      return "geld-erhalten";
    case "hypothek-abloesen":
    case "schuld-begleichen":
      return "geld-zahlen";
    case "bankrott-erklaeren":
      return "bankrott";
    case "zug-beenden":
      return "zugende";
    case "weiter":
      return "karte";
    case "kaution-zahlen":
    case "frei-karte-nutzen":
      return "gefaengnis";
    case "bieten":
    case "aussteigen":
    case "auktion-starten":
      return "auktion";
    case "handel-anbieten":
    case "handel-annehmen":
    case "handel-ablehnen":
      return "handel";
    case "chat":
      return "chat";
  }
}

function ladeLlmEndpunkt(): string {
  try {
    return localStorage.getItem("monopoly-llm-endpunkt") ?? "";
  } catch {
    return "";
  }
}

function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ausgewaehltesFeld, setAusgewaehltesFeld] = useState<number | null>(null);
  const [stumm, setStumm] = useState(istStummgeschaltet());
  const [llmEndpunkt, setLlmEndpunktState] = useState(ladeLlmEndpunkt);
  const [llmFehler, setLlmFehler] = useState<string | null>(null);
  const [llmWartetFuer, setLlmWartetFuer] = useState<SpielerId | null>(null);
  const llmLaeuftRef = useRef(false);
  // Hält den jeweils aktuellen Spielstand für die LLM-Callbacks bereit — ein Fetch kann Sekunden
  // dauern, in denen der Mensch längst weitergespielt haben kann. dispatch() greift immer auf den
  // frischen Stand zu, nie auf den zum Anfrage-Zeitpunkt eingefangenen (sonst könnte der Bot-Loop
  // hängen bleiben, weil eine verworfene Antwort den nächsten Effekt-Durchlauf nie auslöst).
  const gameRef = useRef<GameState | null>(null);
  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  function setLlmEndpunkt(v: string) {
    setLlmEndpunktState(v);
    setLlmFehler(null);
    try {
      localStorage.setItem("monopoly-llm-endpunkt", v);
    } catch {
      /* localStorage kann fehlen (privates Fenster o.ä.) — dann gilt die Einstellung nur für diese Sitzung. */
    }
  }

  function starten(ergebnis: SetupErgebnis) {
    setGame(erzeugeSpiel(ergebnis));
    setFehler(null);
  }

  function anwenden(action: Action) {
    if (!game) return;
    const ergebnis = dispatch(game, action);
    spiele(soundFuerAction(action, ergebnis.ok, ergebnis.ok ? ergebnis.state : null));
    if (ergebnis.ok) {
      setGame(ergebnis.state);
      setFehler(null);
    } else {
      setFehler(ergebnis.grund);
    }
  }

  function stummSchalten() {
    const neu = !stumm;
    setzeStumm(neu);
    setStumm(neu);
  }

  // Der Bot-Zug läuft asynchron außerhalb der Engine, ruft dispatch() genau wie ein Mensch.
  // Ein unbeantworteter privater Chat hat Vorrang und geht — falls konfiguriert — über ein
  // echtes LLM statt der eingebauten Platzhalter-Sätze.
  useEffect(() => {
    if (!game || game.phase.typ === "spiel-ende") return;
    if (llmLaeuftRef.current) return;

    if (llmEndpunkt.trim()) {
      const ziel = findeUnbeantworteteNachricht(game);
      if (ziel) {
        let sichtbar = true;
        llmLaeuftRef.current = true;
        setLlmWartetFuer(ziel.ki.id);
        const partner = game.spieler.find((p) => p.id === ziel.partnerId);
        const nachrichten = [
          { rolle: "system" as const, text: baueChatSystemPrompt(ziel.ki, partner) },
          ...baueChatVerlauf(game, ziel.ki.id, ziel.partnerId),
        ];

        const antwortAnwenden = (text: string) => {
          llmLaeuftRef.current = false;
          if (sichtbar) setLlmWartetFuer(null);
          const aktuell = gameRef.current;
          if (!aktuell) return; // Spiel wurde inzwischen zurückgesetzt
          const action: Action = { typ: "chat", von: ziel.ki.id, an: ziel.partnerId, text };
          const ergebnis = dispatch(aktuell, action);
          spiele(soundFuerAction(action, ergebnis.ok, ergebnis.ok ? ergebnis.state : null));
          if (ergebnis.ok) setGame(ergebnis.state);
        };

        frageLlm(llmEndpunkt.trim(), nachrichten)
          .then((text) => {
            if (sichtbar) setLlmFehler(null);
            antwortAnwenden(text);
          })
          .catch((e) => {
            if (sichtbar) setLlmFehler(e instanceof LlmFehler ? e.message : "LLM-Anfrage fehlgeschlagen.");
            // Spiel darf nicht hängen bleiben: Platzhalter-Antwort statt der KI-Stimme.
            antwortAnwenden(generiereKiAntwort());
          });
        return () => {
          sichtbar = false;
        };
      }
    }

    const naechste = naechsteAktion(game);
    if (!naechste) return;
    const timer = setTimeout(() => {
      const ergebnis = dispatch(game, naechste);
      spiele(soundFuerAction(naechste, ergebnis.ok, ergebnis.ok ? ergebnis.state : null));
      if (ergebnis.ok) setGame(ergebnis.state);
      else setFehler(ergebnis.grund);
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game, llmEndpunkt]);

  if (!game) {
    return <Setup onStart={starten} />;
  }

  const aktivId = aktiverAkteur(game);
  const aktiv = game.spieler.find((p) => p.id === aktivId);
  const ichBin = aktiv && aktiv.steuerung === "mensch" ? aktiv.id : null;

  // Verwaltung (Bauen/Hypothek) hängt am eigentlichen Zug-Inhaber, nicht an der Auktions-Bietreihenfolge.
  const zugSpieler = game.spieler.find((p) => p.id === game.amZug);
  const verwaltbarAls = zugSpieler && zugSpieler.steuerung === "mensch" ? zugSpieler.id : null;

  // "Mein Sitz" für Chat/Handel — unabhängig davon, wer gerade am Zug ist (das darf jederzeit passieren).
  const derMensch = game.spieler.find((p) => p.steuerung === "mensch") ?? null;
  const gegner = derMensch ? game.spieler.filter((p) => p.id !== derMensch.id && !p.bankrott) : [];

  const phase = game.phase;
  const sieger = phase.typ === "spiel-ende" ? game.spieler.find((p) => p.id === phase.sieger) : null;

  return (
    <div className="spielfeld">
      <div className="spielfeld-oben">
        <div className="oben-kopf">
          <button className="stumm-schalter" onClick={stummSchalten} title={stumm ? "Ton an" : "Ton aus"}>
            {stumm ? "🔇" : "🔊"}
          </button>
        </div>
        <Board
          state={game}
          onFieldClick={setAusgewaehltesFeld}
          center={
            <>
              <GeldPopups state={game} />
              <Dice state={game} />
            </>
          }
        />
        <div className="action-bereich">
          {sieger ? (
            <div className="action-bar">
              <p>{sieger.name} gewinnt das Spiel! 🎉</p>
            </div>
          ) : ichBin ? (
            <ActionBar state={game} ichBin={ichBin} onAction={anwenden} />
          ) : (
            <div className="action-bar">
              <p>{aktiv?.name} (Computer) denkt nach …</p>
            </div>
          )}
          {fehler && <div className="fehler">{fehler}</div>}
          <button className="neues-spiel" onClick={() => setGame(null)}>
            Neues Spiel
          </button>
        </div>
      </div>
      <div className="spielfeld-seite">
        <PlayerPanel state={game} />
        {derMensch && <TradePanel state={game} ichBin={derMensch.id} onAction={anwenden} />}
        <EventLog state={game} />
        <LlmPanel endpunkt={llmEndpunkt} onChange={setLlmEndpunkt} fehler={llmFehler} />
        {derMensch &&
          gegner.map((partner) => (
            <ChatFenster
              key={partner.id}
              state={game}
              ichBin={derMensch.id}
              partner={partner}
              wartetAufAntwort={llmWartetFuer === partner.id}
              onChat={(text) => anwenden({ typ: "chat", von: derMensch.id, an: partner.id, text })}
            />
          ))}
      </div>
      {ausgewaehltesFeld !== null && (
        <FieldCard state={game} feldId={ausgewaehltesFeld} verwaltbarAls={verwaltbarAls} onAction={anwenden} onClose={() => setAusgewaehltesFeld(null)} />
      )}
    </div>
  );
}

export default App;
