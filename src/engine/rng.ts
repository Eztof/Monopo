/**
 * Deterministischer PRNG statt Math.random.
 *
 * Warum: Bei Monopoly-Sonderfällen (dritter Pasch mitten in einer Auktion,
 * Bankrott durch eine gezogene Karte) will man den exakten Ablauf aus einem
 * Bugreport nachstellen können. Mit einem Seed-String reicht dafür der
 * GameState.seed plus ein Zähler, der im State mitgeführt wird.
 *
 * Wichtig: Der Rng-Zustand selbst gehört NICHT in den GameState (der muss
 * plain JSON-serialisierbar bleiben und ist die einzige Wahrheit). Stattdessen
 * wird aus `seed` + `ziehung` (fortlaufender Zähler im GameState) bei jedem
 * Zufallsereignis frisch ein Wert abgeleitet — das macht den Reducer trotzdem
 * eine reine Funktion.
 */

/** FNV-1a-artiger String-Hash, um aus seed+ziehung einen 32-Bit-Startwert zu machen. */
function hashSeed(seed: string, ziehung: number): number {
  let h = 0x811c9dc5 ^ ziehung;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 — klein, schnell, ausreichend gute Verteilung für ein Brettspiel. */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Liefert eine Zufallszahl in [0, 1) für (seed, ziehung). */
export function zufall01(seed: string, ziehung: number): number {
  return mulberry32(hashSeed(seed, ziehung))();
}

/** Würfelt zwei Würfel (1..6) deterministisch aus (seed, ziehung). */
export function wuerfleZweiWuerfel(seed: string, ziehung: number): [number, number] {
  const rng = mulberry32(hashSeed(seed, ziehung));
  const w1 = 1 + Math.floor(rng() * 6);
  const w2 = 1 + Math.floor(rng() * 6);
  return [w1, w2];
}

/** Ganzzahl in [0, max) deterministisch aus (seed, ziehung). */
export function zufallsIndex(seed: string, ziehung: number, max: number): number {
  return Math.floor(zufall01(seed, ziehung) * max);
}

/**
 * Deterministisches Mischen (Fisher-Yates) einer Id-Liste. Wird einmalig beim
 * Spielstart für die Kartenstapel benutzt.
 */
export function mische<T>(liste: T[], seed: string, ziehung: number): T[] {
  const ergebnis = liste.slice();
  for (let i = ergebnis.length - 1; i > 0; i--) {
    const j = zufallsIndex(seed, ziehung * 1000 + i, i + 1);
    [ergebnis[i], ergebnis[j]] = [ergebnis[j], ergebnis[i]];
  }
  return ergebnis;
}
