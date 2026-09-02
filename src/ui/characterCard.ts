/**
 * Minimaler Parser für SillyTavern Character Cards (V2, JSON-Export). Rein technisch: liest
 * Name/Beschreibungstexte aus, ohne den Karteninhalt zu bewerten oder zu verändern — was in der
 * Karte steht, steht in der Karte. Nur JSON, kein PNG mit eingebetteten Metadaten (dafür in
 * SillyTavern "Export as JSON" statt der PNG-Karte verwenden).
 */

export interface ImportierteFigur {
  name: string;
  beschreibung: string;
  rohdaten: Record<string, unknown>;
}

function alsText(wert: unknown): string | null {
  return typeof wert === "string" && wert.trim() ? wert.trim() : null;
}

/** Wirft bei unbrauchbarem JSON (kein Objekt) — der Aufrufer zeigt dann einen Fehler an. */
export function parseCharacterCard(json: unknown): ImportierteFigur {
  if (typeof json !== "object" || json === null) {
    throw new Error("Das ist keine gültige Character-Card-Datei (kein JSON-Objekt).");
  }
  const wurzel = json as Record<string, unknown>;
  // V2-Karten verschachteln die eigentlichen Felder unter "data"; V1-Karten sind flach.
  const daten = (typeof wurzel.data === "object" && wurzel.data !== null ? (wurzel.data as Record<string, unknown>) : wurzel) ?? {};

  const name = alsText(daten.name) ?? "Importierte Figur";
  const teile = [alsText(daten.description), alsText(daten.personality), alsText(daten.scenario)].filter((t): t is string => t !== null);
  const beschreibung = teile.length > 0 ? teile.join(" ") : "Keine Beschreibung in der Karte gefunden.";

  return { name, beschreibung: beschreibung.slice(0, 2000), rohdaten: wurzel };
}
