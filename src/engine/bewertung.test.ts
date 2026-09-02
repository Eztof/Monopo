import { describe, expect, it } from "vitest";
import { bewerteHandelsangebot } from "./bewertung";
import { erzeugeSpiel, schwierigkeitsGrade } from "./state";
import type { Handelsangebot } from "./types";

describe("bewerteHandelsangebot", () => {
  it("die Gnade-Zusatzmarge kann ein grenzwertiges Angebot kippen", () => {
    const state = erzeugeSpiel({
      spieler: [
        { id: "a", name: "A", farbe: "#f00", steuerung: "mensch" },
        { id: "b", name: "B", farbe: "#00f", steuerung: "mensch" },
      ],
      seed: "s",
    });
    const angebot: Handelsangebot = {
      id: "x",
      von: "a",
      an: "b",
      gebeFelder: [],
      gebeGeld: 100,
      gebeFreiKarten: 0,
      willFelder: [],
      willGeld: 95,
      willFreiKarten: 0,
    };
    const schwierigkeit = schwierigkeitsGrade.mittel; // handelsmarge 1.05

    // Normale Marge (1): 100 >= 95 * 1.05 * 1 = 99.75 -> angenommen.
    expect(bewerteHandelsangebot(state, angebot, schwierigkeit, 1)).toBe(true);
    // Erbarmungslose Zusatzmarge (1.3): 100 >= 95 * 1.05 * 1.3 = 129.7 -> abgelehnt.
    expect(bewerteHandelsangebot(state, angebot, schwierigkeit, 1.3)).toBe(false);
    // Mitleidend/spielerschonend (0.85): noch großzügiger angenommen.
    expect(bewerteHandelsangebot(state, angebot, schwierigkeit, 0.85)).toBe(true);
  });
});
