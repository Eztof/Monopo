/**
 * Die Engine: dispatch(state, action) => ActionErgebnis.
 *
 * Reine Funktion, keine Zeit, kein await. Jede Action wird gegen die aktuelle
 * Phase geprüft; ungültige Actions werden mit einem Grund abgelehnt statt zu
 * werfen. Innerhalb einer Action wird der State geklont und frei mutiert
 * (structuredClone statt manuellem Spreading) — das hält die vielen
 * Sonderfälle lesbar, ohne die Reinheit der Funktion nach außen zu verlieren.
 *
 * Dokumentierte Vereinfachungen gegenüber dem Hasbro-Originalregelwerk:
 * - Einkommensteuer ist immer der Festbetrag (keine 10%-Wahlmöglichkeit).
 * - "Frei-Karte"-Effekte sind nicht individuell verfolgt: eine gezogene,
 *   aufbewahrte Karte fehlt im jeweiligen Stapel, bis sie benutzt wird, kehrt
 *   danach aber nicht an eine bestimmte Position zurück (der Stapel ist ein
 *   Kreislauf ohne Gedächtnis für einzelne Karten).
 * - "Wird X-Vorsitzender / hat Geburtstag" (geld-von-allen) im Unterdeckungs-
 *   fall: reicht das Geld für die Zahlung an alle nicht, läuft die Schuld
 *   vereinfacht gegen die Bank statt gegen einzelne Mitspieler.
 * - Bankrott gegenüber der Bank: Häuser/Hotels gehen pauschal in den Vorrat
 *   zurück, ohne Teilerlös.
 */
import { feldById, gruppeVonFeld, istKaufbar } from "./board";
import { karteById } from "./karten";
import { wuerfleZweiWuerfel } from "./rng";
import type {
  Action,
  ActionErgebnis,
  Auktion,
  BahnhofFeld,
  Besitzstand,
  Ereignis,
  Feld,
  GameState,
  Karte,
  Schuld,
  Spieler,
  SpielerId,
  StrassenFeld,
  WerkFeld,
} from "./types";

class RegelVerstoss extends Error {}

function pruefe(bedingung: unknown, meldung: string): asserts bedingung {
  if (!bedingung) throw new RegelVerstoss(meldung);
}

export function dispatch(state: GameState, action: Action): ActionErgebnis {
  const entwurf = structuredClone(state);
  try {
    verarbeite(entwurf, action);
    return { ok: true, state: entwurf };
  } catch (e) {
    if (e instanceof RegelVerstoss) return { ok: false, grund: e.message };
    throw e;
  }
}

// ────────────────────────────────────────────────────────────
// Kleine Helfer
// ────────────────────────────────────────────────────────────

function spieler(state: GameState, id: SpielerId): Spieler {
  const s = state.spieler.find((p) => p.id === id);
  pruefe(s, `Unbekannter Spieler: ${id}`);
  return s;
}

function eintragen(state: GameState, text: string, akteur: SpielerId | null = null, sichtbarFuer: Ereignis["sichtbarFuer"] = "alle"): void {
  state.log.push({ runde: state.runde, akteur, text, sichtbarFuer });
}

function ziehZaehler(state: GameState): number {
  const z = state.ziehungsZaehler;
  state.ziehungsZaehler += 1;
  return z;
}

function wuerfeln(state: GameState): [number, number] {
  return wuerfleZweiWuerfel(state.seed, ziehZaehler(state));
}

function nichtBankrott(state: GameState): SpielerId[] {
  return state.spieler.filter((s) => !s.bankrott).map((s) => s.id);
}

function ownerHatGruppe(state: GameState, ownerId: SpielerId, gruppeId: string): boolean {
  const gruppe = state.brett.gruppen.find((g) => g.id === gruppeId);
  return !!gruppe && gruppe.felder.every((fid) => state.besitz[fid].eigentuemer === ownerId);
}

function zaehleBesitz(state: GameState, ownerId: SpielerId, art: "bahnhof" | "werk"): number {
  return state.brett.felder.filter((f) => f.art === art && state.besitz[f.id].eigentuemer === ownerId).length;
}

function berechneBahnhofMiete(state: GameState, ownerId: SpielerId): number {
  const anzahl = zaehleBesitz(state, ownerId, "bahnhof");
  const irgendein = state.brett.felder.find((f): f is BahnhofFeld => f.art === "bahnhof");
  pruefe(irgendein, "Brett hat keine Bahnhöfe konfiguriert.");
  return irgendein.mieten[anzahl - 1];
}

function berechneMiete(state: GameState, feld: StrassenFeld | BahnhofFeld | WerkFeld, bes: Besitzstand): number {
  if (feld.art === "strasse") {
    const basis = feld.mieten[bes.haeuser];
    if (bes.haeuser === 0 && bes.eigentuemer && ownerHatGruppe(state, bes.eigentuemer, feld.gruppe)) {
      return basis * 2;
    }
    return basis;
  }
  if (feld.art === "bahnhof") {
    return berechneBahnhofMiete(state, bes.eigentuemer!);
  }
  const anzahl = zaehleBesitz(state, bes.eigentuemer!, "werk");
  const summe = (state.letzterWurf?.[0] ?? 0) + (state.letzterWurf?.[1] ?? 0);
  return feld.multiplikatoren[anzahl - 1] * summe;
}

function berechneReparaturen(state: GameState, spielerId: SpielerId, proHaus: number, proHotel: number): number {
  let summe = 0;
  for (const feld of state.brett.felder) {
    if (feld.art !== "strasse") continue;
    const bes = state.besitz[feld.id];
    if (bes.eigentuemer !== spielerId) continue;
    if (bes.haeuser >= 1 && bes.haeuser <= 4) summe += bes.haeuser * proHaus;
    if (bes.haeuser === 5) summe += proHotel;
  }
  return summe;
}

function naechstesFeldVonArt(state: GameState, vonPosition: number, art: "bahnhof" | "werk"): Feld {
  const laenge = state.brett.felder.length;
  for (let i = 1; i <= laenge; i++) {
    const feld = feldById(state.brett, (vonPosition + i) % laenge);
    if (feld.art === art) return feld;
  }
  throw new RegelVerstoss(`Brett hat kein Feld der Art ${art}.`);
}

/** Bewegt relativ (auch rückwärts). Los-Gehalt nur bei Vorwärtsbewegung über die 0. */
function bewegeUm(state: GameState, spielerId: SpielerId, delta: number): number {
  const s = spieler(state, spielerId);
  const laenge = state.brett.felder.length;
  const alt = s.position;
  let neu = (alt + delta) % laenge;
  if (neu < 0) neu += laenge;
  if (delta > 0 && neu < alt) {
    s.geld += state.brett.losGehalt;
    eintragen(state, `${s.name} zieht am Los vorbei und erhält ${state.brett.losGehalt}.`, spielerId);
  }
  s.position = neu;
  return neu;
}

/** Bewegt zu einem festen Ziel (Karteneffekt). */
function bewegeZu(state: GameState, spielerId: SpielerId, ziel: number, gewaehrtLosGehalt: boolean): void {
  const s = spieler(state, spielerId);
  const passiert = ziel === 0 || ziel < s.position;
  s.position = ziel;
  if (gewaehrtLosGehalt && passiert) {
    s.geld += state.brett.losGehalt;
    eintragen(state, `${s.name} erhält ${state.brett.losGehalt} für das Los.`, spielerId);
  }
}

function sendeInsGefaengnis(state: GameState, spielerId: SpielerId): void {
  const s = spieler(state, spielerId);
  s.position = state.brett.gefaengnisFeld;
  s.imGefaengnis = true;
  s.gefaengnisRunden = 0;
  eintragen(state, `${s.name} wandert ins Gefängnis.`, spielerId);
}

function setZugEndeOderWeiterWuerfeln(state: GameState): void {
  state.phase = state.paschInFolge > 0 ? { typ: "wuerfeln" } : { typ: "zug-ende" };
}

/** Verlangt eine Zahlung; zahlt sofort falls möglich, sonst wird `schuld-offen`. Gibt zurück, ob sofort bezahlt wurde. */
function verlangeZahlung(state: GameState, schuldnerId: SpielerId, glaeubigerId: SpielerId | null, betrag: number, grund: string): boolean {
  if (betrag <= 0) return true;
  const schuldner = spieler(state, schuldnerId);
  if (schuldner.geld >= betrag) {
    schuldner.geld -= betrag;
    if (glaeubigerId) spieler(state, glaeubigerId).geld += betrag;
    eintragen(state, `${schuldner.name} zahlt ${betrag} (${grund}).`, schuldnerId);
    return true;
  }
  const schuld: Schuld = { schuldner: schuldnerId, glaeubiger: glaeubigerId, betrag, grund };
  state.phase = { typ: "schuld-offen", schuld };
  eintragen(state, `${schuldner.name} kann ${betrag} (${grund}) nicht sofort zahlen.`, schuldnerId);
  return false;
}

function pruefeSiegbedingung(state: GameState): boolean {
  const aktive = state.spieler.filter((s) => !s.bankrott);
  if (aktive.length <= 1 && aktive.length > 0) {
    state.phase = { typ: "spiel-ende", sieger: aktive[0].id };
    eintragen(state, `${aktive[0].name} gewinnt das Spiel.`, aktive[0].id);
    return true;
  }
  return false;
}

function beendeZugUndGeheWeiter(state: GameState): void {
  if (pruefeSiegbedingung(state)) return;
  const aktive = new Set(nichtBankrott(state));
  const order = state.reihenfolge;
  const idx = order.indexOf(state.amZug);
  for (let i = 1; i <= order.length; i++) {
    const kandidat = order[(idx + i) % order.length];
    if (aktive.has(kandidat)) {
      state.amZug = kandidat;
      break;
    }
  }
  state.letzterWurf = null;
  state.paschInFolge = 0;
  state.runde += 1;
  const s = spieler(state, state.amZug);
  state.phase = s.imGefaengnis ? { typ: "gefaengnis-entscheidung" } : { typ: "wuerfeln" };
  eintragen(state, `${s.name} ist am Zug.`, s.id);
}

function ziehKarte(state: GameState, stapel: "ereignis" | "gemeinschaft"): Karte {
  const deck = stapel === "ereignis" ? state.ereignisStapel : state.gemeinschaftStapel;
  const id = deck.shift();
  pruefe(id, `Kartenstapel ${stapel} ist leer.`);
  const karte = karteById(id);
  if (!karte.behaltbar) deck.push(id);
  eintragen(state, `Karte gezogen (${stapel}): ${karte.text}`, state.amZug, "alle");
  return karte;
}

/** Löst das Betreten eines Feldes auf (normale Bewegung wie auch Kartenbewegung). */
function feldBetreten(state: GameState, spielerId: SpielerId, feldId: number): void {
  const feld = feldById(state.brett, feldId);
  switch (feld.art) {
    case "los":
    case "gefaengnis-besuch":
    case "frei-parken":
      setZugEndeOderWeiterWuerfeln(state);
      return;
    case "gehe-ins-gefaengnis":
      sendeInsGefaengnis(state, spielerId);
      state.phase = { typ: "zug-ende" };
      return;
    case "steuer": {
      const bezahlt = verlangeZahlung(state, spielerId, null, feld.betrag, feld.name);
      if (bezahlt) setZugEndeOderWeiterWuerfeln(state);
      return;
    }
    case "karte": {
      const karte = ziehKarte(state, feld.stapel);
      state.phase = { typ: "karte-bestaetigen", karte };
      return;
    }
    case "strasse":
    case "bahnhof":
    case "werk": {
      const bes = state.besitz[feld.id];
      if (bes.eigentuemer === null) {
        state.phase = { typ: "kaufentscheidung", feld: feld.id };
        return;
      }
      if (bes.eigentuemer === spielerId || bes.belastet) {
        setZugEndeOderWeiterWuerfeln(state);
        return;
      }
      const miete = berechneMiete(state, feld, bes);
      const bezahlt = verlangeZahlung(state, spielerId, bes.eigentuemer, miete, `Miete für ${feld.name}`);
      if (bezahlt) setZugEndeOderWeiterWuerfeln(state);
      return;
    }
  }
}

/** Wendet den Effekt einer bestätigten Ereignis-/Gemeinschaftskarte an. */
function wendeKartenEffektAn(state: GameState, spielerId: SpielerId, karte: Karte): void {
  const s = spieler(state, spielerId);
  const eff = karte.effekt;
  switch (eff.typ) {
    case "geld": {
      if (eff.betrag >= 0) {
        s.geld += eff.betrag;
        eintragen(state, `${s.name} erhält ${eff.betrag}.`, spielerId);
        setZugEndeOderWeiterWuerfeln(state);
      } else {
        const bezahlt = verlangeZahlung(state, spielerId, null, -eff.betrag, karte.text);
        if (bezahlt) setZugEndeOderWeiterWuerfeln(state);
      }
      return;
    }
    case "geld-von-allen": {
      const gegner = nichtBankrott(state).filter((id) => id !== spielerId);
      if (eff.betrag >= 0) {
        for (const gid of gegner) {
          const g = spieler(state, gid);
          const zahlung = Math.min(g.geld, eff.betrag);
          g.geld -= zahlung;
          s.geld += zahlung;
        }
        eintragen(state, `${s.name} erhält von jedem Mitspieler ${eff.betrag}.`, spielerId);
        setZugEndeOderWeiterWuerfeln(state);
      } else {
        const gesamt = -eff.betrag * gegner.length;
        if (s.geld >= gesamt) {
          s.geld -= gesamt;
          for (const gid of gegner) spieler(state, gid).geld += -eff.betrag;
          eintragen(state, `${s.name} zahlt jedem Mitspieler ${-eff.betrag}.`, spielerId);
          setZugEndeOderWeiterWuerfeln(state);
        } else {
          const bezahlt = verlangeZahlung(state, spielerId, null, gesamt, "Zahlung an alle Mitspieler");
          if (bezahlt) setZugEndeOderWeiterWuerfeln(state);
        }
      }
      return;
    }
    case "ziehe-zu": {
      bewegeZu(state, spielerId, eff.ziel, eff.losGehaltWennVorbei);
      feldBetreten(state, spielerId, eff.ziel);
      return;
    }
    case "ziehe-relativ": {
      const neuePos = bewegeUm(state, spielerId, eff.felder);
      feldBetreten(state, spielerId, neuePos);
      return;
    }
    case "ins-gefaengnis": {
      sendeInsGefaengnis(state, spielerId);
      state.phase = { typ: "zug-ende" };
      return;
    }
    case "frei-karte": {
      s.freiKarten += 1;
      eintragen(state, `${s.name} erhält eine Freikarte aus dem Gefängnis.`, spielerId);
      setZugEndeOderWeiterWuerfeln(state);
      return;
    }
    case "reparaturen": {
      const summe = berechneReparaturen(state, spielerId, eff.proHaus, eff.proHotel);
      const bezahlt = verlangeZahlung(state, spielerId, null, summe, karte.text);
      if (bezahlt) setZugEndeOderWeiterWuerfeln(state);
      return;
    }
    case "ziehe-zum-naechsten": {
      const ziel = naechstesFeldVonArt(state, s.position, eff.art);
      bewegeZu(state, spielerId, ziel.id, true);
      const bes = state.besitz[ziel.id];
      if (bes.eigentuemer === null) {
        state.phase = { typ: "kaufentscheidung", feld: ziel.id };
        return;
      }
      if (bes.eigentuemer === spielerId || bes.belastet) {
        setZugEndeOderWeiterWuerfeln(state);
        return;
      }
      const grundmiete = eff.art === "werk" ? (state.letzterWurf?.[0] ?? 0) + (state.letzterWurf?.[1] ?? 0) : berechneBahnhofMiete(state, bes.eigentuemer);
      const miete = grundmiete * eff.mieteFaktor;
      const bezahlt = verlangeZahlung(state, spielerId, bes.eigentuemer, miete, `Sondermiete für ${ziel.name}`);
      if (bezahlt) setZugEndeOderWeiterWuerfeln(state);
      return;
    }
  }
}

function pruefeVerwaltungsPhase(state: GameState): void {
  pruefe(
    state.phase.typ === "wuerfeln" || state.phase.typ === "zug-ende",
    "Häuser, Hypotheken usw. können nur zu Beginn oder am Ende deines eigenen Zuges verwaltet werden.",
  );
}

/** Wie pruefeVerwaltungsPhase, erlaubt aber zusätzlich `schuld-offen` — genau dann muss man
 * Häuser verkaufen oder Hypotheken aufnehmen können, um eine Schuld überhaupt begleichen zu können. */
function pruefeVerwaltungsOderSchuldPhase(state: GameState): void {
  pruefe(
    state.phase.typ === "wuerfeln" || state.phase.typ === "zug-ende" || state.phase.typ === "schuld-offen",
    "Häuser, Hypotheken usw. können nur zu Beginn/Ende deines Zuges oder bei einer offenen Schuld verwaltet werden.",
  );
}

function erlaubtWaehrendHandel(state: GameState): boolean {
  return state.phase.typ !== "auktion" && state.phase.typ !== "spiel-ende";
}

// ────────────────────────────────────────────────────────────
// Auktion
// ────────────────────────────────────────────────────────────

function verkaufeAnHoechstbietenden(state: GameState, auktion: Auktion): void {
  pruefe(auktion.hoechstbietender, "Auktion ohne Höchstbietenden kann nicht abgeschlossen werden.");
  const gewinner = spieler(state, auktion.hoechstbietender);
  gewinner.geld -= auktion.hoechstgebot;
  state.besitz[auktion.feld].eigentuemer = gewinner.id;
  const feld = feldById(state.brett, auktion.feld);
  eintragen(state, `${gewinner.name} ersteigert ${feld.name} für ${auktion.hoechstgebot}.`, gewinner.id);
  setZugEndeOderWeiterWuerfeln(state);
}

function beendeAuktionOhneVerkauf(state: GameState, auktion: Auktion): void {
  const feld = feldById(state.brett, auktion.feld);
  eintragen(state, `Niemand ersteigert ${feld.name}. Es bleibt unverkauft.`);
  setZugEndeOderWeiterWuerfeln(state);
}

// ────────────────────────────────────────────────────────────
// Haupt-Reducer
// ────────────────────────────────────────────────────────────

function verarbeite(state: GameState, action: Action): void {
  switch (action.typ) {
    case "wuerfeln": {
      pruefe(state.phase.typ === "wuerfeln" || state.phase.typ === "gefaengnis-entscheidung", "Du kannst gerade nicht würfeln.");
      const s = spieler(state, state.amZug);

      if (state.phase.typ === "gefaengnis-entscheidung") {
        const [w1, w2] = wuerfeln(state);
        state.letzterWurf = [w1, w2];
        eintragen(state, `${s.name} würfelt im Gefängnis ${w1} und ${w2}.`, s.id);
        if (w1 === w2) {
          s.imGefaengnis = false;
          s.gefaengnisRunden = 0;
          eintragen(state, `${s.name} würfelt einen Pasch und kommt frei.`, s.id);
          const neuePos = bewegeUm(state, s.id, w1 + w2);
          feldBetreten(state, s.id, neuePos);
          return;
        }
        s.gefaengnisRunden += 1;
        if (s.gefaengnisRunden >= 3) {
          const bezahlt = verlangeZahlung(state, s.id, null, state.brett.gefaengnisKaution, "Kaution (dritter Fehlversuch)");
          if (bezahlt) {
            s.imGefaengnis = false;
            s.gefaengnisRunden = 0;
            const neuePos = bewegeUm(state, s.id, w1 + w2);
            feldBetreten(state, s.id, neuePos);
          }
          return;
        }
        eintragen(state, `${s.name} bleibt im Gefängnis (Versuch ${s.gefaengnisRunden}/3).`, s.id);
        state.phase = { typ: "zug-ende" };
        return;
      }

      const [w1, w2] = wuerfeln(state);
      state.letzterWurf = [w1, w2];
      eintragen(state, `${s.name} würfelt ${w1} und ${w2}.`, s.id);
      if (w1 === w2) {
        if (state.paschInFolge === 2) {
          state.paschInFolge = 0;
          eintragen(state, `${s.name} würfelt den dritten Pasch in Folge.`, s.id);
          sendeInsGefaengnis(state, s.id);
          state.phase = { typ: "zug-ende" };
          return;
        }
        state.paschInFolge = (state.paschInFolge + 1) as 0 | 1 | 2;
      } else {
        state.paschInFolge = 0;
      }
      const neuePos = bewegeUm(state, s.id, w1 + w2);
      feldBetreten(state, s.id, neuePos);
      return;
    }

    case "weiter": {
      pruefe(state.phase.typ === "karte-bestaetigen", "Es gibt nichts zu bestätigen.");
      wendeKartenEffektAn(state, state.amZug, state.phase.karte);
      return;
    }

    case "kaution-zahlen": {
      pruefe(state.phase.typ === "gefaengnis-entscheidung", "Kaution kann nur zu Beginn deines Zuges gezahlt werden.");
      const s = spieler(state, state.amZug);
      pruefe(s.geld >= state.brett.gefaengnisKaution, "Nicht genug Geld für die Kaution.");
      s.geld -= state.brett.gefaengnisKaution;
      s.imGefaengnis = false;
      s.gefaengnisRunden = 0;
      eintragen(state, `${s.name} zahlt die Kaution und ist frei.`, s.id);
      state.phase = { typ: "wuerfeln" };
      return;
    }

    case "frei-karte-nutzen": {
      pruefe(state.phase.typ === "gefaengnis-entscheidung", "Die Freikarte hilft dir gerade nicht.");
      const s = spieler(state, state.amZug);
      pruefe(s.freiKarten > 0, "Du hast keine Freikarte.");
      s.freiKarten -= 1;
      s.imGefaengnis = false;
      s.gefaengnisRunden = 0;
      eintragen(state, `${s.name} nutzt eine Freikarte.`, s.id);
      state.phase = { typ: "wuerfeln" };
      return;
    }

    case "kaufen": {
      pruefe(state.phase.typ === "kaufentscheidung", "Gerade steht kein Kauf an.");
      const feld = feldById(state.brett, state.phase.feld);
      pruefe(istKaufbar(feld), "Dieses Feld ist nicht kaufbar.");
      const s = spieler(state, state.amZug);
      pruefe(s.geld >= feld.kaufpreis, "Nicht genug Geld.");
      s.geld -= feld.kaufpreis;
      state.besitz[feld.id].eigentuemer = s.id;
      eintragen(state, `${s.name} kauft ${feld.name} für ${feld.kaufpreis}.`, s.id);
      setZugEndeOderWeiterWuerfeln(state);
      return;
    }

    case "auktion-starten": {
      pruefe(state.phase.typ === "kaufentscheidung", "Gerade steht keine Auktion an.");
      const feldId = state.phase.feld;
      const order = state.reihenfolge;
      const startIdx = (order.indexOf(state.amZug) + 1) % order.length;
      const rotiert = [...order.slice(startIdx), ...order.slice(0, startIdx)].filter((id) => nichtBankrott(state).includes(id));
      pruefe(rotiert.length > 0, "Keine Bieter verfügbar.");
      const auktion: Auktion = { feld: feldId, hoechstgebot: 0, hoechstbietender: null, aktiveBieter: rotiert, amZug: rotiert[0] };
      state.phase = { typ: "auktion", auktion };
      eintragen(state, `Auktion für ${feldById(state.brett, feldId).name} beginnt.`);
      return;
    }

    case "bieten": {
      pruefe(state.phase.typ === "auktion", "Gerade läuft keine Auktion.");
      const auktion = state.phase.auktion;
      const bieter = spieler(state, auktion.amZug);
      pruefe(action.betrag > auktion.hoechstgebot, "Das Gebot muss höher als das aktuelle Höchstgebot sein.");
      pruefe(bieter.geld >= action.betrag, "Nicht genug Geld für dieses Gebot.");
      auktion.hoechstgebot = action.betrag;
      auktion.hoechstbietender = bieter.id;
      eintragen(state, `${bieter.name} bietet ${action.betrag}.`, bieter.id);
      const idx = auktion.aktiveBieter.indexOf(bieter.id);
      auktion.amZug = auktion.aktiveBieter[(idx + 1) % auktion.aktiveBieter.length];
      if (auktion.aktiveBieter.length === 1) verkaufeAnHoechstbietenden(state, auktion);
      return;
    }

    case "aussteigen": {
      pruefe(state.phase.typ === "auktion", "Gerade läuft keine Auktion.");
      const auktion = state.phase.auktion;
      const bieter = spieler(state, auktion.amZug);
      const idx = auktion.aktiveBieter.indexOf(bieter.id);
      pruefe(idx >= 0, "Du bietest hier nicht mit.");
      auktion.aktiveBieter.splice(idx, 1);
      eintragen(state, `${bieter.name} steigt aus der Auktion aus.`, bieter.id);
      if (auktion.aktiveBieter.length === 0) {
        beendeAuktionOhneVerkauf(state, auktion);
        return;
      }
      if (auktion.aktiveBieter.length === 1) {
        if (auktion.hoechstbietender === auktion.aktiveBieter[0]) {
          verkaufeAnHoechstbietenden(state, auktion);
        } else {
          auktion.amZug = auktion.aktiveBieter[0];
        }
        return;
      }
      auktion.amZug = auktion.aktiveBieter[idx % auktion.aktiveBieter.length];
      return;
    }

    case "haus-bauen": {
      pruefeVerwaltungsPhase(state);
      const feld = feldById(state.brett, action.feld);
      pruefe(feld.art === "strasse", "Häuser gibt es nur auf Straßen.");
      const bes = state.besitz[feld.id];
      pruefe(bes.eigentuemer === state.amZug, "Du besitzt dieses Feld nicht.");
      pruefe(!bes.belastet, "Das Feld ist mit einer Hypothek belastet.");
      const gruppe = gruppeVonFeld(state.brett, feld.id);
      pruefe(gruppe, "Feld gehört zu keiner Farbgruppe.");
      pruefe(
        gruppe.felder.every((fid) => state.besitz[fid].eigentuemer === state.amZug),
        "Du benötigst die gesamte Farbgruppe.",
      );
      pruefe(
        gruppe.felder.every((fid) => !state.besitz[fid].belastet),
        "Keine Straße der Farbgruppe darf mit einer Hypothek belastet sein.",
      );
      pruefe(bes.haeuser < 5, "Hier steht bereits ein Hotel.");
      const s = spieler(state, state.amZug);
      if (bes.haeuser < 4) {
        const minInGruppe = Math.min(...gruppe.felder.map((fid) => state.besitz[fid].haeuser));
        pruefe(bes.haeuser === minInGruppe, "Häuser müssen gleichmäßig über die Farbgruppe verteilt werden.");
        pruefe(state.haeuserImVorrat >= 1, "Keine Häuser mehr im Vorrat.");
        pruefe(s.geld >= feld.hauspreis, "Nicht genug Geld.");
        s.geld -= feld.hauspreis;
        bes.haeuser = (bes.haeuser + 1) as 0 | 1 | 2 | 3 | 4 | 5;
        state.haeuserImVorrat -= 1;
        eintragen(state, `${s.name} baut ein Haus auf ${feld.name}.`, s.id);
      } else {
        pruefe(
          gruppe.felder.every((fid) => state.besitz[fid].haeuser === 4),
          "Alle Straßen der Farbgruppe brauchen erst vier Häuser.",
        );
        pruefe(state.hotelsImVorrat >= 1, "Keine Hotels mehr im Vorrat.");
        pruefe(s.geld >= feld.hauspreis, "Nicht genug Geld.");
        s.geld -= feld.hauspreis;
        bes.haeuser = 5;
        state.hotelsImVorrat -= 1;
        state.haeuserImVorrat += 4;
        eintragen(state, `${s.name} baut ein Hotel auf ${feld.name}.`, s.id);
      }
      return;
    }

    case "haus-verkaufen": {
      pruefeVerwaltungsOderSchuldPhase(state);
      const feld = feldById(state.brett, action.feld);
      pruefe(feld.art === "strasse", "Häuser gibt es nur auf Straßen.");
      const bes = state.besitz[feld.id];
      pruefe(bes.eigentuemer === state.amZug, "Du besitzt dieses Feld nicht.");
      pruefe(bes.haeuser > 0, "Hier steht kein Haus.");
      const gruppe = gruppeVonFeld(state.brett, feld.id);
      pruefe(gruppe, "Feld gehört zu keiner Farbgruppe.");
      const s = spieler(state, state.amZug);
      if (bes.haeuser === 5) {
        pruefe(state.haeuserImVorrat >= 4, "Nicht genug Häuser im Vorrat, um das Hotel umzuwandeln.");
        bes.haeuser = 4;
        state.hotelsImVorrat += 1;
        state.haeuserImVorrat -= 4;
      } else {
        const maxInGruppe = Math.max(...gruppe.felder.map((fid) => state.besitz[fid].haeuser));
        pruefe(bes.haeuser === maxInGruppe, "Verkaufe zuerst von der am stärksten bebauten Straße der Farbgruppe.");
        bes.haeuser = (bes.haeuser - 1) as 0 | 1 | 2 | 3 | 4 | 5;
        state.haeuserImVorrat += 1;
      }
      s.geld += Math.floor(feld.hauspreis / 2);
      eintragen(state, `${s.name} verkauft ein Haus/Hotel auf ${feld.name}.`, s.id);
      return;
    }

    case "hypothek-aufnehmen": {
      pruefeVerwaltungsOderSchuldPhase(state);
      const feld = feldById(state.brett, action.feld);
      pruefe(istKaufbar(feld), "Dieses Feld kann nicht belastet werden.");
      const bes = state.besitz[feld.id];
      pruefe(bes.eigentuemer === state.amZug, "Du besitzt dieses Feld nicht.");
      pruefe(!bes.belastet, "Feld ist bereits mit einer Hypothek belastet.");
      if (feld.art === "strasse") pruefe(bes.haeuser === 0, "Erst alle Häuser auf der Straße verkaufen.");
      const s = spieler(state, state.amZug);
      s.geld += feld.hypothekenwert;
      bes.belastet = true;
      eintragen(state, `${s.name} nimmt eine Hypothek auf ${feld.name} auf (${feld.hypothekenwert}).`, s.id);
      return;
    }

    case "hypothek-abloesen": {
      pruefeVerwaltungsPhase(state);
      const feld = feldById(state.brett, action.feld);
      pruefe(istKaufbar(feld), "Dieses Feld hat keine Hypothek.");
      const bes = state.besitz[feld.id];
      pruefe(bes.eigentuemer === state.amZug, "Du besitzt dieses Feld nicht.");
      pruefe(bes.belastet, "Feld ist nicht belastet.");
      const kosten = Math.ceil(feld.hypothekenwert * 1.1);
      const s = spieler(state, state.amZug);
      pruefe(s.geld >= kosten, "Nicht genug Geld, um die Hypothek abzulösen.");
      s.geld -= kosten;
      bes.belastet = false;
      eintragen(state, `${s.name} löst die Hypothek auf ${feld.name} ab (${kosten}).`, s.id);
      return;
    }

    case "schuld-begleichen": {
      pruefe(state.phase.typ === "schuld-offen", "Es gibt keine offene Schuld.");
      const { schuld } = state.phase;
      const s = spieler(state, schuld.schuldner);
      pruefe(s.geld >= schuld.betrag, "Nicht genug Geld, um die Schuld zu begleichen.");
      s.geld -= schuld.betrag;
      if (schuld.glaeubiger) spieler(state, schuld.glaeubiger).geld += schuld.betrag;
      eintragen(state, `${s.name} begleicht eine Schuld von ${schuld.betrag} (${schuld.grund}).`, schuld.schuldner);
      if (schuld.grund.startsWith("Kaution")) {
        s.imGefaengnis = false;
        s.gefaengnisRunden = 0;
        pruefe(state.letzterWurf, "Kein gemerkter Wurf für die Freilassung vorhanden.");
        const [w1, w2] = state.letzterWurf;
        const neuePos = bewegeUm(state, schuld.schuldner, w1 + w2);
        feldBetreten(state, schuld.schuldner, neuePos);
      } else {
        setZugEndeOderWeiterWuerfeln(state);
      }
      return;
    }

    case "bankrott-erklaeren": {
      pruefe(state.phase.typ === "schuld-offen", "Bankrott kannst du nur bei einer offenen Schuld erklären.");
      const { schuld } = state.phase;
      const verlierer = spieler(state, schuld.schuldner);
      verlierer.bankrott = true;
      if (schuld.glaeubiger) {
        const gewinner = spieler(state, schuld.glaeubiger);
        gewinner.geld += Math.max(0, verlierer.geld);
        gewinner.freiKarten += verlierer.freiKarten;
        for (const feld of state.brett.felder) {
          if (istKaufbar(feld) && state.besitz[feld.id].eigentuemer === verlierer.id) {
            state.besitz[feld.id].eigentuemer = gewinner.id;
          }
        }
      } else {
        for (const feld of state.brett.felder) {
          if (!istKaufbar(feld)) continue;
          const bes = state.besitz[feld.id];
          if (bes.eigentuemer !== verlierer.id) continue;
          if (bes.haeuser === 5) {
            state.hotelsImVorrat += 1;
          } else if (bes.haeuser > 0) {
            state.haeuserImVorrat += bes.haeuser;
          }
          bes.eigentuemer = null;
          bes.belastet = false;
          bes.haeuser = 0;
        }
      }
      verlierer.geld = 0;
      verlierer.freiKarten = 0;
      state.offeneAngebote = state.offeneAngebote.filter((a) => a.von !== verlierer.id && a.an !== verlierer.id);
      eintragen(state, `${verlierer.name} ist bankrott.`, verlierer.id);
      if (pruefeSiegbedingung(state)) return;
      if (verlierer.id === state.amZug) {
        beendeZugUndGeheWeiter(state);
      } else {
        state.phase = { typ: "zug-ende" };
      }
      return;
    }

    case "zug-beenden": {
      pruefe(state.phase.typ === "zug-ende", "Der Zug ist noch nicht abgeschlossen.");
      beendeZugUndGeheWeiter(state);
      return;
    }

    case "handel-anbieten": {
      pruefe(erlaubtWaehrendHandel(state), "Gerade sind keine Handelsangebote möglich.");
      const { angebot } = action;
      pruefe(angebot.von !== angebot.an, "Man kann nicht mit sich selbst handeln.");
      const von = spieler(state, angebot.von);
      const an = spieler(state, angebot.an);
      pruefe(!von.bankrott && !an.bankrott, "Bankrotte Spieler können nicht handeln.");
      pruefe(
        angebot.gebeFelder.every((f) => state.besitz[f]?.eigentuemer === von.id),
        "Angebotene Felder gehören nicht dem Anbieter.",
      );
      pruefe(
        angebot.willFelder.every((f) => state.besitz[f]?.eigentuemer === an.id),
        "Gewünschte Felder gehören nicht dem Empfänger.",
      );
      pruefe(
        angebot.gebeGeld >= 0 && angebot.willGeld >= 0 && angebot.gebeFreiKarten >= 0 && angebot.willFreiKarten >= 0,
        "Beträge dürfen nicht negativ sein.",
      );
      const id = `handel-${state.ziehungsZaehler}-${state.offeneAngebote.length}`;
      state.offeneAngebote.push({ ...angebot, id });
      eintragen(state, `${von.name} bietet ${an.name} einen Handel an.`, von.id, [von.id, an.id]);
      return;
    }

    case "handel-annehmen": {
      const angebot = state.offeneAngebote.find((a) => a.id === action.angebotId);
      pruefe(angebot, "Dieses Handelsangebot existiert nicht mehr.");
      const von = spieler(state, angebot.von);
      const an = spieler(state, angebot.an);
      pruefe(
        angebot.gebeFelder.every((f) => state.besitz[f]?.eigentuemer === von.id),
        "Der Anbieter besitzt die Felder nicht mehr.",
      );
      pruefe(
        angebot.willFelder.every((f) => state.besitz[f]?.eigentuemer === an.id),
        "Der Empfänger besitzt die gewünschten Felder nicht mehr.",
      );
      pruefe(von.geld >= angebot.gebeGeld, "Der Anbieter hat nicht mehr genug Geld.");
      pruefe(an.geld >= angebot.willGeld, "Du hast nicht genug Geld für diesen Handel.");
      pruefe(von.freiKarten >= angebot.gebeFreiKarten, "Der Anbieter hat nicht mehr genug Freikarten.");
      pruefe(an.freiKarten >= angebot.willFreiKarten, "Du hast nicht genug Freikarten.");

      for (const f of angebot.gebeFelder) state.besitz[f].eigentuemer = an.id;
      for (const f of angebot.willFelder) state.besitz[f].eigentuemer = von.id;
      von.geld += angebot.willGeld - angebot.gebeGeld;
      an.geld += angebot.gebeGeld - angebot.willGeld;
      von.freiKarten += angebot.willFreiKarten - angebot.gebeFreiKarten;
      an.freiKarten += angebot.gebeFreiKarten - angebot.willFreiKarten;

      state.offeneAngebote = state.offeneAngebote.filter((a) => a.id !== angebot.id);
      eintragen(state, `${an.name} nimmt den Handel von ${von.name} an.`, an.id, [von.id, an.id]);
      return;
    }

    case "handel-ablehnen": {
      const angebot = state.offeneAngebote.find((a) => a.id === action.angebotId);
      if (!angebot) return;
      state.offeneAngebote = state.offeneAngebote.filter((a) => a.id !== action.angebotId);
      eintragen(state, action.nachricht ? `Handel abgelehnt: ${action.nachricht}` : "Ein Handelsangebot wurde abgelehnt.", null, [
        angebot.von,
        angebot.an,
      ]);
      return;
    }

    case "chat": {
      eintragen(state, action.text, action.von, "alle");
      return;
    }
  }
}
