# Monopoly

Ein Monopoly-Klon für den Browser (React + TypeScript), gegen Menschen und/oder
Computergegner spielbar. Volle Regeln inkl. Auktionen, Häuserbau mit
Baustopp-Regel, Hypotheken, Gefängnis und Handel — plus Sound, eine
Frei-Parken-Hausregel, Einzel-Chat mit jedem Gegner und einstellbare
KI-Persönlichkeiten (Risiko, Baufreude, Handelsschläue, Gnade).

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
  kommt. Klick auf ein Brettfeld öffnet die Feldkarte (`FieldCard.tsx`) mit
  Mietstaffel und — falls eigenes Feld, eigener Zug — dem Bauen/Verkaufen/
  Hypothek-Menü. Handel (`TradePanel.tsx`) läuft unabhängig vom Zug nebenher,
  genau wie Chat — dafür gibt es pro Gegner ein eigenes `ChatFenster.tsx`,
  kein Gruppenchat. `llm.ts` ist der einzige Ort, der mit einem externen
  Server spricht (siehe unten); alles andere bleibt synchron.

## KI-Sprachmodell anschließen (KoboldCpp o.ä.)

Im Spiel unter "KI-Sprachmodell" die URL eines lokal laufenden,
OpenAI-kompatiblen Servers eintragen — für KoboldCpp reicht:

```bash
koboldcpp --config Cydonia.kcpps   # oder per GUI/Doppelklick wie gewohnt starten
```

Sobald KoboldCpp läuft (Standard: `http://localhost:5001`), einfach diese
URL ins Feld eintragen — kein Neustart des Spiels nötig, die Einstellung
greift beim nächsten unbeantworteten Chat. SillyTavern wird **nicht**
gebraucht: ST ist nur ein Frontend, kein API-Server, den man "anbinden"
könnte. `chatcompletionsadapter: "AutoGuess"` in der `.kcpps`-Datei reicht,
damit KoboldCpp den Endpunkt `/v1/chat/completions` bereitstellt.

Bleibt das Feld leer oder ist der Server nicht erreichbar, antworten die
KI-Gegner weiter mit den eingebauten Platzhalter-Sätzen (`generiereKiAntwort`
in `bot.ts`) — das Spiel bleibt so oder so spielbar, ein Fehler beim Laden
des Modells blockiert nie den Bot-Zug. Ein Fehlertext unter dem Eingabefeld
zeigt an, wenn eine Anfrage fehlgeschlagen ist (Server nicht erreichbar,
Timeout nach 60s, o.ä.).

Was ans Modell geht: nur die Persönlichkeit (Name, Beschreibung) und der
private Chatverlauf mit genau diesem einen Gegenüber (`baueChatSystemPrompt`/
`baueChatVerlauf` in `bot.ts`) — keine Spielregeln, keine geheimen Infos
anderer Spieler. Das Modell entscheidet nichts (kauft nichts, baut nichts,
handelt nichts) — es liefert nur den Chattext dazu; alle Spielentscheidungen
laufen weiter über die Heuristik in `bot.ts`.

## Starten

```bash
npm install
npm run dev       # Entwicklungsserver
npm run build     # Produktions-Build nach dist/
npm test          # Engine-Tests (vitest)
```

## Roadmap

1. ✅ Engine + Hotseat, spielbar ohne jede KI
2. ✅ Regelbasierte Bots (kaufen/bauen/bieten nach Heuristik, siehe `bot.ts`),
   inkl. einstellbarer Risikobereitschaft, Baufreude, Handelsschläue und
   einer "Gnade"-Achse (mitleidend/normal/erbarmungslos/spielerschonend), die
   unabhängig von der Schwierigkeit steuert, ob eine KI einem Spieler kurz
   vor dem Bankrott aus der Patsche hilft.
3. ✅ Handel als Engine-Feature: Angebot/Annehmen/Ablehnen, jederzeit möglich
   (nicht an die Zugreihenfolge gebunden), mit sichtbarem Verlauf. KIs
   handeln auch von sich aus miteinander bzw. mit dem Menschen
   (`initiativeAktion` in `bot.ts`).
4. ✅ LLM-Layer für Chat: KoboldCpp/OpenAI-kompatible Anbindung (`llm.ts`),
   Fallback auf Platzhalter-Sätze ohne konfigurierten Server. Verhandlungs-
   *entscheidungen* (Kauf/Bau/Handel) laufen weiterhin über die Heuristik in
   `bot.ts` — das Modell liefert nur den Chattext dazu, siehe unten.
5. ⏳ Persönlichkeiten importieren (SillyTavern Character Cards V2), Feintuning

### Stand der LLM-Anbindung / nächste Schritte

- `llm.ts` ist der einzige Ort, der mit einem externen Server spricht
  (`frageLlm`); die Engine bleibt synchron (`dispatch` blockiert nie), der
  async-Aufruf sitzt in `App.tsx`, mit `gameRef` gegen Race Conditions,
  falls der Mensch weiterspielt, während eine Antwort noch aussteht.
- `generiereKiAntwort()` in `bot.ts` ist der Fallback, wenn kein Endpunkt
  konfiguriert ist oder die Anfrage fehlschlägt — das Spiel hängt nie an
  einer LLM-Antwort.
- `baueChatSystemPrompt`/`baueChatVerlauf` (`bot.ts`) bauen Prompt und
  Verlauf ausschließlich aus `KiProfil.persoenlichkeit` und dem privaten
  Chat-Thread — bewusst ohne Spielregeln oder fremde Geheiminformationen.
- Noch offen: das Modell an echte Spielentscheidungen (Handelsvorschläge
  formulieren/bewerten, Kaufentscheidungen kommentieren) anzubinden, dafür
  liegen `KiKontext`/`KiEntscheidung` (`types.ts`) bereits bereit — die
  Engine würde dem Modell eine vorgerechnete Empfehlung plus Alternativen
  (`bewertung.ts`) liefern, das Modell wählt nur noch aus und formuliert.
- `KiProfil.persoenlichkeit` trägt schon ein optionales `kartenDaten`-Feld für
  importierte SillyTavern Character Cards V2 (noch keine Import-UI).

## Bekannte Vereinfachungen

Dokumentiert direkt im Code (`reducer.ts`), unter anderem:

- Einkommensteuer ist immer der Festbetrag (keine 10%-Wahlmöglichkeit).
- Bankrott gegenüber der Bank: Häuser/Hotels gehen pauschal in den Vorrat
  zurück, ohne Teilerlös.
- Der Frei-Parken-Topf (Hausregel, kein offizielles Monopoly-Regelwerk)
  sammelt Steuern, Kartenkosten und Gefängnis-Kaution; bei einer
  KI-Mitspieler-Rettung (Gnade-Einstellung) fließt das Geld direkt zwischen
  den Spielern, nicht über den Topf.
