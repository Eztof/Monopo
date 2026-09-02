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
  Hypothek-Menü. Handel (`TradePanel.tsx`) und Chat (`Log.tsx`) laufen
  unabhängig vom Zug nebenher.

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
4. ⏳ LLM-Layer für Verhandlungstext und Chat
5. ⏳ Persönlichkeiten, SillyTavern Character Cards V2, Feintuning

### Vorbereitung für Stufe 4/5 (LLM-Anbindung)

Damit der Umstieg kein Rewrite wird, ist das schon jetzt so geschnitten:

- `KiKontext`/`KiEntscheidung` (`types.ts`) liegen bereit: Die Engine liefert
  dem Modell eine vorgerechnete Empfehlung plus Alternativen
  (`bewertung.ts`), das Modell wählt nur noch aus und formuliert den Text
  dazu — es rechnet nie selbst.
- Die aktuellen Platzhalter sind bewusst an genau einer Stelle isoliert:
  `generiereKiAntwort()` in `bot.ts` erzeugt die (noch zufälligen) Chat-Antworten.
  Das ist die Stelle, die später durch einen echten API-Aufruf ersetzt wird.
- Chat ist bereits als Einzelgespräch modelliert (`Action.chat` mit
  optionalem `an`-Feld, siehe unten) — jede KI-Persönlichkeit bekommt ihren
  eigenen Gesprächsverlauf, kein Gruppenchat, den ein LLM ohnehin nur
  verwirrend fände.
- `KiProfil.persoenlichkeit` trägt schon ein optionales `kartenDaten`-Feld für
  importierte SillyTavern Character Cards V2.
- Wichtige Einschränkung, die beim Bau des LLM-Layers zu beachten ist: die
  Engine ist synchron und darf es bleiben (`dispatch` blockiert nie). Ein
  LLM-Aufruf ist async — der wird künftig in der UI-Schicht (dort, wo aktuell
  `naechsteAktion()` synchron aufgerufen wird) verortet, nicht im Reducer.

## Bekannte Vereinfachungen

Dokumentiert direkt im Code (`reducer.ts`), unter anderem:

- Einkommensteuer ist immer der Festbetrag (keine 10%-Wahlmöglichkeit).
- Bankrott gegenüber der Bank: Häuser/Hotels gehen pauschal in den Vorrat
  zurück, ohne Teilerlös.
- Der Frei-Parken-Topf (Hausregel, kein offizielles Monopoly-Regelwerk)
  sammelt Steuern, Kartenkosten und Gefängnis-Kaution; bei einer
  KI-Mitspieler-Rettung (Gnade-Einstellung) fließt das Geld direkt zwischen
  den Spielern, nicht über den Topf.
