/** Wandelt "#rrggbb" in "rgba(r,g,b,alpha)" — für die Besitzer-Farbwäsche auf dem Brett. */
export function hexZuRgba(hex: string, alpha: number): string {
  const normalisiert = hex.replace("#", "");
  const voll = normalisiert.length === 3 ? normalisiert.split("").map((c) => c + c).join("") : normalisiert;
  const r = parseInt(voll.slice(0, 2), 16);
  const g = parseInt(voll.slice(2, 4), 16);
  const b = parseInt(voll.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(128,128,128,${alpha})`;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
