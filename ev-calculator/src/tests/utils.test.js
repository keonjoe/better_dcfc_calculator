import { describe, it, expect } from 'vitest';

/**
 * Utility Functions Tests
 * Tests for common calculation and conversion utilities
 */

describe('Conversion Utilities', () => {
  describe('Unit Conversions', () => {
    it('converts gallons to liters correctly', () => {
      const GAL_TO_L = 3.78541;
      expect(1 * GAL_TO_L).toBeCloseTo(3.78541, 4);
      expect(10 * GAL_TO_L).toBeCloseTo(37.8541, 4);
    });

    it('converts miles to kilometers correctly', () => {
      const MI_TO_KM = 1.60934;
      expect(1 * MI_TO_KM).toBeCloseTo(1.60934, 4);
      expect(100 * MI_TO_KM).toBeCloseTo(160.934, 4);
    });

    it('converts kg to lbs correctly', () => {
      const KG_TO_LBS = 2.20462;
      expect(1 * KG_TO_LBS).toBeCloseTo(2.20462, 4);
      expect(50 * KG_TO_LBS).toBeCloseTo(110.231, 3);
    });
  });

  describe('Energy Calculations', () => {
    it('calculates energy from battery capacity and SOC range', () => {
      const batteryCapacity = 75; // kWh
      const startSOC = 20; // %
      const stopSOC = 80; // %
      
      const energyAdded = (batteryCapacity * (stopSOC - startSOC)) / 100;
      
      expect(energyAdded).toBe(45); // 75 * 0.6 = 45 kWh
    });

    it('calculates charging time from energy and power', () => {
      const energy = 45; // kWh
      const averagePower = 50; // kW
      
      const time = (energy / averagePower) * 60; // minutes
      
      expect(time).toBe(54); // 45/50 * 60 = 54 minutes
    });

    it('calculates cost from energy and rate', () => {
      const energy = 45; // kWh
      const rate = 0.40; // $/kWh
      
      const cost = energy * rate;
      
      expect(cost).toBe(18); // $18
    });
  });

  describe('CO2 Calculations', () => {
    it('calculates gas vehicle CO2 emissions', () => {
      const CO2_PER_GAL_GAS_KG = 8.887;
      const UPSTREAM_GAS_CO2_KG = 2.5;
      const TOTAL_GAS_CO2E_PER_GAL = CO2_PER_GAL_GAS_KG + UPSTREAM_GAS_CO2_KG;
      
      expect(TOTAL_GAS_CO2E_PER_GAL).toBeCloseTo(11.387, 2);
      
      // 1000 miles at 30 MPG
      const gallonsUsed = 1000 / 30;
      const totalCO2 = gallonsUsed * TOTAL_GAS_CO2E_PER_GAL;
      
      expect(totalCO2).toBeCloseTo(379.57, 2);
    });

    it('calculates EV battery manufacturing emissions', () => {
      const BATTERY_MFG_CO2_PER_KWH_KG = 100;
      const batteryCapacity = 75; // kWh
      
      const manufacturingEmissions = batteryCapacity * BATTERY_MFG_CO2_PER_KWH_KG;
      
      expect(manufacturingEmissions).toBe(7500); // kg CO2
    });

    it('calculates grid electricity emissions', () => {
      const gridEmissionFactor = 0.5; // kg CO2 per kWh
      const energyConsumed = 1000; // kWh
      
      const totalEmissions = energyConsumed * gridEmissionFactor;
      
      expect(totalEmissions).toBe(500); // kg CO2
    });
  });

  describe('Cost Calculations', () => {
    it('calculates annual fuel cost', () => {
      const annualMiles = 12000;
      const mpg = 30;
      const fuelPrice = 3.50; // per gallon
      
      const annualGallons = annualMiles / mpg;
      const annualCost = annualGallons * fuelPrice;
      
      expect(annualCost).toBe(1400);
    });

    it('calculates annual electricity cost', () => {
      const annualMiles = 12000;
      const efficiency = 3.5; // miles per kWh
      const electricityRate = 0.13; // per kWh
      
      const annualKwh = annualMiles / efficiency;
      const annualCost = annualKwh * electricityRate;
      
      expect(annualCost).toBeCloseTo(445.71, 2);
    });

    it('calculates total ownership cost over time', () => {
      const purchasePrice = 40000;
      const annualFuelCost = 1400;
      const annualMaintenance = 500;
      const annualInsurance = 1200;
      const years = 5;
      
      const totalCost = purchasePrice + 
                       (annualFuelCost * years) + 
                       (annualMaintenance * years) + 
                       (annualInsurance * years);
      
      expect(totalCost).toBe(55500);
    });
  });

  describe('Efficiency Calculations', () => {
    it('calculates MPGe (Miles Per Gallon equivalent)', () => {
      const milesPerKwh = 3.5;
      const KWH_PER_GALLON_GAS_EQUIV = 33.7; // EPA standard
      
      const mpge = milesPerKwh * KWH_PER_GALLON_GAS_EQUIV;
      
      expect(mpge).toBeCloseTo(117.95, 2);
    });

    it('calculates charging efficiency loss', () => {
      const batteryEnergy = 50; // kWh
      const efficiency = 0.90; // 90% efficient
      
      const gridEnergy = batteryEnergy / efficiency;
      const loss = gridEnergy - batteryEnergy;
      
      expect(gridEnergy).toBeCloseTo(55.56, 2);
      expect(loss).toBeCloseTo(5.56, 2);
    });
  });

  describe('SOC (State of Charge) Calculations', () => {
    it('validates SOC is within 0-100%', () => {
      const validateSOC = (soc) => soc >= 0 && soc <= 100;
      
      expect(validateSOC(0)).toBe(true);
      expect(validateSOC(50)).toBe(true);
      expect(validateSOC(100)).toBe(true);
      expect(validateSOC(-1)).toBe(false);
      expect(validateSOC(101)).toBe(false);
    });

    it('calculates available battery capacity at given SOC', () => {
      const totalCapacity = 75; // kWh
      const currentSOC = 60; // %
      
      const availableEnergy = (totalCapacity * currentSOC) / 100;
      
      expect(availableEnergy).toBe(45); // kWh
    });

    it('prevents negative SOC range', () => {
      const startSOC = 80;
      const stopSOC = 20;
      
      const isValidRange = stopSOC > startSOC;
      
      expect(isValidRange).toBe(false);
    });
  });

  describe('Date and Time Utilities', () => {
    it('converts minutes to hours and minutes', () => {
      const totalMinutes = 87;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      
      expect(hours).toBe(1);
      expect(minutes).toBe(27);
    });

    it('formats time duration correctly', () => {
      const formatTime = (minutes) => {
        const h = Math.floor(minutes / 60);
        const m = Math.round(minutes % 60);
        
        if (h === 0) return `${m}m`;
        if (m === 0) return `${h}h`;
        return `${h}h ${m}m`;
      };
      
      expect(formatTime(45)).toBe('45m');
      expect(formatTime(60)).toBe('1h');
      expect(formatTime(87)).toBe('1h 27m');
      expect(formatTime(120)).toBe('2h');
    });
  });

  describe('Number Formatting', () => {
    it('formats currency correctly', () => {
      const formatCurrency = (amount, currency = '$') => {
        return `${currency}${amount.toFixed(2)}`;
      };
      
      expect(formatCurrency(10)).toBe('$10.00');
      expect(formatCurrency(1234.56)).toBe('$1234.56');
      expect(formatCurrency(10, '€')).toBe('€10.00');
    });

    it('formats large numbers with commas', () => {
      const formatNumber = (num) => {
        return num.toLocaleString('en-US');
      };
      
      expect(formatNumber(1000)).toBe('1,000');
      expect(formatNumber(1234567)).toBe('1,234,567');
    });

    it('rounds to specified decimal places', () => {
      const roundTo = (num, decimals) => {
        return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
      };
      
      expect(roundTo(3.14159, 2)).toBe(3.14);
      expect(roundTo(10.6789, 1)).toBe(10.7);
    });
  });

  describe('Environmental Offset Calculations', () => {
    it('calculates equivalent homes powered', () => {
      const co2Saved = 5000; // kg
      const CO2_PER_HOME_YEAR = 5.16 * 1000; // metric tons to kg
      
      const homesEquivalent = co2Saved / CO2_PER_HOME_YEAR;
      
      expect(homesEquivalent).toBeCloseTo(0.969, 3);
    });

    it('calculates equivalent forest acres', () => {
      const co2Saved = 5000; // kg
      const CO2_PER_ACRE_YEAR = 0.84 * 1000; // metric tons to kg
      
      const acresEquivalent = co2Saved / CO2_PER_ACRE_YEAR;
      
      expect(acresEquivalent).toBeCloseTo(5.952, 3);
    });
  });

  describe('Input Validation', () => {
    it('validates positive numbers', () => {
      const isPositive = (num) => num > 0;
      
      expect(isPositive(10)).toBe(true);
      expect(isPositive(0)).toBe(false);
      expect(isPositive(-5)).toBe(false);
    });

    it('validates non-negative numbers', () => {
      const isNonNegative = (num) => num >= 0;
      
      expect(isNonNegative(10)).toBe(true);
      expect(isNonNegative(0)).toBe(true);
      expect(isNonNegative(-5)).toBe(false);
    });

    it('clamps values within range', () => {
      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      
      expect(clamp(50, 0, 100)).toBe(50);
      expect(clamp(-10, 0, 100)).toBe(0);
      expect(clamp(150, 0, 100)).toBe(100);
    });
  });
});
