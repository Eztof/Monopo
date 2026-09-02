import { useEffect, useState } from "react";
import { aktiverAkteur } from "./engine/akteur";
import { naechsteAktion } from "./engine/bot";
import { dispatch } from "./engine/reducer";
import { erzeugeSpiel } from "./engine/state";
import type { Action, GameState } from "./engine/types";
import { ActionBar } from "./ui/ActionBar";
import { Board } from "./ui/Board";
import { Log } from "./ui/Log";
import { PlayerPanel } from "./ui/PlayerPanel";
import { PropertyManager } from "./ui/PropertyManager";
import { Setup, type SetupErgebnis } from "./ui/Setup";
import { TradePanel } from "./ui/TradePanel";

function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  function starten(ergebnis: SetupErgebnis) {
    setGame(erzeugeSpiel(ergebnis));
    setFehler(null);
  }

  function anwenden(action: Action) {
    if (!game) return;
    const ergebnis = dispatch(game, action);
    if (ergebnis.ok) {
      setGame(ergebnis.state);
      setFehler(null);
    } else {
      setFehler(ergebnis.grund);
    }
  }

  // Der Bot-Zug: läuft asynchron außerhalb der Engine, ruft dispatch() genau wie ein Mensch.
  useEffect(() => {
    if (!game || game.phase.typ === "spiel-ende") return;
    const naechste = naechsteAktion(game);
    if (!naechste) return;
    const timer = setTimeout(() => {
      const ergebnis = dispatch(game, naechste);
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

  return (
    <div className="spielfeld">
      <div className="spielfeld-oben">
        <Board
          state={game}
          center={
            <div className="mitte-inhalt">
              <PlayerPanel state={game} />
              {ichBin ? (
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
          }
        />
      </div>
      <div className="spielfeld-seite">
        {ichBin && <PropertyManager state={game} spielerId={ichBin} onAction={anwenden} />}
        {ichBin && <TradePanel state={game} ichBin={ichBin} onAction={anwenden} />}
        <Log state={game} ichBin={ichBin} onChat={(text) => anwenden({ typ: "chat", von: ichBin!, text })} />
      </div>
    </div>
  );
}

export default App;
