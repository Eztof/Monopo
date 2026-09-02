/**
 * Das Standardbrett — bewusst mit erfundenen Namen statt Hasbro-Straßennamen,
 * damit das Spiel öffentlich (GitHub, o.ä.) unproblematisch ist. Reihenfolge,
 * Preise und Mieten folgen dem klassischen 40-Felder-Layout, weil das die
 * Balance ist, auf der die Regeln (Baustopp, Auktionslogik, Mietstaffel)
 * beruhen — das ist Spielmechanik, kein geschütztes Namensgut.
 *
 * Brett und Namen sind Konfiguration: ein anderes Brett (andere Städte, ein
 * Fantasy-Setting, ...) ist einfach ein anderes Modul, das dieselben Typen
 * exportiert.
 */
import type { Brett, Farbgruppe, Feld } from "./types";

const felder: Feld[] = [
  { id: 0, name: "Los", art: "los" },

  { id: 1, name: "Ulmenweg", art: "strasse", gruppe: "braun", kaufpreis: 60, hypothekenwert: 30, hauspreis: 50, mieten: [2, 10, 30, 90, 160, 250] },
  { id: 2, name: "Gemeinschaft", art: "karte", stapel: "gemeinschaft" },
  { id: 3, name: "Lindenweg", art: "strasse", gruppe: "braun", kaufpreis: 60, hypothekenwert: 30, hauspreis: 50, mieten: [4, 20, 60, 180, 320, 450] },
  { id: 4, name: "Einkommensteuer", art: "steuer", betrag: 200, alternativProzent: 0.1 },
  { id: 5, name: "Nordbahnhof", art: "bahnhof", kaufpreis: 200, hypothekenwert: 100, mieten: [25, 50, 100, 200] },
  { id: 6, name: "Seeuferweg", art: "strasse", gruppe: "hellblau", kaufpreis: 100, hypothekenwert: 50, hauspreis: 50, mieten: [6, 30, 90, 270, 400, 550] },
  { id: 7, name: "Ereignis", art: "karte", stapel: "ereignis" },
  { id: 8, name: "Möwenallee", art: "strasse", gruppe: "hellblau", kaufpreis: 100, hypothekenwert: 50, hauspreis: 50, mieten: [6, 30, 90, 270, 400, 550] },
  { id: 9, name: "Hafenstraße", art: "strasse", gruppe: "hellblau", kaufpreis: 120, hypothekenwert: 60, hauspreis: 50, mieten: [8, 40, 100, 300, 450, 600] },

  { id: 10, name: "Gefängnis (Besuch)", art: "gefaengnis-besuch" },

  { id: 11, name: "Fliederweg", art: "strasse", gruppe: "magenta", kaufpreis: 140, hypothekenwert: 70, hauspreis: 100, mieten: [10, 50, 150, 450, 625, 750] },
  { id: 12, name: "Elektrizitätswerk", art: "werk", kaufpreis: 150, hypothekenwert: 75, multiplikatoren: [4, 10] },
  { id: 13, name: "Lavendelhof", art: "strasse", gruppe: "magenta", kaufpreis: 140, hypothekenwert: 70, hauspreis: 100, mieten: [10, 50, 150, 450, 625, 750] },
  { id: 14, name: "Rosenallee", art: "strasse", gruppe: "magenta", kaufpreis: 160, hypothekenwert: 80, hauspreis: 100, mieten: [12, 60, 180, 500, 700, 900] },
  { id: 15, name: "Ostbahnhof", art: "bahnhof", kaufpreis: 200, hypothekenwert: 100, mieten: [25, 50, 100, 200] },
  { id: 16, name: "Kürbisgasse", art: "strasse", gruppe: "orange", kaufpreis: 180, hypothekenwert: 90, hauspreis: 100, mieten: [14, 70, 200, 550, 750, 950] },
  { id: 17, name: "Gemeinschaft", art: "karte", stapel: "gemeinschaft" },
  { id: 18, name: "Bernsteinweg", art: "strasse", gruppe: "orange", kaufpreis: 180, hypothekenwert: 90, hauspreis: 100, mieten: [14, 70, 200, 550, 750, 950] },
  { id: 19, name: "Ahornallee", art: "strasse", gruppe: "orange", kaufpreis: 200, hypothekenwert: 100, hauspreis: 100, mieten: [16, 80, 220, 600, 800, 1000] },

  { id: 20, name: "Frei Parken", art: "frei-parken" },

  { id: 21, name: "Mohnweg", art: "strasse", gruppe: "rot", kaufpreis: 220, hypothekenwert: 110, hauspreis: 150, mieten: [18, 90, 250, 700, 875, 1050] },
  { id: 22, name: "Ereignis", art: "karte", stapel: "ereignis" },
  { id: 23, name: "Rubinallee", art: "strasse", gruppe: "rot", kaufpreis: 220, hypothekenwert: 110, hauspreis: 150, mieten: [18, 90, 250, 700, 875, 1050] },
  { id: 24, name: "Granatstraße", art: "strasse", gruppe: "rot", kaufpreis: 240, hypothekenwert: 120, hauspreis: 150, mieten: [20, 100, 300, 750, 925, 1100] },
  { id: 25, name: "Südbahnhof", art: "bahnhof", kaufpreis: 200, hypothekenwert: 100, mieten: [25, 50, 100, 200] },
  { id: 26, name: "Sonnenblumenweg", art: "strasse", gruppe: "gelb", kaufpreis: 260, hypothekenwert: 130, hauspreis: 150, mieten: [22, 110, 330, 800, 975, 1150] },
  { id: 27, name: "Weizenfeld", art: "strasse", gruppe: "gelb", kaufpreis: 260, hypothekenwert: 130, hauspreis: 150, mieten: [22, 110, 330, 800, 975, 1150] },
  { id: 28, name: "Wasserwerk", art: "werk", kaufpreis: 150, hypothekenwert: 75, multiplikatoren: [4, 10] },
  { id: 29, name: "Goldährenfeld", art: "strasse", gruppe: "gelb", kaufpreis: 280, hypothekenwert: 140, hauspreis: 150, mieten: [24, 120, 360, 850, 1025, 1200] },

  { id: 30, name: "Gehe ins Gefängnis", art: "gehe-ins-gefaengnis" },

  { id: 31, name: "Tannenweg", art: "strasse", gruppe: "gruen", kaufpreis: 300, hypothekenwert: 150, hauspreis: 200, mieten: [26, 130, 390, 900, 1100, 1275] },
  { id: 32, name: "Fichtenallee", art: "strasse", gruppe: "gruen", kaufpreis: 300, hypothekenwert: 150, hauspreis: 200, mieten: [26, 130, 390, 900, 1100, 1275] },
  { id: 33, name: "Gemeinschaft", art: "karte", stapel: "gemeinschaft" },
  { id: 34, name: "Waldpromenade", art: "strasse", gruppe: "gruen", kaufpreis: 320, hypothekenwert: 160, hauspreis: 200, mieten: [28, 150, 450, 1000, 1200, 1400] },
  { id: 35, name: "Westbahnhof", art: "bahnhof", kaufpreis: 200, hypothekenwert: 100, mieten: [25, 50, 100, 200] },
  { id: 36, name: "Ereignis", art: "karte", stapel: "ereignis" },
  { id: 37, name: "Sternenallee", art: "strasse", gruppe: "blau", kaufpreis: 350, hypothekenwert: 175, hauspreis: 200, mieten: [35, 175, 500, 1100, 1300, 1500] },
  { id: 38, name: "Luxussteuer", art: "steuer", betrag: 100 },
  { id: 39, name: "Kometenweg", art: "strasse", gruppe: "blau", kaufpreis: 400, hypothekenwert: 200, hauspreis: 200, mieten: [50, 200, 600, 1400, 1700, 2000] },
];

const gruppen: Farbgruppe[] = [
  { id: "braun", name: "Braun", farbe: "#8b4513", felder: [1, 3] },
  { id: "hellblau", name: "Hellblau", farbe: "#87ceeb", felder: [6, 8, 9] },
  { id: "magenta", name: "Magenta", farbe: "#c71585", felder: [11, 13, 14] },
  { id: "orange", name: "Orange", farbe: "#ff8c00", felder: [16, 18, 19] },
  { id: "rot", name: "Rot", farbe: "#dc143c", felder: [21, 23, 24] },
  { id: "gelb", name: "Gelb", farbe: "#ffd700", felder: [26, 27, 29] },
  { id: "gruen", name: "Grün", farbe: "#228b22", felder: [31, 32, 34] },
  { id: "blau", name: "Blau", farbe: "#00008b", felder: [37, 39] },
];

export const standardBrett: Brett = {
  name: "Standardbrett",
  waehrung: "€",
  felder,
  gruppen,
  losGehalt: 200,
  gefaengnisFeld: 10,
  gefaengnisKaution: 50,
  haeuserImVorrat: 32,
  hotelsImVorrat: 12,
};

export function feldById(brett: Brett, id: number): Feld {
  const feld = brett.felder[id];
  if (!feld || feld.id !== id) {
    const gefunden = brett.felder.find((f) => f.id === id);
    if (!gefunden) throw new Error(`Unbekanntes Feld: ${id}`);
    return gefunden;
  }
  return feld;
}

export function gruppeVonFeld(brett: Brett, feldId: number): Farbgruppe | undefined {
  return brett.gruppen.find((g) => g.felder.includes(feldId));
}

export function istKaufbar(feld: Feld): feld is Extract<Feld, { art: "strasse" | "bahnhof" | "werk" }> {
  return feld.art === "strasse" || feld.art === "bahnhof" || feld.art === "werk";
}
