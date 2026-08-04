// Battery voltage / current estimation and charging session simulation.
//
// The database gives us three things we can use to estimate pack voltage:
//   * `nominal_voltage_v`      - nominal pack voltage (present for ~80% of rows)
//   * `pack_configuration`     - e.g. "96s3p", the series/parallel cell layout
//   * `cathode_material`       - e.g. "NMC811", "LFP", used to pick an OCV shape
//
// Pack voltage at a given SoC is modelled as the nominal pack voltage scaled by
// the chemistry's open-circuit voltage curve, normalised at 50% SoC:
//
//     V(soc) = V_nominal * ocv(soc) / ocv(50)
//
// The series count cancels out of that expression, so it is only needed when the
// database has no nominal voltage and we have to build one from the cell count.

// Per-cell open circuit voltage vs SoC. Values are typical published cell data,
// not manufacturer specific, so everything derived from them is an estimate.
export const CHEMISTRY_PROFILES = {
  NMC: {
    label: 'NMC / NCA',
    nominalCellV: 3.68,
    ocv: [
      [0, 3.00], [5, 3.36], [10, 3.50], [20, 3.60], [30, 3.66], [40, 3.71],
      [50, 3.77], [60, 3.85], [70, 3.94], [80, 4.03], [90, 4.11], [100, 4.20],
    ],
  },
  LFP: {
    label: 'LFP',
    nominalCellV: 3.20,
    ocv: [
      [0, 2.80], [5, 3.11], [10, 3.20], [20, 3.22], [30, 3.25], [40, 3.27],
      [50, 3.29], [60, 3.30], [70, 3.31], [80, 3.33], [90, 3.36], [95, 3.42], [100, 3.65],
    ],
  },
  M3P: {
    label: 'M3P',
    nominalCellV: 3.50,
    ocv: [
      [0, 2.90], [10, 3.35], [30, 3.48], [50, 3.53], [70, 3.58], [90, 3.70], [100, 4.00],
    ],
  },
  LMO: {
    label: 'LMO',
    nominalCellV: 3.80,
    ocv: [
      [0, 3.20], [10, 3.55], [30, 3.75], [50, 3.85], [70, 3.95], [90, 4.08], [100, 4.20],
    ],
  },
  LMNO: {
    label: 'LMNO',
    nominalCellV: 4.70,
    ocv: [
      [0, 3.50], [10, 4.55], [30, 4.68], [50, 4.72], [70, 4.78], [90, 4.85], [100, 4.90],
    ],
  },
  LTO: {
    label: 'LTO',
    nominalCellV: 2.30,
    ocv: [
      [0, 1.80], [10, 2.10], [30, 2.24], [50, 2.30], [70, 2.36], [90, 2.48], [100, 2.70],
    ],
  },
};

export const DEFAULT_CHEMISTRY = 'NMC';

// Linear interpolation over an array of [x, y] pairs sorted by x. Clamps outside.
export function interpolate(points, x) {
  if (!points || points.length === 0) return 0;
  if (x <= points[0][0]) return points[0][1];
  const last = points[points.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < points.length - 1; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[i + 1];
    if (x >= x0 && x <= x1) {
      if (x1 === x0) return y0;
      return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
    }
  }
  return last[1];
}

// Map a raw `cathode_material` string onto one of CHEMISTRY_PROFILES.
export function normalizeChemistry(cathodeMaterial) {
  if (!cathodeMaterial) return null;
  const raw = String(cathodeMaterial).trim().toUpperCase();
  if (!raw) return null;
  if (raw.startsWith('LFP') || raw.startsWith('LIFEPO')) return 'LFP';
  if (raw.startsWith('M3P')) return 'M3P';
  if (raw.startsWith('LTO')) return 'LTO';
  if (raw.startsWith('LMNO') || raw.startsWith('LNMO')) return 'LMNO';
  if (raw.startsWith('LMO')) return 'LMO';
  // NMC, NCM, NMC811, NCM622, NCA, NCMA ... all share the layered-oxide shape.
  if (raw.startsWith('NMC') || raw.startsWith('NCM') || raw.startsWith('NCA') || raw.startsWith('NCMA')) return 'NMC';
  return null;
}

// "96s3p" -> 96, "198s2p" -> 198. Returns null when unparseable.
export function parseSeriesCount(packConfiguration) {
  if (!packConfiguration) return null;
  const match = String(packConfiguration).match(/(\d+)\s*s/i);
  if (!match) return null;
  const series = parseInt(match[1], 10);
  return Number.isFinite(series) && series > 0 ? series : null;
}

// "96s3p" -> 3. Returns null when unparseable.
export function parseParallelCount(packConfiguration) {
  if (!packConfiguration) return null;
  const match = String(packConfiguration).match(/(\d+)\s*p/i);
  if (!match) return null;
  const parallel = parseInt(match[1], 10);
  return Number.isFinite(parallel) && parallel > 0 ? parallel : null;
}

// A recorded nominal voltage and a recorded series count sometimes disagree.
// Anything outside this multiple of the chemistry's nominal cell voltage means
// one of the two fields is wrong.
const CELL_VOLTAGE_BAND = { low: 0.75, high: 1.20 };

// No production DC connector sustains this much current. An estimate above it
// means the modelled pack voltage is too low for the DC charging path.
export const DC_CONNECTOR_CURRENT_CEILING_A = 800;

// Cell resistance scales roughly inversely with cell capacity. Calibrated
// against a 21700 NMC cell (~4.8 Ah, ~25 mOhm DCIR): 4.8 * 0.025 ~= 0.12.
export const CELL_RESISTANCE_OHM_AH = 0.12;

/**
 * Pack DC internal resistance, in ohms.
 *
 * R_pack = (S/P) * R_cell and R_cell = K / C_cell, where the cell capacity
 * C_cell = E_Wh / (V_nom * P). The parallel count cancels out, leaving
 *
 *     R_pack = K * S * V_nom / E_Wh
 *
 * which needs only the series count and the pack energy. Checks out against a
 * Model 3 Long Range (96s, 355 V, 82 kWh): ~50 mOhm.
 */
export function estimatePackResistance({ seriesCount, nominalPackV, packEnergyKwh }) {
  if (!(seriesCount > 0) || !(nominalPackV > 0) || !(packEnergyKwh > 0)) return null;
  return (CELL_RESISTANCE_OHM_AH * seriesCount * nominalPackV) / (packEnergyKwh * 1000);
}

/**
 * Build a pack voltage model from database fields.
 * Returns null when there is not enough data to estimate a voltage.
 *
 * `packEnergyKwh` enables the internal resistance / voltage rise model, and
 * `peakDcPowerKw` enables detection of packs that reconfigure for DC charging.
 */
export function buildVoltageModel({
  packConfiguration,
  nominalVoltageV,
  cathodeMaterial,
  packEnergyKwh = null,
  peakDcPowerKw = null,
} = {}) {
  const chemistry = normalizeChemistry(cathodeMaterial);
  const chemistryKey = chemistry || DEFAULT_CHEMISTRY;
  const profile = CHEMISTRY_PROFILES[chemistryKey];

  const seriesCount = parseSeriesCount(packConfiguration);
  const parallelCount = parseParallelCount(packConfiguration);

  const dbNominal = Number(nominalVoltageV);
  const hasDbNominal = Number.isFinite(dbNominal) && dbNominal > 0;

  let nominalPackV = hasDbNominal
    ? dbNominal
    : (seriesCount ? seriesCount * profile.nominalCellV : null);

  if (!nominalPackV) return null;

  let nominalSource = hasDbNominal ? 'database' : 'derived';
  let seriesTrusted = Boolean(seriesCount);

  // The two fields disagree when they imply an impossible cell voltage. A
  // nominal that is too low for the series count is the recoverable case: the
  // cell count still gives a sane pack voltage. When it is too high the series
  // count is the suspect field, so keep the recorded voltage and stop trusting
  // the layout.
  if (hasDbNominal && seriesCount) {
    const impliedCellV = dbNominal / seriesCount;
    if (impliedCellV < profile.nominalCellV * CELL_VOLTAGE_BAND.low) {
      nominalPackV = seriesCount * profile.nominalCellV;
      nominalSource = 'series';
    } else if (impliedCellV > profile.nominalCellV * CELL_VOLTAGE_BAND.high) {
      seriesTrusted = false;
    }
  }

  // Packs built as two parallel halves can switch those halves into series for
  // DC charging, doubling the voltage and halving the current (GM Ultium does
  // this: the same 24 module pack is recorded both as 96s6p/355 V and as
  // 192s3p/650 V). Infer it when the recorded layout would otherwise demand
  // more current than any DC connector can deliver.
  let dcReconfigured = false;
  const peakKw = Number(peakDcPowerKw);
  if (
    Number.isFinite(peakKw) && peakKw > 0 &&
    parallelCount && parallelCount % 2 === 0 &&
    (peakKw * 1000) / nominalPackV > DC_CONNECTOR_CURRENT_CEILING_A
  ) {
    nominalPackV *= 2;
    dcReconfigured = true;
    nominalSource = 'reconfigured';
  }

  const ocv50 = interpolate(profile.ocv, 50);
  const effectiveSeries = (seriesTrusted && seriesCount ? seriesCount : Math.round(nominalPackV / profile.nominalCellV)) * (dcReconfigured ? 2 : 1);
  const safeSeries = Math.max(1, effectiveSeries);

  // Open circuit voltage - what the pack sits at with no current flowing.
  const openCircuitAtSoc = (soc) => nominalPackV * (interpolate(profile.ocv, soc) / ocv50);

  const resistanceOhms = estimatePackResistance({
    seriesCount: safeSeries,
    nominalPackV,
    packEnergyKwh: Number(packEnergyKwh) || null,
  });

  // Terminal voltage under load: V = OCV + I*R, and P = V*I, so
  // R*I^2 + OCV*I - P = 0. Solving the positive root gives the current.
  const currentAtPower = (powerKw, soc) => {
    const ocv = openCircuitAtSoc(soc);
    const watts = Math.max(0, powerKw) * 1000;
    if (!resistanceOhms || resistanceOhms <= 0) return watts / ocv;
    return (-ocv + Math.sqrt(ocv * ocv + 4 * resistanceOhms * watts)) / (2 * resistanceOhms);
  };

  const terminalVoltageAtPower = (powerKw, soc) => {
    const ocv = openCircuitAtSoc(soc);
    if (!resistanceOhms || resistanceOhms <= 0) return ocv;
    return ocv + currentAtPower(powerKw, soc) * resistanceOhms;
  };

  // Power a current limit allows, accounting for the voltage rise it causes.
  const powerAtCurrent = (currentA, soc) => {
    const ocv = openCircuitAtSoc(soc);
    const terminal = ocv + (resistanceOhms > 0 ? currentA * resistanceOhms : 0);
    return (terminal * currentA) / 1000;
  };

  return {
    chemistry: chemistryKey,
    chemistryLabel: profile.label,
    chemistryKnown: Boolean(chemistry),
    seriesCount: safeSeries,
    seriesFromDb: seriesTrusted && Boolean(seriesCount),
    parallelCount: dcReconfigured && parallelCount ? parallelCount / 2 : parallelCount,
    nominalPackV,
    nominalSource,
    dcReconfigured,
    resistanceOhms,
    cellNominalV: nominalPackV / safeSeries,
    minPackV: openCircuitAtSoc(0),
    maxPackV: openCircuitAtSoc(100),
    openCircuitAtSoc,
    currentAtPower,
    terminalVoltageAtPower,
    powerAtCurrent,
    // Kept for callers that only need an open circuit estimate.
    voltageAtSoc: openCircuitAtSoc,
  };
}

/**
 * Time based charging current limit.
 * `initialCurrentA` applies for the first `derateAfterMinutes`, then
 * `deratedCurrentA` applies for the rest of the session.
 */
export function makeCurrentLimiter(config) {
  if (!config || !config.enabled) return null;

  const initialA = Number(config.initialCurrentA);
  const hasInitial = Number.isFinite(initialA) && initialA > 0;
  const deratedA = Number(config.deratedCurrentA);
  const hasDerate = Number.isFinite(deratedA) && deratedA > 0;
  const afterMin = Number(config.derateAfterMinutes);
  const hasAfter = Number.isFinite(afterMin) && afterMin > 0;

  if (!hasInitial && !hasDerate) return null;

  const first = hasInitial ? initialA : deratedA;
  const second = hasDerate ? deratedA : first;
  const boundaryMin = hasAfter && hasDerate ? afterMin : Infinity;

  return {
    boundaryMin,
    initialCurrentA: first,
    deratedCurrentA: second,
    // Limit in amps at `minutes` into the session.
    limitAt: (minutes) => (minutes < boundaryMin ? first : second),
    // Next time the limit changes, or Infinity when it never does again.
    nextChangeAt: (minutes) => (minutes < boundaryMin ? boundaryMin : Infinity),
  };
}

// Interpolate kW from a [{soc, kw}] curve.
export function makeCurveLookup(curve) {
  const points = Array.isArray(curve) ? curve.filter(p => p && Number.isFinite(p.soc)) : [];
  if (points.length === 0) return () => 0;
  const sorted = [...points].sort((a, b) => a.soc - b.soc);
  return (soc) => {
    const exact = sorted.find(p => p.soc === soc);
    if (exact) return exact.kw;
    const lower = sorted.filter(p => p.soc < soc).pop();
    const upper = sorted.find(p => p.soc > soc);
    if (!lower) return upper ? upper.kw : 0;
    if (!upper) return lower.kw;
    return lower.kw + (upper.kw - lower.kw) * ((soc - lower.soc) / (upper.soc - lower.soc));
  };
}

const MIN_POWER_KW = 1; // sanity floor, matches the original time integration
const MAX_SUB_STEPS = 8;

/**
 * Walk a charging session from `startSoc` upwards, honouring the vehicle curve,
 * the station power limit and (optionally) a time based current limit.
 *
 * Returns cumulative time at every SoC breakpoint plus session totals over
 * [startSoc, stopSoc]. `endSoc` controls how far past `stopSoc` the timeline is
 * carried, which the chart uses to draw a full time axis.
 */
export function simulateCharge({
  curve,
  batteryKwh,
  chargerPowerKw,
  startSoc,
  stopSoc,
  endSoc = 100,
  voltageModel = null,
  currentLimiter = null,
  dwellMinutes = 0,
}) {
  const empty = {
    points: [],
    socTime: [],
    timeAtSoc: () => 0,
    chargeMins: 0,
    timeMins: 0,
    kwhAdded: 0,
    avgPowerKw: 0,
    peakPowerKw: 0,
    peakCurrentA: null,
    avgCurrentA: null,
    minVoltageV: null,
    maxVoltageV: null,
  };

  const points = Array.isArray(curve) ? curve.filter(p => p && Number.isFinite(p.soc)) : [];
  if (points.length === 0 || !(batteryKwh > 0)) return empty;

  const safeStart = Math.max(0, Math.min(startSoc, 99));
  const safeStop = Math.max(safeStart + 1, Math.min(stopSoc, 100));
  const safeEnd = Math.max(safeStop, Math.min(endSoc, 100));

  const getKwAtSoc = makeCurveLookup(points);
  const powerCapAt = (soc, minutes) => {
    const ideal = getKwAtSoc(soc);
    let actual = Math.min(ideal, chargerPowerKw);
    let limitKw = null;

    // A current limit allows more power than current x OCV, because the pack
    // terminal voltage rises with the current being pushed into it.
    if (currentLimiter && voltageModel) {
      limitKw = voltageModel.powerAtCurrent(currentLimiter.limitAt(minutes), soc);
      actual = Math.min(actual, limitKw);
    }

    const applied = Math.max(MIN_POWER_KW, actual);
    const realKw = Math.min(applied, ideal);

    let currentA = null;
    let terminalV = null;
    let ocvV = null;
    if (voltageModel) {
      ocvV = voltageModel.openCircuitAtSoc(soc);
      currentA = voltageModel.currentAtPower(realKw, soc);
      terminalV = voltageModel.terminalVoltageAtPower(realKw, soc);
    }
    return { ideal, actual: applied, realKw, currentA, terminalV, ocvV, limitKw };
  };

  // Breakpoints: every curve SoC in range plus the session boundaries.
  const grid = new Set([safeStart, safeStop, safeEnd]);
  points.forEach(p => { if (p.soc > safeStart && p.soc < safeEnd) grid.add(p.soc); });
  const socGrid = [...grid].filter(s => s >= safeStart && s <= safeEnd).sort((a, b) => a - b);

  const socTime = [{ soc: safeStart, timeMin: 0 }];
  let elapsedMin = 0;

  for (let i = 0; i < socGrid.length - 1; i++) {
    const a = socGrid[i];
    const b = socGrid[i + 1];
    let energyLeft = (batteryKwh * (b - a)) / 100;
    let guard = 0;

    while (energyLeft > 1e-9 && guard < MAX_SUB_STEPS) {
      guard += 1;
      const { actual } = powerCapAt(a, elapsedMin);
      const minsNeeded = (energyLeft / actual) * 60;
      const nextChange = currentLimiter ? currentLimiter.nextChangeAt(elapsedMin) : Infinity;
      const minsToChange = nextChange === Infinity ? Infinity : nextChange - elapsedMin;

      if (minsNeeded <= minsToChange || guard === MAX_SUB_STEPS) {
        elapsedMin += minsNeeded;
        energyLeft = 0;
      } else {
        elapsedMin += minsToChange;
        energyLeft -= (actual * minsToChange) / 60;
      }
    }
    socTime.push({ soc: b, timeMin: elapsedMin });
  }

  const timeAtSoc = (soc) => interpolate(socTime.map(s => [s.soc, s.timeMin]), soc);

  // Per curve point detail, index aligned with the input curve for chart editing.
  const detail = (Array.isArray(curve) ? curve : []).map(p => {
    if (!p || !Number.isFinite(p.soc)) return null;
    const inSession = p.soc >= safeStart && p.soc <= safeEnd;
    const timeMin = inSession ? timeAtSoc(p.soc) : null;
    const { ideal, realKw, currentA, terminalV, ocvV, limitKw } = powerCapAt(p.soc, timeMin == null ? 0 : timeMin);
    return {
      soc: p.soc,
      idealKw: ideal,
      realKw,
      // Current the vehicle would pull if nothing but its own curve applied.
      idealCurrentA: voltageModel ? voltageModel.currentAtPower(ideal, p.soc) : null,
      voltageV: terminalV,
      openCircuitV: ocvV,
      currentA,
      // Power ceiling imposed by the active current limit, for the chart.
      currentLimitKw: limitKw,
      timeMin,
    };
  });

  const inWindow = detail.filter(d => d && d.soc >= safeStart && d.soc <= safeStop);
  const currents = inWindow.map(d => d.currentA).filter(c => Number.isFinite(c));
  const voltages = inWindow.map(d => d.voltageV).filter(v => Number.isFinite(v));

  const chargeMins = timeAtSoc(safeStop);
  const kwhAdded = (batteryKwh * (safeStop - safeStart)) / 100;
  const chargeHours = chargeMins / 60;

  return {
    points: detail,
    socTime,
    timeAtSoc,
    chargeMins,
    timeMins: chargeMins + (dwellMinutes || 0),
    kwhAdded,
    avgPowerKw: chargeHours > 0 ? kwhAdded / chargeHours : 0,
    peakPowerKw: inWindow.length ? Math.max(...inWindow.map(d => d.realKw)) : 0,
    peakCurrentA: currents.length ? Math.max(...currents) : null,
    avgCurrentA: currents.length ? currents.reduce((sum, c) => sum + c, 0) / currents.length : null,
    minVoltageV: voltages.length ? Math.min(...voltages) : null,
    maxVoltageV: voltages.length ? Math.max(...voltages) : null,
  };
}
