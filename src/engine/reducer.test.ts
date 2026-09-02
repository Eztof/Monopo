import { describe, expect, it } from "vitest";
import { dispatch } from "./reducer";
import { erzeugeSpiel, type Spielerkonfiguration } from "./state";
import { wuerfleZweiWuerfel } from "./rng";
import type { GameState } from "./types";

function spiel(spielerIds: string[] = ["a", "b"], seed = "test-seed"): GameState {
  const konfig: Spielerkonfiguration[] = spielerIds.map((id) => ({
    id,
    name: id.toUpperCase(),
    farbe: "#000",
    steuerung: "mensch",
  }));
  return erzeugeSpiel({ spieler: konfig, seed });
}

/** Sucht einen Seed, bei dem der erste Wurf (Zähler 3) ein Pasch ist oder nicht — für deterministische Tests. */
function seedFuerWurf(gesuchtPasch: boolean): string {
  for (let i = 0; i < 1000; i++) {
    const kandidat = `seed-${i}`;
    const [w1, w2] = wuerfleZweiWuerfel(kandidat, 3);
    if (gesuchtPasch === (w1 === w2)) return kandidat;
  }
  throw new Error("Kein passender Seed gefunden.");
}

describe("Kauf", () => {
  it("zieht den Kaufpreis ab und setzt den Eigentümer", () => {
    const state = spiel();
    state.phase = { typ: "kaufentscheidung", feld: 1 };
    const ergebnis = dispatch(state, { typ: "kaufen" });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.state.spieler[0].geld).toBe(1500 - 60);
    expect(ergebnis.state.besitz[1].eigentuemer).toBe("a");
    expect(ergebnis.state.phase.typ).toBe("zug-ende");
  });

  it("lehnt einen Kauf ohne genug Geld ab", () => {
    const state = spiel();
    state.spieler[0].geld = 10;
    state.phase = { typ: "kaufentscheidung", feld: 1 };
    const ergebnis = dispatch(state, { typ: "kaufen" });
    expect(ergebnis.ok).toBe(false);
  });
});

describe("Miete", () => {
  it("wird beim Landen auf einem fremden Feld fällig und automatisch bezahlt", () => {
    const seed = "miete-seed";
    let state = spiel(["a", "b"], seed);
    state.besitz[1].eigentuemer = "a";
    state.amZug = "b";
    state.phase = { typ: "wuerfeln" };
    const [w1, w2] = wuerfleZweiWuerfel(seed, state.ziehungsZaehler);
    const summe = w1 + w2;
    state.spieler[1].position = (((1 - summe) % 40) + 40) % 40;
    const geldVorher = state.spieler[1].geld;
    const vermieterVorher = state.spieler[0].geld;

    const ergebnis = dispatch(state, { typ: "wuerfeln" });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    const miete = 2; // Ulmenweg, unbebaut, kein Monopol
    // Feld 1 liegt kurz hinter dem Los; bei diesem Startwert wird beim Ziehen am Los vorbeigekommen.
    expect(ergebnis.state.spieler[1].geld).toBe(geldVorher + 200 - miete);
    expect(ergebnis.state.spieler[0].geld).toBe(vermieterVorher + miete);
  });

  it("verdoppelt die Miete bei einem kompletten, unbebauten Monopol", () => {
    const seed = "miete-monopol-seed";
    const state = spiel(["a", "b"], seed);
    state.besitz[1].eigentuemer = "a";
    state.besitz[3].eigentuemer = "a";
    state.amZug = "b";
    state.phase = { typ: "wuerfeln" };
    const [w1, w2] = wuerfleZweiWuerfel(seed, state.ziehungsZaehler);
    const summe = w1 + w2;
    state.spieler[1].position = (((1 - summe) % 40) + 40) % 40;
    const geldVorher = state.spieler[1].geld;

    const ergebnis = dispatch(state, { typ: "wuerfeln" });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.state.spieler[1].geld).toBe(geldVorher + 200 - 4); // 2 * 2 wegen Monopol, plus Los-Gehalt
  });
});

describe("Auktion", () => {
  it("verkauft am Ende an den Höchstbietenden", () => {
    const state = spiel(["a", "b", "c"]);
    state.amZug = "a";
    state.phase = { typ: "kaufentscheidung", feld: 1 };

    let r = dispatch(state, { typ: "auktion-starten" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase.typ).toBe("auktion");
    if (r.state.phase.typ !== "auktion") return;
    expect(r.state.phase.auktion.aktiveBieter).toEqual(["b", "c", "a"]);
    expect(r.state.phase.auktion.amZug).toBe("b");

    r = dispatch(r.state, { typ: "bieten", betrag: 50 });
    expect(r.ok).toBe(true);
    if (!r.ok || r.state.phase.typ !== "auktion") return;
    expect(r.state.phase.auktion.amZug).toBe("c");

    r = dispatch(r.state, { typ: "bieten", betrag: 100 });
    expect(r.ok).toBe(true);
    if (!r.ok || r.state.phase.typ !== "auktion") return;
    expect(r.state.phase.auktion.amZug).toBe("a");

    r = dispatch(r.state, { typ: "aussteigen" });
    expect(r.ok).toBe(true);
    if (!r.ok || r.state.phase.typ !== "auktion") return;
    expect(r.state.phase.auktion.aktiveBieter).toEqual(["b", "c"]);

    r = dispatch(r.state, { typ: "aussteigen" }); // b steigt aus (amZug ist jetzt b, siehe Rotation)
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    expect(r.state.phase.typ).toBe("zug-ende");
    expect(r.state.besitz[1].eigentuemer).toBe("c");
    expect(r.state.spieler.find((s) => s.id === "c")!.geld).toBe(1500 - 100);
  });
});

describe("Gefängnis", () => {
  it("erzwingt nach drei Fehlversuchen die Kaution und friert bei Geldmangel als Schuld ein", () => {
    const seed = seedFuerWurf(false);
    const state = spiel(["a", "b"], seed);
    state.amZug = "b";
    state.spieler[1].imGefaengnis = true;
    state.spieler[1].gefaengnisRunden = 2;
    state.spieler[1].geld = 30;
    state.phase = { typ: "gefaengnis-entscheidung" };

    const ergebnis = dispatch(state, { typ: "wuerfeln" });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.state.phase.typ).toBe("schuld-offen");
    expect(ergebnis.state.spieler[1].imGefaengnis).toBe(true);

    ergebnis.state.spieler[1].geld = 2000;
    const bezahlt = dispatch(ergebnis.state, { typ: "schuld-begleichen" });
    expect(bezahlt.ok).toBe(true);
    if (!bezahlt.ok) return;
    expect(bezahlt.state.spieler[1].imGefaengnis).toBe(false);
    expect(bezahlt.state.spieler[1].geld).toBeLessThanOrEqual(2000 - 50);
  });

  it("lässt bei einem Pasch sofort frei", () => {
    const seed = seedFuerWurf(true);
    const state = spiel(["a", "b"], seed);
    state.amZug = "b";
    state.spieler[1].imGefaengnis = true;
    state.spieler[1].position = 10;
    state.phase = { typ: "gefaengnis-entscheidung" };

    const ergebnis = dispatch(state, { typ: "wuerfeln" });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.state.spieler[1].imGefaengnis).toBe(false);
  });
});

describe("Hypothek", () => {
  it("nimmt Geld auf und verlangt Zinsen bei der Ablösung", () => {
    let state = spiel();
    state.besitz[1].eigentuemer = "a";
    state.phase = { typ: "wuerfeln" };

    let r = dispatch(state, { typ: "hypothek-aufnehmen", feld: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.spieler[0].geld).toBe(1500 + 30);
    expect(r.state.besitz[1].belastet).toBe(true);

    r = dispatch(r.state, { typ: "hypothek-abloesen", feld: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.besitz[1].belastet).toBe(false);
    expect(r.state.spieler[0].geld).toBe(1500 + 30 - Math.ceil(30 * 1.1));
  });
});

describe("Hausbau", () => {
  it("erzwingt gleichmäßigen Ausbau und verlangt vier Häuser vor dem Hotel", () => {
    let state = spiel();
    state.besitz[1].eigentuemer = "a";
    state.besitz[3].eigentuemer = "a";
    state.phase = { typ: "wuerfeln" };

    // Zweites Haus auf Feld 1 bauen, bevor Feld 3 überhaupt eins hat -> verboten.
    let r = dispatch(state, { typ: "haus-bauen", feld: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    r = dispatch(r.state, { typ: "haus-bauen", feld: 1 });
    expect(r.ok).toBe(false);

    r = dispatch(state, { typ: "haus-bauen", feld: 1 });
    if (!r.ok) throw new Error("unerwartet fehlgeschlagen");
    r = dispatch(r.state, { typ: "haus-bauen", feld: 3 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.besitz[1].haeuser).toBe(1);
    expect(r.state.besitz[3].haeuser).toBe(1);

    // Auf vier Häuser je Straße hochbauen.
    for (let i = 0; i < 3; i++) {
      r = dispatch(r.state, { typ: "haus-bauen", feld: 1 });
      if (!r.ok) throw new Error(String((r as { grund: string }).grund));
      r = dispatch(r.state, { typ: "haus-bauen", feld: 3 });
      if (!r.ok) throw new Error(String((r as { grund: string }).grund));
    }
    expect(r.state.besitz[1].haeuser).toBe(4);
    expect(r.state.besitz[3].haeuser).toBe(4);

    // Hotel auf Feld 1: erlaubt, weil beide bei 4 Häusern stehen.
    r = dispatch(r.state, { typ: "haus-bauen", feld: 1 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.besitz[1].haeuser).toBe(5);
    expect(r.state.hotelsImVorrat).toBe(12 - 1);
    // 8 Häuser wurden verbaut (4 je Straße), beim Hotelbau kommen 4 davon in den Vorrat zurück.
    expect(r.state.haeuserImVorrat).toBe(32 - 8 + 4);
  });
});

describe("Bankrott", () => {
  it("überträgt Besitz an den Gläubiger und beendet das Spiel bei nur einem verbleibenden Spieler", () => {
    const state = spiel(["a", "b"]);
    state.besitz[1].eigentuemer = "b";
    state.amZug = "a";
    state.spieler[0].geld = 5;
    state.phase = { typ: "schuld-offen", schuld: { schuldner: "a", glaeubiger: "b", betrag: 100, grund: "Test" } };

    const ergebnis = dispatch(state, { typ: "bankrott-erklaeren" });
    expect(ergebnis.ok).toBe(true);
    if (!ergebnis.ok) return;
    expect(ergebnis.state.spieler[0].bankrott).toBe(true);
    expect(ergebnis.state.besitz[1].eigentuemer).toBe("b");
    expect(ergebnis.state.phase.typ).toBe("spiel-ende");
    if (ergebnis.state.phase.typ === "spiel-ende") {
      expect(ergebnis.state.phase.sieger).toBe("b");
    }
  });
});

describe("Handel", () => {
  it("tauscht Felder, Geld und Freikarten beim Annehmen", () => {
    let state = spiel(["a", "b"]);
    state.besitz[1].eigentuemer = "a";
    state.besitz[6].eigentuemer = "b";

    let r = dispatch(state, {
      typ: "handel-anbieten",
      angebot: {
        von: "a",
        an: "b",
        gebeFelder: [1],
        gebeGeld: 0,
        gebeFreiKarten: 0,
        willFelder: [6],
        willGeld: 20,
        willFreiKarten: 0,
      },
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.offeneAngebote).toHaveLength(1);
    const id = r.state.offeneAngebote[0].id;

    r = dispatch(r.state, { typ: "handel-annehmen", angebotId: id });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.besitz[1].eigentuemer).toBe("b");
    expect(r.state.besitz[6].eigentuemer).toBe("a");
    expect(r.state.spieler.find((s) => s.id === "a")!.geld).toBe(1500 + 20);
    expect(r.state.spieler.find((s) => s.id === "b")!.geld).toBe(1500 - 20);
    expect(r.state.offeneAngebote).toHaveLength(0);
  });

  it("Handelsankündigungen sind öffentlich, nicht nur für die Beteiligten sichtbar", () => {
    const state = spiel(["a", "b"]);
    state.besitz[1].eigentuemer = "a";
    const r = dispatch(state, {
      typ: "handel-anbieten",
      angebot: { von: "a", an: "b", gebeFelder: [1], gebeGeld: 0, gebeFreiKarten: 0, willFelder: [], willGeld: 50, willFreiKarten: 0 },
    });
    if (!r.ok) throw new Error(r.grund);
    const eintrag = r.state.log.at(-1)!;
    expect(eintrag.sichtbarFuer).toBe("alle");
    expect(eintrag.art).toBeUndefined();
  });

  it("merkt abgeschlossene Handel im Verlauf vor", () => {
    let state = spiel(["a", "b"]);
    state.besitz[1].eigentuemer = "a";
    let r = dispatch(state, {
      typ: "handel-anbieten",
      angebot: { von: "a", an: "b", gebeFelder: [1], gebeGeld: 0, gebeFreiKarten: 0, willFelder: [], willGeld: 50, willFreiKarten: 0 },
    });
    if (!r.ok) throw new Error(r.grund);
    const id1 = r.state.offeneAngebote[0].id;
    r = dispatch(r.state, { typ: "handel-ablehnen", angebotId: id1 });
    if (!r.ok) throw new Error(r.grund);
    expect(r.state.handelsVerlauf).toHaveLength(1);
    expect(r.state.handelsVerlauf[0].ergebnis).toBe("abgelehnt");

    r = dispatch(r.state, {
      typ: "handel-anbieten",
      angebot: { von: "a", an: "b", gebeFelder: [1], gebeGeld: 0, gebeFreiKarten: 0, willFelder: [], willGeld: 50, willFreiKarten: 0 },
    });
    if (!r.ok) throw new Error(r.grund);
    const id2 = r.state.offeneAngebote[0].id;
    r = dispatch(r.state, { typ: "handel-annehmen", angebotId: id2 });
    if (!r.ok) throw new Error(r.grund);
    expect(r.state.handelsVerlauf).toHaveLength(2);
    expect(r.state.handelsVerlauf[1].ergebnis).toBe("angenommen");
  });
});

describe("Frei Parken", () => {
  it("sammelt Steuern im Topf und schüttet ihn beim Landen aus", () => {
    // Steuerzahlung über eine offene Schuld simulieren -> muss im Topf landen.
    const s = spiel(["a", "b"]);
    s.phase = { typ: "schuld-offen", schuld: { schuldner: "a", glaeubiger: null, betrag: 200, grund: "Einkommensteuer", anFreiParkenTopf: true } };
    const bezahlt = dispatch(s, { typ: "schuld-begleichen" });
    expect(bezahlt.ok).toBe(true);
    if (!bezahlt.ok) return;
    expect(bezahlt.state.frueParkenTopf).toBe(200);

    // b landet jetzt exakt auf "Frei Parken" (Feld 20) und kassiert den Topf.
    const seed = bezahlt.state.seed;
    bezahlt.state.amZug = "b";
    bezahlt.state.phase = { typ: "wuerfeln" };
    const [w1, w2] = wuerfleZweiWuerfel(seed, bezahlt.state.ziehungsZaehler);
    bezahlt.state.spieler[1].position = 20 - (w1 + w2); // kein Wrap-Around, also keine Los-Bonus-Interferenz
    const vorher = bezahlt.state.spieler[1].geld;

    const finalR = dispatch(bezahlt.state, { typ: "wuerfeln" });
    expect(finalR.ok).toBe(true);
    if (!finalR.ok) return;
    expect(finalR.state.spieler[1].geld).toBe(vorher + 200);
    expect(finalR.state.frueParkenTopf).toBe(0);
  });
});

describe("Chat", () => {
  it("markiert private Nachrichten als art:chat mit genau zwei Empfängern", () => {
    const state = spiel(["a", "b"]);
    const r = dispatch(state, { typ: "chat", von: "a", an: "b", text: "Hallo!" });
    if (!r.ok) throw new Error(r.grund);
    const eintrag = r.state.log.at(-1)!;
    expect(eintrag.art).toBe("chat");
    expect(eintrag.sichtbarFuer).toEqual(["a", "b"]);
  });

  it("ist ohne Empfänger öffentlich", () => {
    const state = spiel(["a", "b"]);
    const r = dispatch(state, { typ: "chat", von: "a", text: "Hallo alle!" });
    if (!r.ok) throw new Error(r.grund);
    expect(r.state.log.at(-1)!.sichtbarFuer).toBe("alle");
  });
});
