import type { GameState, SpielerId } from "./types";

/** Wer gerade eine Entscheidung treffen muss — bei einer Auktion die Bieter-Reihenfolge, sonst der Zug-Inhaber. */
export function aktiverAkteur(state: GameState): SpielerId {
  return state.phase.typ === "auktion" ? state.phase.auktion.amZug : state.amZug;
}
