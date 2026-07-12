// Glicko-2 (Glickman, glicko.net/glicko/glicko2.pdf) over the rally match
// log — the "second opinion" rater. Same countersigned ledger the contract
// settles with integer Elo; different open formula, now with uncertainty.
// The point is the thesis: the log is the product, the formula is swappable.
//
// Scale mapping: rally milli 2000–8000 → glicko 0–3000 (r = (milli-2000)/2),
// back out as milli = 2000 + 2r, rd_milli = 2·RD. Seeds start at the
// declared rating with RD 350 (±0.700 on the paddle scale) — a self-declared
// number is a wide claim; countersigned matches narrow it.
//
// Simplifications, documented: one rating period per match (standard for
// online play); doubles opponents collapse to a composite (mean μ, RMS φ);
// partners don't adjust each other. τ = 0.5, initial σ = 0.06.

const SCALE = 173.7178;
const TAU = 0.5;

export interface GPlayer { mu: number; phi: number; sigma: number; games: number; }
export interface GameResult { muOpp: number; phiOpp: number; score: number; } // score 1 win, 0 loss

export const seed = (declaredMilli: number): GPlayer => ({
  mu: ((declaredMilli - 2000) / 2 - 1500) / SCALE,
  phi: 350 / SCALE,
  sigma: 0.06,
  games: 0,
});

const g = (phi: number) => 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
const E = (mu: number, muJ: number, phiJ: number) => 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));

// One rating-period update for one player against a set of results.
export function update(p: GPlayer, results: GameResult[]): GPlayer {
  if (!results.length) {
    return { ...p, phi: Math.sqrt(p.phi * p.phi + p.sigma * p.sigma) };
  }
  let vInv = 0, dSum = 0;
  for (const r of results) {
    const e = E(p.mu, r.muOpp, r.phiOpp);
    const gj = g(r.phiOpp);
    vInv += gj * gj * e * (1 - e);
    dSum += gj * (r.score - e);
  }
  const v = 1 / vInv;
  const delta = v * dSum;

  // volatility iteration (Illinois algorithm, step 5 of the paper)
  const a = Math.log(p.sigma * p.sigma);
  const phi2 = p.phi * p.phi;
  const f = (x: number) => {
    const ex = Math.exp(x);
    return (ex * (delta * delta - phi2 - v - ex)) / (2 * (phi2 + v + ex) ** 2) - (x - a) / (TAU * TAU);
  };
  let A = a;
  let B: number;
  if (delta * delta > phi2 + v) {
    B = Math.log(delta * delta - phi2 - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A), fB = f(B);
  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; } else { fA = fA / 2; }
    B = C; fB = fC;
  }
  const sigma2 = Math.exp(A / 2);

  const phiStar = Math.sqrt(phi2 + sigma2 * sigma2);
  const phi2n = 1 / Math.sqrt(1 / (phiStar * phiStar) + vInv);
  const mu2 = p.mu + phi2n * phi2n * dSum;
  return { mu: mu2, phi: phi2n, sigma: sigma2, games: p.games + results.length };
}

export const toMilli = (p: GPlayer) => ({
  rating: Math.round(2000 + 2 * (p.mu * SCALE + 1500)),
  rd: Math.round(2 * p.phi * SCALE),
  games: p.games,
});

// Run the whole log. players: [{address, declared}], matches (finalized,
// settlement order): [{teamA, teamB, scoreA, scoreB}].
export function rate(
  players: Array<{ address: string; declared: number }>,
  matches: Array<{ teamA: string[]; teamB: string[]; scoreA: number; scoreB: number }>
) {
  const state = new Map(players.map((p) => [p.address, seed(p.declared)]));
  for (const m of matches) {
    const side = (t: string[]) => t.map((a) => state.get(a)!);
    const composite = (t: string[]) => {
      const s = side(t);
      return {
        mu: s.reduce((x, p) => x + p.mu, 0) / s.length,
        phi: Math.sqrt(s.reduce((x, p) => x + p.phi * p.phi, 0) / s.length),
      };
    };
    const aWon = m.scoreA > m.scoreB;
    const compA = composite(m.teamA), compB = composite(m.teamB);
    const next = new Map<string, GPlayer>();
    for (const addr of m.teamA)
      next.set(addr, update(state.get(addr)!, [{ muOpp: compB.mu, phiOpp: compB.phi, score: aWon ? 1 : 0 }]));
    for (const addr of m.teamB)
      next.set(addr, update(state.get(addr)!, [{ muOpp: compA.mu, phiOpp: compA.phi, score: aWon ? 0 : 1 }]));
    for (const [k, v] of next) state.set(k, v);
  }
  return new Map([...state.entries()].map(([k, v]) => [k, toMilli(v)]));
}
