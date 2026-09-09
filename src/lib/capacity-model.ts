// Faithful TypeScript port of prefab_capacity_certainty_model.py, LuhTech's
// own internal capacity-design + queueing + stochastic-optimization model
// (baseline anchored to the EC_Skids switchgear family --
// Prefab_SupplyDemand_Model.xlsx / prefab_optimize.py). Illustrative
// internal engineering baseline, not an audited financial forecast --
// Erik's own framing when he supplied the source file ("draft runs, will
// require edit potentially").
//
// This is deliberately a direct, function-for-function port (same names,
// same formulas, same default parameters) rather than a re-derivation --
// every function here should be checkable line-by-line against the
// Python source. optimalPlan() is the real newsvendor-flavoured core
// result: with demand centred on Dtrue and dispersion set by contract
// coverage theta, what nameplate capacity maximises expected margin
// dollars, subject to a service-level floor? The reserve/capacity ratio
// this implies is an OUTPUT of that search, never a value a caller sets
// directly -- ported this way specifically because an earlier hand-picked
// closed-form formula (capacity = plannedDemand*(1+reserveRatio), with
// reserveRatio as a raw input) contradicted this real mechanism.
//
// Ported a second time, independently, into Ectropy-Business's api-gateway
// for the server-side integrity-boundary recompute (never trust a
// client-submitted result) -- both ports are checked against the same
// Python reference table (capacity-model.test.ts), not shared as one
// package yet (a real, later follow-on once the model has shipped twice
// and proven stable).

export interface ModelParams {
  W: number; Kel: number; tmax: number; crew: number;
  shifts: number; hpd: number; days: number; avail: number;
  a: number; lam: number; kap: number; ustar: number; theta: number; ce2: number;
  rate: number; asp: number; mat: number;
  otMult: number; subMark: number; varOH: number;
  plantFix: number; lineFix: number;
  leadDays: number; zone: number;
  aOT: number; aS2: number; s2on: boolean; rho: number; SL: number;
  beta: number; subLateMo: number;
  Ast: number; Awip: number;
  rentPSF: number; ownShell: boolean;
}

export const DEFAULT_PARAMS: ModelParams = {
  W: 260.0, Kel: 40, tmax: 16.0, crew: 2.0,
  shifts: 1.0, hpd: 8.0, days: 250.0, avail: 0.85,
  a: 0.0, lam: 0.35, kap: 0.60, ustar: 0.85, theta: 0.50, ce2: 0.45,
  rate: 85.0, asp: 600_000.0, mat: 380_000.0,
  otMult: 1.5, subMark: 1.18, varOH: 0.06,
  plantFix: 400_000.0, lineFix: 220_000.0,
  leadDays: 35.0, zone: 5,
  aOT: 0.20, aS2: 0.85, s2on: false, rho: 0.70, SL: 0.95,
  beta: 0.12, subLateMo: 2.0,
  Ast: 750.0, Awip: 350.0,
  rentPSF: 11.50, ownShell: false,
};

const CA2_SPEC = 1.80, CA2_CON = 0.15;
const SIG_SPEC = 0.35, SIG_CON = 0.04;
const CRF_EQ = 0.12 / (1 - Math.pow(1.12, -7));   // 0.2191, 7-yr equipment
const CRF_FAC = 0.12 / (1 - Math.pow(1.12, -10)); // 0.1770, 10-yr facility

export interface Design {
  A: number; Weff: number; tmaxE: number; takt: number; tTarget: number; eta: number;
  Nser: number; mReq: number; N: number; tbar: number; tb: number; u: number; floorD: number;
}

export function design(D: number, p: ModelParams = DEFAULT_PARAMS): Design {
  const A = p.shifts * p.hpd * p.days * p.avail;
  const Weff = p.W * (1 - p.a * p.lam);
  const tmaxE = p.tmax * (1 - p.a * p.kap);
  const takt = A / D;
  const tTarget = p.ustar * takt;
  const elem = Weff / p.Kel;
  let eta = 1.0 / (1.0 + 0.5 * elem / (p.crew * tTarget));
  eta = Math.min(0.97, Math.max(0.55, eta));
  const Nser = Math.ceil(Weff / (p.crew * tTarget * eta));
  const mReq = Math.ceil(tmaxE / (p.crew * tTarget));
  const N = Nser + (mReq - 1);
  const tbar = Weff / (p.crew * N);
  const tb = tbar / eta;
  const u = Math.min(0.985, tb / takt);
  return { A, Weff, tmaxE, takt, tTarget, eta, Nser, mReq, N, tbar, tb, u, floorD: A * p.crew * p.ustar / tmaxE };
}

/** Factory flow time (hours). Kingman VUT applied at DECOUPLING POINTS only:
 * stations inside a paced zone are coupled, so queues form at zone boundaries.
 * Pooling inside a zone shrinks its CV (variance of a sum of n iid -> CV^2/n). */
export function ctLine(u: number, d: Design, p: ModelParams = DEFAULT_PARAMS, ca2?: number): number {
  if (ca2 === undefined) ca2 = CA2_SPEC * (1 - p.theta) + CA2_CON * p.theta;
  u = Math.min(Math.max(u, 0.02), 0.985);
  const N = d.N, ce2 = p.ce2, z = Math.max(1, Math.trunc(p.zone));
  const Z = Math.ceil(N / z);
  let CT = 0.0, cai = ca2;
  for (let k = 0; k < Z; k++) {
    const n = Math.min(z, N - k * z);
    const te = n * d.tbar;
    const ce2z = ce2 / n;
    const V = (cai + ce2z) / 2;
    const U = u / (1 - u);
    CT += V * U * te + te;
    cai = u * u * ce2z + (1 - u * u) * cai;
  }
  return CT;
}

/** Nameplate and the flexed capacity ceilings from the demand-matching levers. */
export function flexCapacity(D: number, d: Design, p: ModelParams = DEFAULT_PARAMS): [number, number, number] {
  const nameplate = d.u > 0 ? D / d.u : D;
  return [nameplate, nameplate * (1 + p.aOT), nameplate * (1 + p.aOT + (p.s2on ? p.aS2 : 0))];
}

export interface Capex {
  stations: number; tooling: number; mh: number; mhName: string; crane: number; bays: number;
  test: number; nTest: number; paint: number; paintIn: boolean; mes: number; mesName: string;
  elec: number; elecName: string; kva: number; fitout: number; slab: number; shell: number;
  equip: number; fac: number; total: number; gross: number; wip: number; CT: number; cSt: number;
}

/** Continuous-with-steps facility build-out capital. */
export function capex(D: number, d: Design, p: ModelParams = DEFAULT_PARAMS): Capex {
  const N = d.N, takt = d.takt;
  const tSt = p.crew * takt * p.ustar;
  const cSt = 45_000 + 85_000 * Math.pow(20.0 / Math.max(tSt, 0.5), 0.65);
  const cStAuto = p.a * 320_000 * p.lam;
  const stations = N * (cSt + cStAuto);
  const tooling = 240_000 + N * 9_000 + p.Kel * 11_000;
  let mh: [string, number, number];
  if (takt > 24) mh = ['Forklift + floor-marked lanes', 0, 0];
  else if (takt > 8) mh = ['Air-caster carts, guided lanes', 180_000, 9_000];
  else if (takt > 3) mh = ['Powered roller / skillet, paced', 1_450_000, 38_000];
  else mh = ['Indexed AGV line, lift + rotate', 3_600_000, 52_000];
  const mhC = mh[1] + N * mh[2];
  const bays = Math.ceil(N / 6);
  const craneC = bays * 420_000;
  const nTest = Math.ceil(D / 55);
  const testC = nTest ? 680_000 + (nTest - 1) * 520_000 : 0;
  const paintIn = D >= 120;
  const paintC = paintIn ? 1_350_000 : 0;
  const mesC = D < 60 ? 0 : (D < 180 ? 420_000 : 1_600_000);
  const mesName = D < 60 ? 'Spreadsheets + ERP module'
    : D < 180 ? 'MES lite - routings, traveller, e-sign'
    : 'Full MES + ShopOS traceability, inline test capture';
  const kva = 350 + 42 * N + 250 * nTest + p.a * 180 * N;
  let elec: [number, string];
  if (kva < 900) elec = [0, 'Existing 1200 A / 480 V service'];
  else if (kva < 1900) elec = [340_000, 'Upgrade to 2500 A switchboard'];
  else if (kva < 3400) elec = [760_000, 'Upgrade to 4000 A service'];
  else elec = [1_900_000, 'Own 12.47 kV service + pad transformer'];
  const CT = ctLine(d.u, d, p);
  const wip = CT / takt;
  const prod = N * p.Ast + wip * p.Awip;
  const shared = 12_000 + 55 * D;
  const gross = (prod + shared) / 0.62;
  const fitout = gross * 38;
  const slab = prod * 14;
  const shell = p.ownShell ? gross * 148 : 0;
  const equip = stations + tooling + mhC + craneC + testC + paintC + mesC + elec[0];
  const fac = fitout + slab + shell;
  return {
    stations, tooling, mh: mhC, mhName: mh[0], crane: craneC, bays,
    test: testC, nTest, paint: paintC, paintIn, mes: mesC,
    mesName, elec: elec[0], elecName: elec[1], kva, fitout, slab, shell,
    equip, fac, total: equip + fac, gross, wip, CT, cSt,
  };
}

/** Acklam's rational approximation to the inverse standard-normal CDF. */
function ppf(q: number): number {
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
    1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
    6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
    -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const dd = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
    3.754408661907416e+00];
  const pl = 0.02425, ph = 1 - 0.02425;
  if (q < pl) {
    const t = Math.sqrt(-2 * Math.log(q));
    return (((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) /
      ((((dd[0] * t + dd[1]) * t + dd[2]) * t + dd[3]) * t + 1);
  }
  if (q > ph) {
    const t = Math.sqrt(-2 * Math.log(1 - q));
    return -(((((c[0] * t + c[1]) * t + c[2]) * t + c[3]) * t + c[4]) * t + c[5]) /
      ((((dd[0] * t + dd[1]) * t + dd[2]) * t + dd[3]) * t + 1);
  }
  const t = q - 0.5, r = t * t;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * t /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

const NQ = 25;
// Stratified quantile nodes: equal-probability slices of the demand distribution.
const GH: [number, number][] = Array.from({ length: NQ }, (_, i) => [ppf((i + 0.5) / NQ), 1.0 / NQ]);

export interface PnlResult {
  Dr: number; served: number; lost: number; u: number; CTd: number; ot: number; s2: number; sub: number;
  unit: number; marginD: number; margin: number; service: number; onTime: boolean; w?: number;
}

/** P&L and service outcome for ONE realised demand, with the plant already built for
 * Dplan. Capital, floor space and standing payroll are sunk at the design point. */
export function pnlAt(Dr: number, Dplan: number, d: Design, cx: Capex, p: ModelParams, ca2: number): PnlResult {
  const vc = p.mat + p.W * p.rate + p.mat * p.varOH;
  const cOT = p.W * (p.rate * p.otMult - p.rate);
  const [nameplate, kOT, kMax] = flexCapacity(Dplan, d, p);
  const subCap = p.beta * nameplate; // supply-constrained market: overflow is scarce
  Dr = Math.max(1.0, Dr);
  const sub = Math.min(Math.max(0.0, Dr - kMax), subCap);
  const lost = Math.max(0.0, Dr - kMax - subCap); // orders you simply cannot take
  const served = Dr - lost;
  const inhouse = served - sub;
  const over = Math.max(0.0, inhouse - nameplate);
  const ot = Math.min(over, kOT - nameplate);
  const s2 = Math.max(0.0, over - ot);
  const ur = Math.min(0.985, Math.max(0.05,
    d.u * inhouse / (nameplate * (1 + p.rho * (ot + s2) / nameplate))));
  // Sustained premium hours are not free variability-wise: fatigue, rushed work, rework on
  // overtime; lower proficiency and thinner supervision on a stood-up second shift.
  const ce2_eff = p.ce2 * (1 + 1.75 * ot / nameplate + 0.60 * s2 / nameplate);
  const q: ModelParams = { ...p, ce2: ce2_eff };
  const CTd = ctLine(ur, d, q, ca2) / (p.hpd * p.shifts * p.avail);
  const lateUnit = Math.max(0.0, CTd - p.leadDays) / 21.0 * 0.04 * p.asp;
  const sunk = (d.N * p.crew * d.A * p.rate
    + (p.plantFix + p.lineFix) * 12
    + cx.equip * CRF_EQ + cx.fac * CRF_FAC + 0.06 * cx.equip
    + (p.ownShell ? 0 : cx.gross * p.rentPSF));
  const varUnit = p.mat + p.mat * p.varOH + (cx.paintIn ? 900 : 2800);
  const cost = (sunk + varUnit * inhouse + ot * cOT + s2 * p.W * p.rate * 0.10
    + sub * p.subMark * vc
    + sub * p.subLateMo * 0.04 * p.asp + lateUnit * inhouse);
  const rev = p.asp * served;
  return {
    Dr, served, lost, u: ur, CTd, ot, s2, sub,
    unit: cost / Math.max(served, 1e-9), marginD: rev - cost,
    margin: (rev - cost) / Math.max(rev, 1e-9),
    // a unit counts as delivered on the promise only if it came off YOUR line
    // inside the promised flow time. Subcontracted and unserved orders do not.
    service: (CTd <= p.leadDays ? inhouse : 0.0) / Dr,
    onTime: CTd <= p.leadDays && sub < 0.5 && lost < 0.5,
  };
}

export interface Evaluation {
  d: Design; cx: Capex; base: PnlResult; nodes: PnlResult[]; sig: number; ca2: number;
  Eunit: number; Emargin: number; ECT: number; pLate: number; p10: number;
  Esub: number; Elost: number; EmarginD: number; Eservice: number; p10D: number; jensen: number; raw: number;
}

/** Full deterministic + distributional evaluation at a planned volume. */
export function evaluate(Dplan: number, p: ModelParams = DEFAULT_PARAMS): Evaluation {
  const d = design(Dplan, p);
  const cx = capex(Dplan, d, p);
  const sig = SIG_SPEC * (1 - p.theta) + SIG_CON * p.theta;
  const ca2 = CA2_SPEC * (1 - p.theta) + CA2_CON * p.theta;
  const base = pnlAt(Dplan, Dplan, d, cx, p, ca2);
  const sw = GH.reduce((s, [, w]) => s + w, 0);
  const s_ln = Math.sqrt(Math.log(1 + sig * sig)); // lognormal: demand stays positive, E[D]=Dplan
  const nodes: PnlResult[] = GH.map(([z, w]) => {
    const r = pnlAt(Dplan * Math.exp(s_ln * z - 0.5 * s_ln * s_ln), Dplan, d, cx, p, ca2);
    r.w = w / sw;
    return r;
  });
  const E = (k: keyof PnlResult) => nodes.reduce((s, n) => s + (n.w as number) * (n[k] as number), 0);
  const pLate = nodes.reduce((s, n) => s + (n.onTime ? 0 : (n.w as number)), 0);
  const dsort = [...nodes].sort((a, b) => a.margin - b.margin);
  let cum = 0, p10 = dsort[0].margin;
  for (const n of dsort) { cum += n.w as number; if (cum >= 0.10) { p10 = n.margin; break; } }
  const dsD = [...nodes].sort((a, b) => a.marginD - b.marginD);
  cum = 0; let p10D = dsD[0].marginD;
  for (const n of dsD) { cum += n.w as number; if (cum >= 0.10) { p10D = n.marginD; break; } }
  const hpd_eff = p.hpd * p.shifts * p.avail;
  return {
    d, cx, base, nodes, sig, ca2,
    Eunit: E('unit'), Emargin: E('margin'), ECT: E('CTd'), pLate, p10,
    Esub: E('sub'), Elost: E('lost'), EmarginD: E('marginD'), Eservice: E('service'),
    p10D, jensen: E('CTd') - base.CTd,
    raw: p.W * (1 - p.a * p.lam) / p.crew / hpd_eff,
  };
}

export type PlanCurvePoint = [D: number, Em: number, Sv: number, nameplate: number];
export interface OptimalPlan { D: number; Em: number; Sv: number; }

/** The newsvendor-flavoured core result: with demand centred on Dtrue and dispersion set
 * by contract coverage, what nameplate maximises expected margin dollars? */
export function optimalPlan(
  Dtrue: number, theta: number, p: ModelParams = DEFAULT_PARAMS, lo = 15, hi = 320
): { best: OptimalPlan; curve: PlanCurvePoint[] } {
  const q: ModelParams = { ...p, theta };
  const SL = p.SL ?? 0.95;
  const sig = SIG_SPEC * (1 - theta) + SIG_CON * theta;
  const ca2 = CA2_SPEC * (1 - theta) + CA2_CON * theta;
  const s_ln = Math.sqrt(Math.log(1 + sig * sig));
  const sw = GH.reduce((s, [, w]) => s + w, 0);
  let best: OptimalPlan | null = null;
  let bestOK = false;
  const curve: PlanCurvePoint[] = [];
  let D = lo;
  while (D <= hi) {
    const d = design(D, q);
    const cx = capex(D, d, q);
    const ns = GH.map(([z, w]) => {
      const n = pnlAt(Dtrue * Math.exp(s_ln * z - 0.5 * s_ln * s_ln), D, d, cx, q, ca2);
      return [w / sw, n] as [number, PnlResult];
    });
    const Em = ns.reduce((s, [w, n]) => s + w * n.marginD, 0);
    const Sv = ns.reduce((s, [w, n]) => s + w * n.service, 0);
    curve.push([D, Em, Sv, D / d.u]);
    // policy: the demand-matching levers are SURGE capacity held against variance, not a
    // substitute for nameplate. Regular time must cover the median of realised demand.
    const med = Dtrue * Math.exp(-0.5 * s_ln * s_ln);
    const regOK = D / d.u >= med;
    const ok = Sv >= SL && regOK;
    if (best === null || (ok ? 1 : 0) > (bestOK ? 1 : 0) ||
      ((ok ? 1 : 0) === (bestOK ? 1 : 0) && Em > best.Em)) {
      best = { D, Em, Sv };
      bestOK = ok;
    }
    D += D < 60 ? 1 : 2;
  }
  return { best: best as OptimalPlan, curve };
}
