/**
 * Ereignis- und Gemeinschaftskarten. Generische Effekte statt Hasbro-Text,
 * aber mechanisch das klassische Set (Vorrücken, Miete umgehen, Steuern,
 * Reparaturen, "Gehe ins Gefängnis", Frei-Karte).
 *
 * Konvention für `geld-von-allen`: positiver Betrag = jeder Gegner zahlt
 * diesen Betrag an den ziehenden Spieler; negativer Betrag = der ziehende
 * Spieler zahlt diesen Betrag an jeden Gegner.
 */
import type { Karte } from "./types";

export const ereignisKarten: Karte[] = [
  { id: "e1", stapel: "ereignis", text: "Rücke vor bis zum Los und ziehe 200 ein.", effekt: { typ: "ziehe-zu", ziel: 0, losGehaltWennVorbei: true } },
  { id: "e2", stapel: "ereignis", text: "Rücke vor bis zur Granatstraße.", effekt: { typ: "ziehe-zu", ziel: 24, losGehaltWennVorbei: true } },
  { id: "e3", stapel: "ereignis", text: "Rücke vor bis zum Fliederweg.", effekt: { typ: "ziehe-zu", ziel: 11, losGehaltWennVorbei: true } },
  { id: "e4", stapel: "ereignis", text: "Rücke vor bis zum nächsten Werk. Zahle das Zehnfache des Würfelwurfs.", effekt: { typ: "ziehe-zum-naechsten", art: "werk", mieteFaktor: 10 } },
  { id: "e5", stapel: "ereignis", text: "Rücke vor bis zum nächsten Bahnhof. Zahle die doppelte Miete.", effekt: { typ: "ziehe-zum-naechsten", art: "bahnhof", mieteFaktor: 2 } },
  { id: "e6", stapel: "ereignis", text: "Die Bank zahlt dir eine Dividende von 50.", effekt: { typ: "geld", betrag: 50 } },
  { id: "e7", stapel: "ereignis", text: "Du erhältst eine Freikarte aus dem Gefängnis. Diese Karte kann aufbewahrt werden.", effekt: { typ: "frei-karte" }, behaltbar: true },
  { id: "e8", stapel: "ereignis", text: "Gehe drei Felder zurück.", effekt: { typ: "ziehe-relativ", felder: -3 } },
  { id: "e9", stapel: "ereignis", text: "Gehe direkt ins Gefängnis. Gehe nicht über Los, ziehe nicht 200 ein.", effekt: { typ: "ins-gefaengnis" } },
  { id: "e10", stapel: "ereignis", text: "Du lässt Reparaturen durchführen: 25 pro Haus, 100 pro Hotel.", effekt: { typ: "reparaturen", proHaus: 25, proHotel: 100 } },
  { id: "e11", stapel: "ereignis", text: "Zahle eine Strafgebühr von 15.", effekt: { typ: "geld", betrag: -15 } },
  { id: "e12", stapel: "ereignis", text: "Rücke vor bis zum Nordbahnhof.", effekt: { typ: "ziehe-zu", ziel: 5, losGehaltWennVorbei: true } },
  { id: "e13", stapel: "ereignis", text: "Rücke vor bis zum Kometenweg.", effekt: { typ: "ziehe-zu", ziel: 39, losGehaltWennVorbei: true } },
  { id: "e14", stapel: "ereignis", text: "Du wirst zum Vorsitzenden gewählt. Zahle jedem Mitspieler 50.", effekt: { typ: "geld-von-allen", betrag: -50 } },
  { id: "e15", stapel: "ereignis", text: "Deine Bauzinsen werden fällig: du erhältst 150.", effekt: { typ: "geld", betrag: 150 } },
  { id: "e16", stapel: "ereignis", text: "Du gewinnst einen Preis: ziehe 100 ein.", effekt: { typ: "geld", betrag: 100 } },
];

export const gemeinschaftKarten: Karte[] = [
  { id: "g1", stapel: "gemeinschaft", text: "Rücke vor bis zum Los und ziehe 200 ein.", effekt: { typ: "ziehe-zu", ziel: 0, losGehaltWennVorbei: true } },
  { id: "g2", stapel: "gemeinschaft", text: "Bankirrtum zu deinen Gunsten: ziehe 200 ein.", effekt: { typ: "geld", betrag: 200 } },
  { id: "g3", stapel: "gemeinschaft", text: "Zahle die Arztrechnung von 50.", effekt: { typ: "geld", betrag: -50 } },
  { id: "g4", stapel: "gemeinschaft", text: "Aus dem Verkauf von Wertpapieren erhältst du 50.", effekt: { typ: "geld", betrag: 50 } },
  { id: "g5", stapel: "gemeinschaft", text: "Du erhältst eine Freikarte aus dem Gefängnis. Diese Karte kann aufbewahrt werden.", effekt: { typ: "frei-karte" }, behaltbar: true },
  { id: "g6", stapel: "gemeinschaft", text: "Gehe direkt ins Gefängnis. Gehe nicht über Los, ziehe nicht 200 ein.", effekt: { typ: "ins-gefaengnis" } },
  { id: "g7", stapel: "gemeinschaft", text: "Dein Sparplan wird fällig: du erhältst 100.", effekt: { typ: "geld", betrag: 100 } },
  { id: "g8", stapel: "gemeinschaft", text: "Steuerrückerstattung: ziehe 20 ein.", effekt: { typ: "geld", betrag: 20 } },
  { id: "g9", stapel: "gemeinschaft", text: "Du hast Geburtstag: jeder Mitspieler schenkt dir 10.", effekt: { typ: "geld-von-allen", betrag: 10 } },
  { id: "g10", stapel: "gemeinschaft", text: "Deine Lebensversicherung wird fällig: du erhältst 100.", effekt: { typ: "geld", betrag: 100 } },
  { id: "g11", stapel: "gemeinschaft", text: "Zahle die Krankenhausrechnung von 100.", effekt: { typ: "geld", betrag: -100 } },
  { id: "g12", stapel: "gemeinschaft", text: "Zahle das Schulgeld von 150.", effekt: { typ: "geld", betrag: -150 } },
  { id: "g13", stapel: "gemeinschaft", text: "Du erhältst ein Beraterhonorar von 25.", effekt: { typ: "geld", betrag: 25 } },
  { id: "g14", stapel: "gemeinschaft", text: "Straßeninstandsetzung: 40 pro Haus, 115 pro Hotel.", effekt: { typ: "reparaturen", proHaus: 40, proHotel: 115 } },
  { id: "g15", stapel: "gemeinschaft", text: "Du gewinnst den zweiten Preis in einem Schönheitswettbewerb: ziehe 10 ein.", effekt: { typ: "geld", betrag: 10 } },
  { id: "g16", stapel: "gemeinschaft", text: "Du erbst 100.", effekt: { typ: "geld", betrag: 100 } },
];

export function alleKarten(): Karte[] {
  return [...ereignisKarten, ...gemeinschaftKarten];
}

export function karteById(id: string): Karte {
  const karte = alleKarten().find((k) => k.id === id);
  if (!karte) throw new Error(`Unbekannte Karte: ${id}`);
  return karte;
}
