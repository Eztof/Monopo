# Monopoly

Ein Monopoly-Klon für den Browser (React + TypeScript), gegen Menschen und/oder
Computergegner spielbar. Volle Regeln inkl. Auktionen, Häuserbau mit
Baustopp-Regel, Hypotheken, Gefängnis und Handel.

Felder, Straßennamen und die Bank-/Kartentexte sind bewusst erfunden statt
den Hasbro-Originalen entnommen (`src/engine/board.ts`, `src/engine/karten.ts`)
— Preise, Mieten und Reihenfolge folgen aber dem klassischen 40-Felder-Layout,
weil das die Balance ist, auf der die Regeln beruhen.

## Architektur

Regelwerk und KI sind strikt getrennt:

- **`src/engine/`** — die Spiel-Engine. Deterministisch, keine Zeit, kein
  `await`. `dispatch(state, action) => { ok, state | grund }` ist der einzige
  Weg, den Spielstand zu verändern; ungültige Aktionen werden mit einem Grund
  abgelehnt statt zu werfen. Der Zufall ist reproduzierbar (`seed` +
  `ziehungsZaehler` statt `Math.random`), damit sich jede Partie exakt
  nachstellen lässt.
  - `types.ts` — das Datenmodell (Brett, Spielstand, Actions, KI-Schnittstelle).
  - `board.ts`, `karten.ts` — Brett-Konfiguration und Kartendecks.
  - `rng.ts`, `state.ts` — Zufall und Spielaufbau.
  - `reducer.ts` — der Phasen-Automat mit dem kompletten Regelwerk.
  - `bewertung.ts`, `bot.ts` — reine Bewertungsfunktionen plus ein
    regelbasierter Computergegner, der ohne LLM auskommt (Stufe 2 der
    Roadmap, siehe unten).
- **`src/ui/`** — React-Komponenten, die nur `dispatch` aufrufen und das
  Ergebnis anzeigen. Ein Computerzug läuft genauso über `dispatch` wie ein
  Klick eines Menschen — die Engine unterscheidet nicht, woher eine Action
  kommt.

## Starten

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Produktions-Build nach dist/
npm test          # Engine-Tests (vitest)
```

## Roadmap

1. ✅ Engine + Hotseat, spielbar ohne jede KI
2. ✅ Regelbasierte Bots (kaufen/bauen/bieten nach Heuristik, siehe `bot.ts`)
3. ✅ Handel als Engine-Feature (Angebot, Gegenangebot, Annehmen/Ablehnen)
4. ⏳ LLM-Layer für Verhandlungstext und Chat (KiKontext/KiEntscheidung in
   `types.ts` sind bereits darauf zugeschnitten: die Engine rechnet eine
   Empfehlung plus Alternativen vor, das Modell wählt nur noch aus und
   formuliert)
5. ⏳ Persönlichkeiten, SillyTavern Character Cards V2, Feintuning

## Bekannte Vereinfachungen

Dokumentiert direkt im Code (`reducer.ts`), unter anderem:

- Einkommensteuer ist immer der Festbetrag (keine 10%-Wahlmöglichkeit).
- Bankrott gegenüber der Bank: Häuser/Hotels gehen pauschal in den Vorrat
  zurück, ohne Teilerlös.
- Trades können aktuell nur von der Person angeboten werden, die gerade laut
  Phase am Zug/dran ist — nicht jederzeit "nebenbei".
