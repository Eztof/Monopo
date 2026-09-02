import { describe, expect, it } from "vitest";
import { erzeugeSpiel } from "./state";

describe("erzeugeSpiel – Startgeld", () => {
  it("nutzt pro Spieler ein individuelles Startgeld, wenn angegeben", () => {
    const state = erzeugeSpiel({
      spieler: [
        { id: "a", name: "A", farbe: "#f00", steuerung: "mensch", startgeld: 3000 },
        { id: "b", name: "B", farbe: "#00f", steuerung: "mensch" },
      ],
      startgeld: 1000,
      seed: "s",
    });
    expect(state.spieler[0].geld).toBe(3000); // eigener Wert gewinnt
    expect(state.spieler[1].geld).toBe(1000); // fällt auf den globalen Default zurück
  });

  it("fällt ohne jede Angabe auf 1500 zurück", () => {
    const state = erzeugeSpiel({
      spieler: [
        { id: "a", name: "A", farbe: "#f00", steuerung: "mensch" },
        { id: "b", name: "B", farbe: "#00f", steuerung: "mensch" },
      ],
      seed: "s",
    });
    expect(state.spieler[0].geld).toBe(1500);
    expect(state.spieler[1].geld).toBe(1500);
  });
});
