import { useEffect, useState } from "react";
import { aktiverAkteur } from "./engine/akteur";
import { naechsteAktion } from "./engine/bot";
import { dispatch } from "./engine/reducer";
import { erzeugeSpiel } from "./engine/state";
import type { Action, GameState } from "./engine/types";
import { ActionBar } from "./ui/ActionBar";
import { Board } from "./ui/Board";
import { Dice } from "./ui/Dice";
import { FieldCard } from "./ui/FieldCard";
import { Log } from "./ui/Log";
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

function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [ausgewaehltesFeld, setAusgewaehltesFeld] = useState<number | null>(null);
  const [stumm, setStumm] = useState(istStummgeschaltet());

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

  // Der Bot-Zug: läuft asynchron außerhalb der Engine, ruft dispatch() genau wie ein Mensch.
  useEffect(() => {
    if (!game || game.phase.typ === "spiel-ende") return;
    const naechste = naechsteAktion(game);
    if (!naechste) return;
    const timer = setTimeout(() => {
      const ergebnis = dispatch(game, naechste);
      spiele(soundFuerAction(naechste, ergebnis.ok, ergebnis.ok ? ergebnis.state : null));
      if (ergebnis.ok) setGame(ergebnis.state);
      else setFehler(ergebnis.grund);
    }, 700);
    return () => clearTimeout(timer);
  }, [game]);

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
        <Board state={game} onFieldClick={setAusgewaehltesFeld} center={<Dice state={game} />} />
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
        <Log state={game} ichBin={derMensch?.id ?? null} onChat={(text, an) => anwenden({ typ: "chat", von: derMensch!.id, an, text })} />
      </div>
      {ausgewaehltesFeld !== null && (
        <FieldCard
          state={game}
          feldId={ausgewaehltesFeld}
          verwaltbarAls={verwaltbarAls}
          onAction={(a) => {
            anwenden(a);
          }}
          onClose={() => setAusgewaehltesFeld(null)}
        />
      )}
    </div>
  );
}

export default App;
