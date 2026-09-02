/**
 * Kleine, synthetisch erzeugte Signaltöne (Web Audio API) statt Audiodateien —
 * kein Asset-Ladevorgang, funktioniert offline. Bewusst dezent: das sind
 * Hinweistöne ("etwas ist passiert"), keine Musik.
 */

let audioCtx: AudioContext | null = null;

function holeContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    if (audioCtx.state === "suspended") void audioCtx.resume();
    return audioCtx;
  } catch {
    return null;
  }
}

let stummgeschaltet = (() => {
  try {
    return localStorage.getItem("monopoly-stumm") === "1";
  } catch {
    return false;
  }
})();

export function istStummgeschaltet(): boolean {
  return stummgeschaltet;
}

export function setzeStumm(wert: boolean): void {
  stummgeschaltet = wert;
  try {
    localStorage.setItem("monopoly-stumm", wert ? "1" : "0");
  } catch {
    /* localStorage kann fehlen (privates Fenster o.ä.) — dann bleibt es halt für diese Sitzung. */
  }
}

function ton(frequenz: number, dauer: number, typ: OscillatorType = "sine", verzoegerung = 0, lautstaerke = 0.15): void {
  if (stummgeschaltet) return;
  const ctx = holeContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime + verzoegerung;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = typ;
    osc.frequency.setValueAtTime(frequenz, start);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(lautstaerke, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + dauer + 0.02);
  } catch {
    /* Ton ist ein Nice-to-have, nie kritisch fürs Spiel. */
  }
}

export type SoundArt =
  | "wuerfeln"
  | "kaufen"
  | "bauen"
  | "geld-erhalten"
  | "geld-zahlen"
  | "karte"
  | "gefaengnis"
  | "zugende"
  | "handel"
  | "auktion"
  | "bankrott"
  | "sieg"
  | "fehler"
  | "chat";

export function spiele(art: SoundArt): void {
  switch (art) {
    case "wuerfeln":
      ton(220, 0.08);
      ton(330, 0.08, "sine", 0.09);
      return;
    case "kaufen":
      ton(523, 0.12, "triangle");
      return;
    case "bauen":
      ton(392, 0.08, "square");
      ton(523, 0.1, "square", 0.08);
      return;
    case "geld-erhalten":
      ton(660, 0.1);
      ton(880, 0.12, "sine", 0.09);
      return;
    case "geld-zahlen":
      ton(220, 0.15, "sawtooth");
      return;
    case "karte":
      ton(440, 0.06, "triangle");
      ton(554, 0.06, "triangle", 0.06);
      return;
    case "gefaengnis":
      ton(150, 0.25, "square");
      return;
    case "zugende":
      ton(392, 0.08);
      return;
    case "handel":
      ton(494, 0.08, "triangle");
      ton(659, 0.08, "triangle", 0.08);
      return;
    case "auktion":
      ton(349, 0.06, "triangle");
      return;
    case "bankrott":
      ton(180, 0.3, "sawtooth");
      ton(120, 0.35, "sawtooth", 0.25);
      return;
    case "sieg":
      [523, 659, 784, 1047].forEach((f, i) => ton(f, 0.18, "triangle", i * 0.14));
      return;
    case "fehler":
      ton(180, 0.12, "square");
      return;
    case "chat":
      ton(700, 0.05);
      return;
  }
}
