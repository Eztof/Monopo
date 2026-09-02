import { describe, expect, it } from "vitest";
import { parseCharacterCard } from "./characterCard";

describe("parseCharacterCard", () => {
  it("liest eine V2-Karte (Felder unter data) aus", () => {
    const karte = {
      spec: "chara_card_v2",
      data: { name: "Lena", description: "Eine Immobilienhändlerin.", personality: "Schlagfertig.", scenario: "Am Monopoly-Tisch." },
    };
    const figur = parseCharacterCard(karte);
    expect(figur.name).toBe("Lena");
    expect(figur.beschreibung).toContain("Immobilienhändlerin");
    expect(figur.beschreibung).toContain("Schlagfertig");
    expect(figur.rohdaten).toEqual(karte);
  });

  it("liest eine flache V1-artige Karte aus", () => {
    const figur = parseCharacterCard({ name: "Max", description: "Ruhig und bedacht." });
    expect(figur.name).toBe("Max");
    expect(figur.beschreibung).toBe("Ruhig und bedacht.");
  });

  it("fällt auf einen Platzhaltertext zurück, wenn nichts Brauchbares drinsteht", () => {
    const figur = parseCharacterCard({ irgendwas: 123 });
    expect(figur.name).toBe("Importierte Figur");
    expect(figur.beschreibung).toContain("Keine Beschreibung");
  });

  it("wirft bei Nicht-Objekten (kaputtes JSON)", () => {
    expect(() => parseCharacterCard("nur ein String")).toThrow();
    expect(() => parseCharacterCard(null)).toThrow();
  });
});
