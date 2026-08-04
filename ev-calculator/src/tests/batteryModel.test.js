import { describe, it, expect } from 'vitest';
import {
  CHEMISTRY_PROFILES,
  DC_CONNECTOR_CURRENT_CEILING_A,
  interpolate,
  normalizeChemistry,
  parseSeriesCount,
  parseParallelCount,
  estimatePackResistance,
  buildVoltageModel,
  makeCurrentLimiter,
  makeCurveLookup,
  simulateCharge,
} from '../batteryModel';

// A flat 100 kW curve makes hand-checking the time integration easy.
const flatCurve = Array.from({ length: 101 }, (_, soc) => ({ soc, kw: 100 }));

describe('interpolate', () => {
  it('clamps outside the range', () => {
    expect(interpolate([[0, 1], [10, 2]], -5)).toBe(1);
    expect(interpolate([[0, 1], [10, 2]], 50)).toBe(2);
  });

  it('interpolates linearly between points', () => {
    expect(interpolate([[0, 0], [10, 10]], 5)).toBe(5);
  });

  it('returns 0 for empty input', () => {
    expect(interpolate([], 5)).toBe(0);
  });
});

describe('normalizeChemistry', () => {
  it('maps the layered oxide family onto NMC', () => {
    ['NMC', 'nmc811', 'NCM622', 'NCA', 'NCMA'].forEach(raw => {
      expect(normalizeChemistry(raw)).toBe('NMC');
    });
  });

  it('recognises the other chemistries in the database', () => {
    expect(normalizeChemistry('LFP')).toBe('LFP');
    expect(normalizeChemistry('M3P')).toBe('M3P');
    expect(normalizeChemistry('LMO')).toBe('LMO');
    expect(normalizeChemistry('LTO')).toBe('LTO');
    expect(normalizeChemistry('LMNO')).toBe('LMNO');
  });

  it('returns null for missing or unknown values', () => {
    expect(normalizeChemistry('')).toBeNull();
    expect(normalizeChemistry(null)).toBeNull();
    expect(normalizeChemistry('unobtainium')).toBeNull();
  });
});

describe('pack configuration parsing', () => {
  it('reads series and parallel counts', () => {
    expect(parseSeriesCount('96s3p')).toBe(96);
    expect(parseParallelCount('96s3p')).toBe(3);
    expect(parseSeriesCount('198s2p')).toBe(198);
    expect(parseSeriesCount('110s72p')).toBe(110);
  });

  it('returns null when unparseable', () => {
    expect(parseSeriesCount('')).toBeNull();
    expect(parseSeriesCount(null)).toBeNull();
    expect(parseSeriesCount('unknown')).toBeNull();
    expect(parseParallelCount('96s')).toBeNull();
  });
});

describe('buildVoltageModel', () => {
  it('uses the database nominal voltage when present', () => {
    const model = buildVoltageModel({
      packConfiguration: '96s3p',
      nominalVoltageV: 355.2,
      cathodeMaterial: 'NCMA',
    });
    expect(model.nominalPackV).toBe(355.2);
    expect(model.seriesCount).toBe(96);
    expect(model.seriesFromDb).toBe(true);
    expect(model.chemistry).toBe('NMC');
    expect(model.nominalSource).toBe('database');
    // ~3.7 V per cell
    expect(model.cellNominalV).toBeCloseTo(3.7, 2);
  });

  it('derives the pack voltage from the series count when nominal is missing', () => {
    const model = buildVoltageModel({ packConfiguration: '100s2p', cathodeMaterial: 'LFP' });
    expect(model.nominalSource).toBe('derived');
    expect(model.nominalPackV).toBeCloseTo(100 * CHEMISTRY_PROFILES.LFP.nominalCellV, 6);
  });

  it('derives a series count when only the nominal voltage is known', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400 });
    expect(model.seriesFromDb).toBe(false);
    expect(model.seriesCount).toBe(Math.round(400 / CHEMISTRY_PROFILES.NMC.nominalCellV));
  });

  it('assumes NMC when the chemistry is unknown', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: '' });
    expect(model.chemistry).toBe('NMC');
    expect(model.chemistryKnown).toBe(false);
  });

  it('returns null without any voltage or pack data', () => {
    expect(buildVoltageModel({ cathodeMaterial: 'NMC' })).toBeNull();
    expect(buildVoltageModel({})).toBeNull();
    expect(buildVoltageModel()).toBeNull();
  });

  it('rises monotonically with SoC and equals nominal at 50%', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC' });
    expect(model.voltageAtSoc(50)).toBeCloseTo(400, 6);
    expect(model.voltageAtSoc(0)).toBeLessThan(model.voltageAtSoc(50));
    expect(model.voltageAtSoc(50)).toBeLessThan(model.voltageAtSoc(100));
    // A 400 V class pack should top out in a plausible range, not double.
    expect(model.maxPackV).toBeGreaterThan(420);
    expect(model.maxPackV).toBeLessThan(470);
  });

  it('keeps LFP much flatter than NMC across the middle of the range', () => {
    const lfp = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'LFP' });
    const nmc = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC' });
    const lfpSpread = lfp.voltageAtSoc(80) - lfp.voltageAtSoc(20);
    const nmcSpread = nmc.voltageAtSoc(80) - nmc.voltageAtSoc(20);
    expect(lfpSpread).toBeLessThan(nmcSpread);
  });
});

describe('estimatePackResistance', () => {
  it('lands near the known figure for a Model 3 Long Range pack', () => {
    // 96s, 355 V nominal, 82 kWh gross -> roughly 50 mOhm
    const r = estimatePackResistance({ seriesCount: 96, nominalPackV: 355.2, packEnergyKwh: 82 });
    expect(r).toBeGreaterThan(0.04);
    expect(r).toBeLessThan(0.06);
  });

  it('gives a higher resistance to an 800 V pack of the same energy', () => {
    const low = estimatePackResistance({ seriesCount: 96, nominalPackV: 355, packEnergyKwh: 84 });
    const high = estimatePackResistance({ seriesCount: 192, nominalPackV: 710, packEnergyKwh: 84 });
    expect(high).toBeGreaterThan(low);
  });

  it('returns null without enough data', () => {
    expect(estimatePackResistance({ seriesCount: 96, nominalPackV: 355 })).toBeNull();
    expect(estimatePackResistance({ nominalPackV: 355, packEnergyKwh: 82 })).toBeNull();
  });
});

describe('voltage rise under load', () => {
  const model = () => buildVoltageModel({
    packConfiguration: '96s46p',
    nominalVoltageV: 355.2,
    cathodeMaterial: 'NMC',
    packEnergyKwh: 82,
  });

  it('raises the terminal voltage above open circuit while charging', () => {
    const m = model();
    expect(m.resistanceOhms).toBeGreaterThan(0);
    const ocv = m.openCircuitAtSoc(10);
    const terminal = m.terminalVoltageAtPower(250, 10);
    expect(terminal).toBeGreaterThan(ocv);
    // A 250 kW charge should lift a 400 V class pack by tens of volts, not hundreds
    expect(terminal - ocv).toBeGreaterThan(20);
    expect(terminal - ocv).toBeLessThan(90);
  });

  it('reports less current than the naive power over open circuit voltage', () => {
    const m = model();
    const naive = (250 * 1000) / m.openCircuitAtSoc(10);
    expect(m.currentAtPower(250, 10)).toBeLessThan(naive);
  });

  it('keeps power and current consistent', () => {
    const m = model();
    const amps = m.currentAtPower(250, 30);
    const volts = m.terminalVoltageAtPower(250, 30);
    expect((amps * volts) / 1000).toBeCloseTo(250, 3);
    // powerAtCurrent is the inverse of currentAtPower
    expect(m.powerAtCurrent(amps, 30)).toBeCloseTo(250, 3);
  });

  it('falls back to open circuit voltage when pack energy is unknown', () => {
    const m = buildVoltageModel({ packConfiguration: '96s46p', nominalVoltageV: 355.2, cathodeMaterial: 'NMC' });
    expect(m.resistanceOhms).toBeNull();
    expect(m.terminalVoltageAtPower(250, 10)).toBeCloseTo(m.openCircuitAtSoc(10), 6);
  });
});

describe('DC pack reconfiguration', () => {
  // GM Ultium: the same 24 module pack is recorded both as 96s6p / 355 V and
  // as 192s3p / 650 V, because it switches its halves into series for DC.
  const ultium = (peakDcPowerKw) => buildVoltageModel({
    packConfiguration: '96s6p',
    nominalVoltageV: 355,
    cathodeMaterial: 'NCMA',
    packEnergyKwh: 225,
    peakDcPowerKw,
  });

  it('doubles the pack voltage when the recorded layout demands impossible current', () => {
    const m = ultium(362);
    expect(m.dcReconfigured).toBe(true);
    expect(m.nominalPackV).toBe(710);
    expect(m.seriesCount).toBe(192);
    expect(m.parallelCount).toBe(3);
    expect(m.nominalSource).toBe('reconfigured');
  });

  it('brings the peak current under the connector ceiling', () => {
    const m = ultium(362);
    expect(m.currentAtPower(362, 20)).toBeLessThan(DC_CONNECTOR_CURRENT_CEILING_A);
  });

  it('agrees with the same pack recorded in its reconfigured form', () => {
    const asFourHundred = ultium(362);
    const asEightHundred = buildVoltageModel({
      packConfiguration: '192s3p',
      nominalVoltageV: 650,
      cathodeMaterial: 'NMC',
      packEnergyKwh: 200,
      peakDcPowerKw: 362,
    });
    expect(asEightHundred.dcReconfigured).toBe(false);
    // Within 15% of each other rather than a factor of two apart
    const ratio = asFourHundred.currentAtPower(362, 20) / asEightHundred.currentAtPower(362, 20);
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.15);
  });

  it('leaves a high current 400 V pack alone when it stays under the ceiling', () => {
    // Tesla Model 3 Long Range pulls ~680 A and does not reconfigure
    const m = buildVoltageModel({
      packConfiguration: '96s46p',
      nominalVoltageV: 355.2,
      cathodeMaterial: 'NMC',
      packEnergyKwh: 82,
      peakDcPowerKw: 250,
    });
    expect(m.dcReconfigured).toBe(false);
    expect(m.nominalPackV).toBe(355.2);
  });

  it('will not reconfigure a pack with an odd parallel count', () => {
    const m = buildVoltageModel({
      packConfiguration: '198s1p',
      nominalVoltageV: 370,
      cathodeMaterial: 'NMC811',
      packEnergyKwh: 102,
      peakDcPowerKw: 520,
    });
    expect(m.dcReconfigured).toBe(false);
  });

  it('does nothing without a peak power to test against', () => {
    expect(ultium(null).dcReconfigured).toBe(false);
  });
});

describe('inconsistent voltage and series data', () => {
  it('trusts the series count when the recorded nominal is far too low', () => {
    // Li Auto Mega: 198s1p recorded at 370 V implies 1.87 V per cell
    const m = buildVoltageModel({ packConfiguration: '198s1p', nominalVoltageV: 370, cathodeMaterial: 'NMC811' });
    expect(m.nominalSource).toBe('series');
    expect(m.nominalPackV).toBeCloseTo(198 * CHEMISTRY_PROFILES.NMC.nominalCellV, 6);
  });

  it('trusts the recorded nominal when the series count is far too low', () => {
    // Hummer 24s10p recorded at 650 V implies 27 V per cell - the layout is wrong
    const m = buildVoltageModel({ packConfiguration: '24s10p', nominalVoltageV: 650, cathodeMaterial: 'NMC' });
    expect(m.nominalPackV).toBe(650);
    expect(m.seriesFromDb).toBe(false);
  });

  it('leaves consistent data untouched', () => {
    const m = buildVoltageModel({ packConfiguration: '96s3p', nominalVoltageV: 355.2, cathodeMaterial: 'NCMA' });
    expect(m.nominalSource).toBe('database');
    expect(m.nominalPackV).toBe(355.2);
    expect(m.seriesFromDb).toBe(true);
  });
});

describe('makeCurrentLimiter', () => {
  it('returns null when disabled or unconfigured', () => {
    expect(makeCurrentLimiter(null)).toBeNull();
    expect(makeCurrentLimiter({ enabled: false, initialCurrentA: 500 })).toBeNull();
    expect(makeCurrentLimiter({ enabled: true })).toBeNull();
  });

  it('applies the initial current then the derated current', () => {
    const limiter = makeCurrentLimiter({
      enabled: true,
      initialCurrentA: 500,
      deratedCurrentA: 300,
      derateAfterMinutes: 10,
    });
    expect(limiter.limitAt(0)).toBe(500);
    expect(limiter.limitAt(9.99)).toBe(500);
    expect(limiter.limitAt(10)).toBe(300);
    expect(limiter.limitAt(45)).toBe(300);
    expect(limiter.nextChangeAt(0)).toBe(10);
    expect(limiter.nextChangeAt(20)).toBe(Infinity);
  });

  it('holds a single current when no derate time is given', () => {
    const limiter = makeCurrentLimiter({ enabled: true, initialCurrentA: 400, deratedCurrentA: 200 });
    expect(limiter.limitAt(0)).toBe(400);
    expect(limiter.limitAt(999)).toBe(400);
  });
});

describe('makeCurveLookup', () => {
  it('interpolates between curve points', () => {
    const lookup = makeCurveLookup([{ soc: 0, kw: 100 }, { soc: 10, kw: 200 }]);
    expect(lookup(0)).toBe(100);
    expect(lookup(5)).toBe(150);
    expect(lookup(10)).toBe(200);
  });

  it('clamps outside the curve', () => {
    const lookup = makeCurveLookup([{ soc: 10, kw: 100 }, { soc: 20, kw: 50 }]);
    expect(lookup(0)).toBe(100);
    expect(lookup(90)).toBe(50);
  });
});

describe('simulateCharge', () => {
  it('returns an empty result without a curve or battery', () => {
    const none = simulateCharge({ curve: [], batteryKwh: 77, chargerPowerKw: 350, startSoc: 10, stopSoc: 80 });
    expect(none.timeMins).toBe(0);
    expect(none.points).toEqual([]);
  });

  it('matches the closed form time for a flat curve', () => {
    // 70% of 100 kWh at a flat 100 kW = 0.7 h = 42 min
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
    });
    expect(sim.chargeMins).toBeCloseTo(42, 6);
    expect(sim.kwhAdded).toBeCloseTo(70, 6);
    expect(sim.avgPowerKw).toBeCloseTo(100, 6);
  });

  it('adds dwell time to the session total but not to the charge time', () => {
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      dwellMinutes: 5,
    });
    expect(sim.chargeMins).toBeCloseTo(42, 6);
    expect(sim.timeMins).toBeCloseTo(47, 6);
  });

  it('caps power at the station limit', () => {
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 50,
      startSoc: 10,
      stopSoc: 80,
    });
    // 70 kWh at 50 kW = 1.4 h
    expect(sim.chargeMins).toBeCloseTo(84, 6);
    expect(sim.peakPowerKw).toBeCloseTo(50, 6);
  });

  it('derives current from power and pack voltage', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC' });
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 50,
      stopSoc: 51,
      voltageModel: model,
    });
    // 100 kW at 400 V = 250 A
    expect(sim.peakCurrentA).toBeCloseTo(250, 0);
  });

  it('limits power by current when a limiter is supplied', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC' });
    const limiter = makeCurrentLimiter({ enabled: true, initialCurrentA: 100 });
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 50,
      stopSoc: 51,
      voltageModel: model,
      currentLimiter: limiter,
    });
    expect(sim.peakCurrentA).toBeCloseTo(100, 0);
    // 100 A at ~400 V is ~40 kW, well under the 100 kW curve
    expect(sim.peakPowerKw).toBeLessThan(45);
    expect(sim.peakPowerKw).toBeGreaterThan(35);
  });

  it('has no effect from a current limiter when the pack voltage is unknown', () => {
    const limiter = makeCurrentLimiter({ enabled: true, initialCurrentA: 10 });
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      currentLimiter: limiter,
    });
    expect(sim.chargeMins).toBeCloseTo(42, 6);
    expect(sim.peakCurrentA).toBeNull();
  });

  it('switches to the derated current partway through the session', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC' });
    const withDerate = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      voltageModel: model,
      currentLimiter: makeCurrentLimiter({
        enabled: true,
        initialCurrentA: 400,
        deratedCurrentA: 150,
        derateAfterMinutes: 5,
      }),
    });
    const noDerate = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      voltageModel: model,
      currentLimiter: makeCurrentLimiter({ enabled: true, initialCurrentA: 400 }),
    });
    // Derating to 150 A must make the session take materially longer
    expect(withDerate.chargeMins).toBeGreaterThan(noDerate.chargeMins);
    // 400 A never binds here - the 100 kW curve is the tighter limit - so the
    // peak current is the same in both runs and stays under the cap.
    expect(withDerate.peakCurrentA).toBeCloseTo(noDerate.peakCurrentA, 6);
    expect(withDerate.peakCurrentA).toBeLessThan(400);
  });

  it('lets a current limit deliver more power than current times open circuit voltage', () => {
    const model = buildVoltageModel({
      packConfiguration: '96s46p',
      nominalVoltageV: 355.2,
      cathodeMaterial: 'NMC',
      packEnergyKwh: 82,
    });
    // 200 A is well under the flat 100 kW curve, so the current limit binds.
    const limiter = makeCurrentLimiter({ enabled: true, initialCurrentA: 200 });
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 82,
      chargerPowerKw: 350,
      startSoc: 20,
      stopSoc: 21,
      voltageModel: model,
      currentLimiter: limiter,
    });
    const naiveKw = (200 * model.openCircuitAtSoc(20)) / 1000;
    expect(sim.peakPowerKw).toBeGreaterThan(naiveKw);
    expect(sim.peakPowerKw).toBeLessThan(100);
    expect(sim.peakCurrentA).toBeCloseTo(200, 0);
  });

  it('exposes the current limit ceiling per point for the chart', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC', packEnergyKwh: 80 });
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 80,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      voltageModel: model,
      currentLimiter: makeCurrentLimiter({ enabled: true, initialCurrentA: 200 }),
    });
    const inSession = sim.points.filter(p => p.timeMin != null);
    inSession.forEach(p => {
      expect(Number.isFinite(p.currentLimitKw)).toBe(true);
      expect(Number.isFinite(p.idealCurrentA)).toBe(true);
      expect(Number.isFinite(p.openCircuitV)).toBe(true);
      // Terminal voltage is at or above open circuit
      expect(p.voltageV).toBeGreaterThanOrEqual(p.openCircuitV - 1e-9);
    });
  });

  it('leaves currentLimitKw null when no limiter is set', () => {
    const model = buildVoltageModel({ nominalVoltageV: 400, cathodeMaterial: 'NMC', packEnergyKwh: 80 });
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 80,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      voltageModel: model,
    });
    expect(sim.points[50].currentLimitKw).toBeNull();
  });

  it('reports a monotonic timeline aligned with the input curve', () => {
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 10,
      stopSoc: 80,
      endSoc: 100,
    });
    expect(sim.points).toHaveLength(flatCurve.length);
    sim.points.forEach((p, i) => expect(p.soc).toBe(flatCurve[i].soc));

    // Points before the start of the charge carry no elapsed time
    expect(sim.points[5].timeMin).toBeNull();
    expect(sim.points[10].timeMin).toBeCloseTo(0, 6);
    expect(sim.points[100].timeMin).toBeCloseTo(54, 6); // 90% of 100 kWh at 100 kW

    const times = sim.points.filter(p => p.timeMin != null).map(p => p.timeMin);
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });

  it('handles an inverted SoC range without hanging', () => {
    const sim = simulateCharge({
      curve: flatCurve,
      batteryKwh: 100,
      chargerPowerKw: 350,
      startSoc: 80,
      stopSoc: 20,
    });
    expect(Number.isFinite(sim.chargeMins)).toBe(true);
    expect(sim.chargeMins).toBeGreaterThan(0);
  });
});
