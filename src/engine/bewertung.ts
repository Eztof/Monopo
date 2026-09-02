/**
 * Reine Bewertungsfunktionen. Rechnen keine Aktionen aus, nur Zahlen —
 * das ist bewusst getrennt vom Bot (bot.ts) und später von der KiKontext.bewertung,
 * die dem LLM vorgerechnete Optionen liefert. So kann Cydonia & Co. nicht
 * falsch rechnen: sie wählt und formuliert nur, was hier schon feststeht.
 */
import { gruppeVonFeld, istKaufbar } from "./board";
import type { GameState, Handelsangebot, KaufbaresFeld, KiProfil, SpielerId } from "./types";

/** Grober Marktwert eines Feldes: Kaufpreis plus Bonus, wenn es die Farbgruppe komplettieren würde. */
export function schaetzeFeldWert(state: GameState, spielerId: SpielerId, feld: KaufbaresFeld): number {
  let wert = feld.kaufpreis;
  const gruppe = gruppeVonFeld(state.brett, feld.id);
  if (gruppe) {
    const eigeneImVerbund = gruppe.felder.filter((fid) => state.besitz[fid].eigentuemer === spielerId).length;
    const fremdeImVerbund = gruppe.felder.filter((fid) => {
      const e = state.besitz[fid].eigentuemer;
      return e !== null && e !== spielerId;
    }).length;
    // Würde dieser Kauf die Gruppe komplettieren: deutlich wertvoller (Baurecht).
    if (fremdeImVerbund === 0 && eigeneImVerbund === gruppe.felder.length - 1) {
      wert *= 2.5;
    } else if (fremdeImVerbund > 0) {
      // Gehört größtenteils einem Gegner: Blockadewert statt Baupotenzial.
      wert *= 1.2;
    }
  }
  return wert;
}

/** Ob die KI ein unbebautes Feld kaufen soll. */
export function kaufEntscheidung(
  state: GameState,
  spielerId: SpielerId,
  feld: KaufbaresFeld,
  schwierigkeit: KiProfil["schwierigkeit"],
): { kaufen: boolean; begruendung: string } {
  const spieler = state.spieler.find((p) => p.id === spielerId)!;
  if (spieler.geld < feld.kaufpreis) {
    return { kaufen: false, begruendung: "Zu wenig Bargeld." };
  }
  // Risikobereitschaft schrumpft den nötigen Cash-Puffer — bis zu 60% weniger bei voller Risikofreude.
  const puffer = schwierigkeit.liquiditaetspuffer * 100 * (1 - schwierigkeit.risikobereitschaft * 0.6);
  const geldNachKauf = spieler.geld - feld.kaufpreis;
  const wert = schaetzeFeldWert(state, spielerId, feld);
  const lohntSich = wert >= feld.kaufpreis * 0.9;
  if (geldNachKauf >= puffer && lohntSich) {
    return { kaufen: true, begruendung: "Preis und Lage passen, genug Reserve bleibt übrig." };
  }
  // Bei geringer Bewertungstiefe (leichte KI) wird trotzdem oft gekauft — sie rechnet kaum nach.
  if (schwierigkeit.bewertungstiefe < 0.3 && geldNachKauf >= 0) {
    return { kaufen: true, begruendung: "Kauft opportunistisch, ohne lange zu rechnen." };
  }
  return { kaufen: false, begruendung: "Zu knapp bei Kasse oder das Feld lohnt sich gerade nicht." };
}

/** Wie viel die KI in einer Auktion höchstens bietet (oder null = sofort aussteigen). */
export function bietGrenze(
  state: GameState,
  spielerId: SpielerId,
  feld: KaufbaresFeld,
  schwierigkeit: KiProfil["schwierigkeit"],
): number {
  const wert = schaetzeFeldWert(state, spielerId, feld);
  const puffer = schwierigkeit.liquiditaetspuffer * 100 * (1 - schwierigkeit.risikobereitschaft * 0.6);
  const spieler = state.spieler.find((p) => p.id === spielerId)!;
  // Risikofreudige Bots gehen bei einer Auktion auch mal über den reinen Marktwert hinaus.
  const bereitschaft = wert * schwierigkeit.handelsmarge * (1 + schwierigkeit.risikobereitschaft * 0.3);
  return Math.max(0, Math.min(bereitschaft, spieler.geld - puffer));
}

/** Grober Geldwert eines Handelspakets aus Sicht des Empfängers. */
function paketWert(state: GameState, felder: number[], geld: number, freiKarten: number, empfaengerId: SpielerId): number {
  let summe = geld + freiKarten * 60;
  for (const fid of felder) {
    const feld = state.brett.felder.find((f) => f.id === fid);
    if (feld && istKaufbar(feld)) summe += schaetzeFeldWert(state, empfaengerId, feld);
  }
  return summe;
}

/**
 * Ob die KI (als Empfänger `an`) ein eingehendes Handelsangebot annehmen sollte.
 * `zusatzMarge` ist der Hebel für die Gnade-Einstellung (bot.ts): >1 macht die KI wählerischer
 * (erbarmungslos), <1 großzügiger (mitleidend/spielerschonend) — unabhängig von der Schwierigkeit.
 */
export function bewerteHandelsangebot(
  state: GameState,
  angebot: Handelsangebot,
  schwierigkeit: KiProfil["schwierigkeit"],
  zusatzMarge = 1,
): boolean {
  const erhalten = paketWert(state, angebot.gebeFelder, angebot.gebeGeld, angebot.gebeFreiKarten, angebot.an);
  const abgegeben = paketWert(state, angebot.willFelder, angebot.willGeld, angebot.willFreiKarten, angebot.an);
  return erhalten >= abgegeben * schwierigkeit.handelsmarge * zusatzMarge;
}
