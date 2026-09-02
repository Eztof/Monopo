import { describe, expect, it } from "vitest";
import { baueChatSystemPrompt, baueChatVerlauf, findeUnbeantworteteNachricht, naechsteAktion } from "./bot";
import { schwierigkeitsGrade, erzeugeSpiel } from "./state";
import type { GameState, KiProfil } from "./types";

function kiProfil(gnade: KiProfil["gnade"]): KiProfil {
  return {
    schwierigkeit: schwierigkeitsGrade.mittel,
    persoenlichkeit: { name: "Bot", beschreibung: "", beziehungen: {} },
    gnade,
  };
}

function spiel(): GameState {
  return erzeugeSpiel({
    spieler: [
      { id: "mensch", name: "Mensch", farbe: "#f00", steuerung: "mensch" },
      { id: "bot", name: "Bot", farbe: "#00f", steuerung: "ki", ki: kiProfil("normal") },
    ],
    seed: "bot-test",
  });
}

describe("Gnade-Verhalten", () => {
  it("spielerschonend bietet dem Menschen in Not einen Rettungs-Handel an", () => {
    const state = spiel();
    state.spieler[1].ki!.gnade = "spielerschonend";
    state.spieler[0].geld = 10;
    state.phase = { typ: "schuld-offen", schuld: { schuldner: "mensch", glaeubiger: null, betrag: 100, grund: "Miete" } };

    const aktion = naechsteAktion(state);
    expect(aktion?.typ).toBe("handel-anbieten");
    if (aktion?.typ !== "handel-anbieten") return;
    expect(aktion.angebot.von).toBe("bot");
    expect(aktion.angebot.an).toBe("mensch");
    expect(aktion.angebot.gebeGeld).toBe(90); // 100 Schuld - 10 vorhandenes Geld
  });

  it("normal greift nicht proaktiv ein", () => {
    const state = spiel();
    state.spieler[0].geld = 10;
    state.phase = { typ: "schuld-offen", schuld: { schuldner: "mensch", glaeubiger: null, betrag: 100, grund: "Miete" } };

    const aktion = naechsteAktion(state);
    expect(aktion?.typ).not.toBe("handel-anbieten");
  });

});

describe("Chat-Platzhalter", () => {
  it("antwortet auf eine private Nachricht an eine KI", () => {
    const state = spiel();
    state.log.push({ runde: 1, akteur: "mensch", text: "Hallo!", sichtbarFuer: ["mensch", "bot"], art: "chat" });

    const aktion = naechsteAktion(state);
    expect(aktion?.typ).toBe("chat");
    if (aktion?.typ !== "chat") return;
    expect(aktion.von).toBe("bot");
    expect(aktion.an).toBe("mensch");
    expect(aktion.text.length).toBeGreaterThan(0);
  });

  it("antwortet nicht erneut, wenn die KI zuletzt selbst geschrieben hat", () => {
    const state = spiel();
    state.log.push({ runde: 1, akteur: "mensch", text: "Hallo!", sichtbarFuer: ["mensch", "bot"], art: "chat" });
    state.log.push({ runde: 1, akteur: "bot", text: "Hi zurück.", sichtbarFuer: ["mensch", "bot"], art: "chat" });

    const aktion = naechsteAktion(state);
    expect(aktion?.typ).not.toBe("chat");
  });

  it("ignoriert nicht-Chat-Einträge (z.B. Handelsnotizen) bei der Erkennung", () => {
    const state = spiel();
    state.log.push({ runde: 1, akteur: "mensch", text: "Mensch bietet Bot einen Handel an.", sichtbarFuer: ["mensch", "bot"] });
    expect(findeUnbeantworteteNachricht(state)).toBeNull();
  });
});

describe("LLM-Vorbereitung", () => {
  it("baut den Chatverlauf mit den richtigen Rollen in chronologischer Reihenfolge", () => {
    const state = spiel();
    state.log.push({ runde: 1, akteur: "mensch", text: "Hallo!", sichtbarFuer: ["mensch", "bot"], art: "chat" });
    state.log.push({ runde: 1, akteur: "bot", text: "Hi zurück.", sichtbarFuer: ["mensch", "bot"], art: "chat" });
    state.log.push({ runde: 1, akteur: "mensch", text: "Wie geht's?", sichtbarFuer: ["mensch", "bot"], art: "chat" });

    const verlauf = baueChatVerlauf(state, "bot", "mensch");
    expect(verlauf).toEqual([
      { rolle: "user", text: "Hallo!" },
      { rolle: "assistant", text: "Hi zurück." },
      { rolle: "user", text: "Wie geht's?" },
    ]);
  });

  it("baut einen System-Prompt aus der Persönlichkeit, nicht aus der Schwierigkeit", () => {
    const state = spiel();
    const bot = state.spieler[1] as typeof state.spieler[1] & { ki: NonNullable<(typeof state.spieler)[1]["ki"]> };
    bot.ki.persoenlichkeit.beschreibung = "Frech und selbstbewusst.";
    const prompt = baueChatSystemPrompt(bot, state.spieler[0]);
    expect(prompt).toContain("Frech und selbstbewusst.");
    expect(prompt).toContain("Mensch");
    expect(prompt).not.toContain("bewertungstiefe");
  });
});
