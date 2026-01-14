import React, { useState, useEffect, useMemo, useRef, useContext } from 'react';
import { Fuel, Zap, TrendingDown, Sun, Moon, Info, Battery, Gauge, Wrench, Car, PiggyBank, Plus, Trash2, Calendar, Globe, Leaf, Factory, Cloud, Trees, Flame, ChevronDown, ChevronUp, ExternalLink, Home, Mountain, RefreshCw } from 'lucide-react';
import { DarkModeContext } from './App';

// --- Conversion Constants ---
const GAL_TO_L = 3.78541;
const MI_TO_KM = 1.60934;
const KG_TO_LBS = 2.20462;
const CURRENCIES = ['$', '€', '£', '¥', '₹', 'C$', 'A$'];

// CO2e Constants (Sources cited in UI)
const CO2_PER_GAL_GAS_KG = 8.887; // EPA (Tailpipe)
const UPSTREAM_GAS_CO2_KG = 2.5; // Estimate for refining/transport (Well-to-Pump)
const TOTAL_GAS_CO2E_PER_GAL = CO2_PER_GAL_GAS_KG + UPSTREAM_GAS_CO2_KG;

const BASE_CAR_MFG_CO2_KG = 9000; // Approx carbon to build a glider (UCS/Argonne)
const BATTERY_MFG_CO2_PER_KWH_KG = 100; // kg CO2 per kWh battery capacity (IVL 2019 Estimate)

// NOx Constants (Grams per unit)
const NOX_PER_MILE_GAS_G = 0.18; // Approx Tier 2/3 avg fleet tailpipe + upstream refining
const NOX_PER_KWH_GRID_G = 0.23; // US Avg Grid Emissions (EPA eGRID)

// Offset Equivalencies (EPA Calculator)
const OFFSET_METRICS = {
    homes: { 
        label: 'Homes Powered', 
        factor: 5.16, // metric tons CO2 / home energy use for one year
        icon: Home, 
        desc: "homes' energy use for one year" 
    },
    forest: { 
        label: 'Acres of Forest', 
        factor: 0.84, // metric tons CO2 / acre of US forest sequestering for one year
        icon: Trees, 
        desc: 'acres of U.S. forests sequestering carbon in one year' 
    },
    miles: { 
        label: 'Car Miles Driven', 
        factor: 0.00039, // metric tons / mile
        icon: Car, 
        desc: 'miles driven by an average gasoline-powered passenger vehicle' 
    }
};

// --- CSS for Custom Sliders ---
const SLIDER_STYLES = `
  /* Base Thumb Styles */
  input[type=range]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    margin-top: -4px; /* Center on h-2 (8px) track. 16/2 - 8/2 = 4 */
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    transition: transform 0.1s ease;
  }
  input[type=range]::-moz-range-thumb {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
    transition: transform 0.1s ease;
  }

  /* Hover Effect */
  input[type=range]:hover::-webkit-slider-thumb { transform: scale(1.1); }
  input[type=range]:hover::-moz-range-thumb { transform: scale(1.1); }

  /* Mobile Sizes (Larger Touch Targets) */
  @media (max-width: 768px) {
    input[type=range]::-webkit-slider-thumb {
      height: 26px;
      width: 26px;
      margin-top: -9px; /* 26/2 - 8/2 = 9 */
    }
    input[type=range]::-moz-range-thumb {
      height: 26px;
      width: 26px;
    }
  }

  /* Colors */
  input[type=range][data-color="orange"]::-webkit-slider-thumb { background: #f97316; }
  input[type=range][data-color="orange"]::-moz-range-thumb { background: #f97316; }

  input[type=range][data-color="emerald"]::-webkit-slider-thumb { background: #10b981; }
  input[type=range][data-color="emerald"]::-moz-range-thumb { background: #10b981; }

  input[type=range][data-color="blue"]::-webkit-slider-thumb { background: #3b82f6; }
  input[type=range][data-color="blue"]::-moz-range-thumb { background: #3b82f6; }

  input[type=range][data-color="slate"]::-webkit-slider-thumb { background: #64748b; }
  input[type=range][data-color="slate"]::-moz-range-thumb { background: #64748b; }
`;

// --- Helper Components ---

const UnitToggle = ({ value, options, onChange, label }) => {
  return (
    <button
      onClick={() => {
        const nextIndex = (options.indexOf(value) + 1) % options.length;
        onChange(options[nextIndex]);
      }}
      className="ml-2 px-2 py-1 text-xs font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors uppercase"
      title={`Toggle ${label || 'Unit'}`}
    >
      {value}
    </button>
  );
};

const SliderControl = ({ label, icon: Icon, value, unit, unitOptions, onValueChange, onUnitChange, min, max, step, colorClass, currency, helpText }) => {
  // Extract simple color name for data attribute (e.g. "orange" from "text-orange-500")
  const colorName = colorClass?.replace('text-', '')?.replace('-500', '') || 'blue';

  return (
    <div className="mb-6 last:mb-0">
      <div className="flex justify-between items-end mb-2">
        <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-200">
          {Icon && <Icon size={16} className={`mr-2 ${colorClass}`} />}
          {label}
        </label>
        <div className="flex items-center">
          <input
            type="number"
            value={value}
            onChange={(e) => onValueChange(parseFloat(e.target.value) || 0)}
            className="w-20 text-right bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-blue-500 outline-none text-slate-800 dark:text-slate-100 font-mono"
          />
          {unitOptions ? (
             <UnitToggle value={unit} options={unitOptions} onChange={onUnitChange} label={label} />
          ) : (
             <span className="ml-2 px-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase">
                 {unit === '$' ? currency : unit}
             </span>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onValueChange(parseFloat(e.target.value))}
        data-color={colorName}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700"
      />
      {helpText && <p className="text-xs text-slate-400 mt-1">{helpText}</p>}
    </div>
  );
};

const MaintenanceItem = ({ item, onDelete, onChange, unitLabel, currency }) => {
  return (
    <div className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-sm group">
      <div className="flex-grow grid grid-cols-12 gap-2 items-center">
        {/* Name */}
        <input 
          type="text" 
          value={item.name} 
          onChange={(e) => onChange(item.id, 'name', e.target.value)}
          className="col-span-5 bg-transparent border-b border-transparent focus:border-slate-300 dark:focus:border-slate-500 outline-none text-slate-700 dark:text-slate-200 font-medium placeholder-slate-400"
          placeholder="Item Name"
        />
        
        {/* Cost (Left Aligned) */}
        <div className="col-span-3 flex items-center justify-start">
            <span className="text-slate-400 mr-1">{currency}</span>
            <input 
                type="number" 
                value={item.cost} 
                onChange={(e) => onChange(item.id, 'cost', parseFloat(e.target.value))}
                className="w-full bg-transparent border-b border-slate-200 dark:border-slate-600 outline-none text-slate-600 dark:text-slate-300 text-left"
            />
        </div>
        
        {/* Interval (Right Aligned) */}
        <div className="col-span-4 flex items-center justify-end text-xs text-slate-400">
            <span className="mr-1 hidden sm:inline">every</span>
            <input 
                type="number" 
                value={item.interval} 
                onChange={(e) => onChange(item.id, 'interval', parseFloat(e.target.value))}
                className="w-16 bg-transparent border-b border-slate-200 dark:border-slate-600 outline-none text-slate-600 dark:text-slate-300 text-right mr-1"
            />
            {unitLabel}
        </div>
      </div>
      <button 
        onClick={() => onDelete(item.id)}
        className="text-slate-400 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100"
        title="Delete Item"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
};

// Chart Bar Helper
const ChartSegment = ({ width, color, label, tooltipTitle, tooltipValue, onHover, onLeave }) => {
    if (width <= 0) return null;
    return (
        <div 
            className={`h-full ${color} flex items-center justify-center text-xs text-white font-bold cursor-help transition-all hover:brightness-110 first:rounded-l-xl last:rounded-r-xl border-r border-white/10 last:border-0`} 
            style={{ width: `${width}%` }}
            onMouseEnter={(e) => onHover(e, tooltipTitle, tooltipValue)}
            onMouseLeave={onLeave}
        >
            <span className="truncate px-1 drop-shadow-md pointer-events-none">{label}</span>
        </div>
    );
};

const FuelVsCharge = () => {
  const { darkMode, setDarkMode } = useContext(DarkModeContext);
  const [activeTab, setActiveTab] = useState('operational'); // 'operational' | 'tco' | 'env'
  const [currency, setCurrency] = useState('$');
  const [offsetMetric, setOffsetMetric] = useState('homes'); // 'homes' | 'forest' | 'miles'
  const [showSources, setShowSources] = useState(false);
  const [isUsed, setIsUsed] = useState(false); // Used vs New Vehicle

  // Tooltip State
  const [tooltip, setTooltip] = useState({ show: false, x: 0, y: 0, title: '', value: '' });

  const handleSegmentHover = (e, title, value) => {
    const rect = e.target.getBoundingClientRect();
    // Calculate position: center of the segment horizontally, top of the segment vertically
    setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top,
        title,
        value
    });
  };

  const handleSegmentLeave = () => {
    setTooltip(prev => ({ ...prev, show: false }));
  };

  // --- State Management ---
  const [inputs, setInputs] = useState({
    gasPrice: 3.50,
    gasPriceUnit: '$/gal',
    gasEfficiency: 25,
    gasEfficiencyUnit: 'mpg',
    gasTank: 15,
    gasTankUnit: 'gal',
    gasPurchasePrice: 35000,
    
    elecPrice: 0.15, 
    evRange: 300,
    evRangeUnit: 'mi',
    evBattery: 75,
    evPurchasePrice: 45000,
    
    annualDist: 12000,
    annualDistUnit: 'mi',
    ownershipYears: 8,

    // Environmental Defaults
    gridIntensity: 385, // g CO2/kWh (approx US Avg)
  });

  const [maintenanceItems, setMaintenanceItems] = useState([
    { id: 1, name: 'Oil Change', cost: 80, interval: 5000, type: 'gas' },
    { id: 2, name: 'Tires', cost: 800, interval: 40000, type: 'both' },
    { id: 3, name: 'Air Filter', cost: 30, interval: 15000, type: 'both' },
    { id: 4, name: 'Brake Pads', cost: 400, interval: 40000, type: 'gas' },
    { id: 5, name: 'Brake Pads (Regen)', cost: 400, interval: 80000, type: 'ev' },
    { id: 6, name: 'Major Service', cost: 800, interval: 60000, type: 'gas' },
    { id: 7, name: 'Coolant Flush', cost: 250, interval: 50000, type: 'ev' },
    { id: 8, name: 'Wipers/Fluids', cost: 50, interval: 10000, type: 'both' },
  ]);

  // --- Handlers ---

  const updateInput = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const updateMaintenanceItem = (id, field, value) => {
    setMaintenanceItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const deleteMaintenanceItem = (id) => {
    setMaintenanceItems(prev => prev.filter(item => item.id !== id));
  };

  const addMaintenanceItem = (type) => {
    const newItem = {
        id: Date.now(),
        name: 'New Item',
        cost: 100,
        interval: 10000,
        type: type
    };
    setMaintenanceItems(prev => [...prev, newItem]);
  };

  // --- Conversion Handlers ---
  const toggleGasPriceUnit = () => {
    const isGal = inputs.gasPriceUnit === '$/gal';
    setInputs(prev => ({
      ...prev,
      gasPrice: parseFloat((isGal ? prev.gasPrice / GAL_TO_L : prev.gasPrice * GAL_TO_L).toFixed(2)),
      gasPriceUnit: isGal ? '$/L' : '$/gal'
    }));
  };

  const toggleGasEffUnit = () => {
    const isMpg = inputs.gasEfficiencyUnit === 'mpg';
    setInputs(prev => ({
      ...prev,
      gasEfficiency: parseFloat((235.215 / prev.gasEfficiency).toFixed(1)),
      gasEfficiencyUnit: isMpg ? 'L/100km' : 'mpg'
    }));
  };

  const toggleGasTankUnit = () => {
    const isGal = inputs.gasTankUnit === 'gal';
    setInputs(prev => ({
      ...prev,
      gasTank: parseFloat((isGal ? prev.gasTank * GAL_TO_L : prev.gasTank / GAL_TO_L).toFixed(1)),
      gasTankUnit: isGal ? 'L' : 'gal'
    }));
  };

  const toggleEvRangeUnit = () => {
    const isMi = inputs.evRangeUnit === 'mi';
    setInputs(prev => ({
      ...prev,
      evRange: parseFloat((isMi ? prev.evRange * MI_TO_KM : prev.evRange / MI_TO_KM).toFixed(0)),
      evRangeUnit: isMi ? 'km' : 'mi'
    }));
  };

  const toggleAnnualDistUnit = () => {
    const isMi = inputs.annualDistUnit === 'mi';
    const factor = isMi ? MI_TO_KM : 1 / MI_TO_KM;
    
    // Update main distance input
    setInputs(prev => ({
      ...prev,
      annualDist: parseFloat((prev.annualDist * factor).toFixed(0)),
      annualDistUnit: isMi ? 'km' : 'mi'
    }));

    // Update maintenance intervals to match new unit system
    setMaintenanceItems(prev => prev.map(item => ({
        ...item,
        interval: parseFloat((item.interval * factor).toFixed(0))
    })));
  };

  // --- Calculations ---
  const results = useMemo(() => {
    // 1. Basic Fuel/Charge Cost Calculations
    let gasPricePerGal = inputs.gasPrice;
    if (inputs.gasPriceUnit === '$/L') gasPricePerGal = inputs.gasPrice * GAL_TO_L;

    let gasMpg = inputs.gasEfficiency;
    if (inputs.gasEfficiencyUnit === 'L/100km') gasMpg = 235.215 / inputs.gasEfficiency;

    const gasCostPerMile = gasPricePerGal / gasMpg;

    let evRangeMiles = inputs.evRange;
    if (inputs.evRangeUnit === 'km') evRangeMiles = inputs.evRange / MI_TO_KM;

    const evEfficiencyMiPerKwh = evRangeMiles / inputs.evBattery;
    const evCostPerMile = inputs.elecPrice / evEfficiencyMiPerKwh;

    // 2. Annual Costs
    let annualMiles = inputs.annualDist;
    if (inputs.annualDistUnit === 'km') annualMiles = inputs.annualDist / MI_TO_KM;

    const annualGasCost = gasCostPerMile * annualMiles;
    const annualEvCost = evCostPerMile * annualMiles;
    
    // 3. Lifetime TCO Calculations
    const lifetimeGasFuel = annualGasCost * inputs.ownershipYears;
    const lifetimeEvFuel = annualEvCost * inputs.ownershipYears;

    // Maintenance Calculation
    const totalDistance = inputs.annualDist * inputs.ownershipYears;

    const calculateMaintCost = (type) => {
        return maintenanceItems
            .filter(item => item.type === type || item.type === 'both')
            .reduce((acc, item) => {
                const occurrences = Math.floor(totalDistance / item.interval);
                return acc + (occurrences * item.cost);
            }, 0);
    };

    const lifetimeGasMaint = calculateMaintCost('gas');
    const lifetimeEvMaint = calculateMaintCost('ev');

    const totalTcoGas = inputs.gasPurchasePrice + lifetimeGasFuel + lifetimeGasMaint;
    const totalTcoEv = inputs.evPurchasePrice + lifetimeEvFuel + lifetimeEvMaint;

    const tcoSavings = Math.abs(totalTcoGas - totalTcoEv);
    const tcoWinner = totalTcoEv < totalTcoGas ? 'EV' : 'Gas';

    // 4. Formatting Helpers
    const showMetric = inputs.annualDistUnit === 'km';
    const distanceUnitLabel = showMetric ? 'km' : 'mi';
    const conversionFactor = showMetric ? MI_TO_KM : 1;
    
    const gasCostPerUnitDist = gasCostPerMile / (showMetric ? MI_TO_KM : 1);
    const evCostPerUnitDist = evCostPerMile / (showMetric ? MI_TO_KM : 1);

    // Tank/Battery Fills
    let tankSizeGal = inputs.gasTank;
    if (inputs.gasTankUnit === 'L') tankSizeGal = inputs.gasTank / GAL_TO_L;
    const gasFillCost = tankSizeGal * gasPricePerGal;
    const evFillCost = inputs.evBattery * inputs.elecPrice;
    const gasRangeMiles = tankSizeGal * gasMpg;

    // 5. Environmental Calculations (Lifetime)
    // Gas Emissions: (Total Miles / MPG) * CO2_PER_GAL
    const totalLifetimeMiles = annualMiles * inputs.ownershipYears;
    const totalGasGallons = totalLifetimeMiles / gasMpg;
    const gasTailpipeCO2Kg = totalGasGallons * TOTAL_GAS_CO2E_PER_GAL;
    
    // Manufacturing Impact: If purchasing used, we assume the embodied carbon is "sunk" / 0
    const gasMfgCO2Kg = isUsed ? 0 : BASE_CAR_MFG_CO2_KG;
    const totalGasCO2Kg = gasTailpipeCO2Kg + gasMfgCO2Kg;

    // EV Emissions:
    // Manufacturing: Base + Battery Penalty. If used, set to 0.
    const evMfgCO2Kg = isUsed ? 0 : BASE_CAR_MFG_CO2_KG + (inputs.evBattery * BATTERY_MFG_CO2_PER_KWH_KG);
    
    // Grid Ops: (Total Miles / (mi/kWh)) * GridIntensity(g/kWh) / 1000
    const totalEvKwhNeeded = totalLifetimeMiles / evEfficiencyMiPerKwh;
    const evGridCO2Kg = (totalEvKwhNeeded * inputs.gridIntensity) / 1000;
    const totalEvCO2Kg = evMfgCO2Kg + evGridCO2Kg;

    // NOx Emissions (Lifetime)
    // Gas: Miles * Factor
    const gasNOxKg = (totalLifetimeMiles * NOX_PER_MILE_GAS_G) / 1000;
    // EV: kWh * Factor (Scaled slightly by grid intensity ratio compared to avg)
    // Assuming cleaner grid = less NOx roughly proportionally
    const noxGridScaler = inputs.gridIntensity / 385;
    const evNOxKg = (totalEvKwhNeeded * (NOX_PER_KWH_GRID_G * noxGridScaler)) / 1000;


    const envSavingsKg = totalGasCO2Kg - totalEvCO2Kg;
    const envWinner = totalEvCO2Kg < totalGasCO2Kg ? 'EV' : 'Gas';
    const envSavingsTons = envSavingsKg / 1000;
    
    // Impact Equivalents
    const selectedMetric = OFFSET_METRICS[offsetMetric];
    const offsetCount = Math.abs(envSavingsTons / selectedMetric.factor); // Using Tons now as most factors are in Tons

    return {
      gasCostPerUnitDist,
      evCostPerUnitDist,
      annualGasCost,
      annualEvCost,
      savings: Math.abs(annualGasCost - annualEvCost),
      winner: annualEvCost < annualGasCost ? 'EV' : 'Gas',
      distanceUnitLabel,
      
      // TCO specific
      lifetimeGasFuel,
      lifetimeEvFuel,
      lifetimeGasMaint,
      lifetimeEvMaint,
      totalTcoGas,
      totalTcoEv,
      tcoSavings,
      tcoWinner,
      
      gasFillCost,
      evFillCost,
      gasRange: gasRangeMiles * conversionFactor,
      evRange: evRangeMiles * conversionFactor,

      // Environmental
      gasMfgCO2Ton: gasMfgCO2Kg / 1000,
      gasTailpipeCO2Ton: gasTailpipeCO2Kg / 1000,
      totalGasCO2Ton: totalGasCO2Kg / 1000,
      gasNOxKg,
      
      evMfgCO2Ton: evMfgCO2Kg / 1000,
      evGridCO2Ton: evGridCO2Kg / 1000,
      totalEvCO2Ton: totalEvCO2Kg / 1000,
      evNOxKg,
      
      envSavingsTons,
      envWinner,
      offsetCount,
      MetricIcon: selectedMetric.icon,
      metricDesc: selectedMetric.desc,
      metricLabel: selectedMetric.label
    };
  }, [inputs, maintenanceItems, offsetMetric, isUsed]);

  // Chart Widths
  const maxCost = Math.max(results.gasCostPerUnitDist, results.evCostPerUnitDist);
  const gasBarWidth = (results.gasCostPerUnitDist / maxCost) * 100;
  const evBarWidth = (results.evCostPerUnitDist / maxCost) * 100;

  // TCO Chart Widths
  const maxTco = Math.max(results.totalTcoGas, results.totalTcoEv);
  const getTcoBarWidth = (val) => (val / maxTco) * 100;

  // Env Chart Widths
  const maxEnv = Math.max(results.totalGasCO2Ton, results.totalEvCO2Ton);
  const getEnvBarWidth = (val) => (val / maxEnv) * 100;

  return (
    <div className={`${darkMode ? 'dark' : ''} transition-colors duration-300`}>
      <style>{SLIDER_STYLES}</style>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 md:p-8 font-sans text-slate-800 dark:text-slate-100 transition-colors duration-300">
        <div className="max-w-6xl mx-auto space-y-6">
          
          {/* Header */}
          <header className="flex flex-col md:flex-row justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 transition-colors">
            <div className="mb-4 md:mb-0">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                Fuel vs. Charge
              </h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1">Interactive Cost Calculator</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
               
               {/* Currency Dropdown */}
               <div className="relative group">
                 <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-lg px-3 py-2 cursor-pointer">
                    <Globe size={16} className="text-slate-500 dark:text-slate-400 mr-2" />
                    <select 
                        value={currency} 
                        onChange={(e) => setCurrency(e.target.value)}
                        className="bg-transparent appearance-none border-none outline-none font-bold text-slate-700 dark:text-slate-200 cursor-pointer pr-4"
                    >
                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                 </div>
               </div>

               {/* Mode Tabs */}
               <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl overflow-x-auto">
                 <button 
                   onClick={() => setActiveTab('operational')}
                   className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'operational' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                 >
                   Daily Cost
                 </button>
                 <button 
                   onClick={() => setActiveTab('tco')}
                   className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'tco' ? 'bg-white dark:bg-slate-600 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                 >
                   Lifetime TCO
                 </button>
                 <button 
                   onClick={() => setActiveTab('env')}
                   className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap flex items-center ${activeTab === 'env' ? 'bg-white dark:bg-slate-600 shadow-sm text-green-600 dark:text-green-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}
                 >
                   <Leaf size={14} className="mr-1"/> Impact
                 </button>
               </div>

               <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-3 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-yellow-400 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all"
                aria-label="Toggle Dark Mode"
              >
                {darkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* INPUTS - Left Column (Shared) */}
            <div className="lg:col-span-4 space-y-6">
              
              {/* Gas Section */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-orange-100 dark:border-slate-700 relative overflow-hidden">
                <div className="flex items-center space-x-2 mb-6 relative z-10">
                  <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg text-orange-600 dark:text-orange-400">
                    <Fuel size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Gas Vehicle</h2>
                </div>

                <div className="space-y-6 relative z-10">
                  {activeTab === 'tco' && (
                     <SliderControl
                        label="Purchase Price"
                        icon={PiggyBank}
                        value={inputs.gasPurchasePrice}
                        unit={currency}
                        currency={currency}
                        onValueChange={(v) => updateInput('gasPurchasePrice', v)}
                        min={5000} max={150000} step={500}
                        colorClass="text-orange-500"
                    />
                  )}
                  {activeTab !== 'env' && (
                  <SliderControl
                    label="Gas Price"
                    value={inputs.gasPrice}
                    unit={inputs.gasPriceUnit}
                    unitOptions={[`${currency}/gal`, `${currency}/L`]}
                    currency={currency}
                    onValueChange={(v) => updateInput('gasPrice', v)}
                    onUnitChange={toggleGasPriceUnit}
                    min={0.5} max={10} step={0.01}
                    colorClass="text-orange-500"
                  />
                  )}
                  <SliderControl
                    label="Efficiency"
                    icon={Gauge}
                    value={inputs.gasEfficiency}
                    unit={inputs.gasEfficiencyUnit}
                    unitOptions={['mpg', 'L/100km']}
                    currency={currency}
                    onValueChange={(v) => updateInput('gasEfficiency', v)}
                    onUnitChange={toggleGasEffUnit}
                    min={inputs.gasEfficiencyUnit === 'mpg' ? 5 : 3.5} 
                    max={inputs.gasEfficiencyUnit === 'mpg' ? 65 : 50} 
                    step={0.1}
                    colorClass="text-orange-500"
                  />
                  {activeTab === 'operational' && (
                    <SliderControl
                        label="Tank Size"
                        value={inputs.gasTank}
                        unit={inputs.gasTankUnit}
                        unitOptions={['gal', 'L']}
                        currency={currency}
                        onValueChange={(v) => updateInput('gasTank', v)}
                        onUnitChange={toggleGasTankUnit}
                        min={5} max={40} step={0.5}
                        colorClass="text-orange-500"
                    />
                  )}
                </div>
              </div>

              {/* EV Section */}
              <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-emerald-100 dark:border-slate-700 relative overflow-hidden">
                <div className="flex items-center space-x-2 mb-6 relative z-10">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <Zap size={20} />
                  </div>
                  <h2 className="text-xl font-bold text-slate-800 dark:text-white">Electric Vehicle</h2>
                </div>

                <div className="space-y-6 relative z-10">
                  {activeTab === 'tco' && (
                     <SliderControl
                        label="Purchase Price"
                        icon={PiggyBank}
                        value={inputs.evPurchasePrice}
                        unit={currency}
                        currency={currency}
                        onValueChange={(v) => updateInput('evPurchasePrice', v)}
                        min={5000} max={150000} step={500}
                        colorClass="text-emerald-500"
                    />
                  )}
                  {activeTab !== 'env' && (
                  <SliderControl
                    label="Elec. Cost"
                    value={inputs.elecPrice}
                    unit={`${currency}/kWh`}
                    currency={currency}
                    onValueChange={(v) => updateInput('elecPrice', v)}
                    min={0.01} max={1.0} step={0.01}
                    colorClass="text-emerald-500"
                  />
                  )}
                  <SliderControl
                    label="Range"
                    icon={Gauge}
                    value={inputs.evRange}
                    unit={inputs.evRangeUnit}
                    unitOptions={['mi', 'km']}
                    currency={currency}
                    onValueChange={(v) => updateInput('evRange', v)}
                    onUnitChange={toggleEvRangeUnit}
                    min={50} max={600} step={5}
                    colorClass="text-emerald-500"
                  />
                  <SliderControl
                    label="Battery"
                    icon={Battery}
                    value={inputs.evBattery}
                    unit="kWh"
                    currency={currency}
                    onValueChange={(v) => updateInput('evBattery', v)}
                    min={20} max={200} step={1}
                    colorClass="text-emerald-500"
                  />
                </div>
              </div>

               {/* Usage Section */}
               <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4">Driving Habits</h3>
                <SliderControl
                    label="Annual Distance"
                    value={inputs.annualDist}
                    unit={inputs.annualDistUnit}
                    unitOptions={['mi', 'km']}
                    currency={currency}
                    onValueChange={(v) => updateInput('annualDist', v)}
                    onUnitChange={toggleAnnualDistUnit}
                    min={1000} 
                    max={inputs.annualDistUnit === 'mi' ? 35000 : 56000} 
                    step={500}
                    colorClass="text-blue-500"
                  />
                {activeTab !== 'operational' && (
                     <SliderControl
                        label="Ownership"
                        icon={Calendar}
                        value={inputs.ownershipYears}
                        unit="yrs"
                        currency={currency}
                        onValueChange={(v) => updateInput('ownershipYears', v)}
                        min={1} max={20} step={0.1}
                        colorClass="text-blue-500"
                    />
                  )}
                {/* Environmental Specific Inputs */}
                {activeTab === 'env' && (
                    <div className="mt-8 border-t border-slate-100 dark:border-slate-700 pt-6">
                        <h3 className="text-sm font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-4 flex items-center">
                            <Cloud size={14} className="mr-2"/> Power Grid & Lifecycle
                        </h3>
                        
                        {/* Used Vehicle Toggle */}
                        <div className="flex justify-between items-center mb-6">
                            <label className="flex items-center text-sm font-medium text-slate-700 dark:text-slate-200">
                                <RefreshCw size={16} className="mr-2 text-slate-500" />
                                Vehicle Condition
                            </label>
                            <div className="flex bg-slate-200 dark:bg-slate-700 p-1 rounded-lg">
                                <button 
                                    onClick={() => setIsUsed(false)} 
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${!isUsed ? 'bg-white dark:bg-slate-500 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    New
                                </button>
                                <button 
                                    onClick={() => setIsUsed(true)} 
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${isUsed ? 'bg-white dark:bg-slate-500 shadow-sm text-blue-600 dark:text-white' : 'text-slate-500 dark:text-slate-400'}`}
                                >
                                    Used
                                </button>
                            </div>
                        </div>
                        {isUsed && (
                            <p className="text-xs text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded mb-6">
                                Purchasing used zeroes out the manufacturing emissions impact.
                            </p>
                        )}

                        <SliderControl
                            label="Grid Intensity"
                            value={inputs.gridIntensity}
                            unit="g/kWh"
                            onValueChange={(v) => updateInput('gridIntensity', v)}
                            min={0} max={1000} step={10}
                            colorClass="text-slate-500"
                            helpText="CO2e emitted per kWh generated. Coal ~1000, Solar ~0, US Avg ~385."
                        />
                    </div>
                )}
               </div>

            </div>

            {/* RESULTS - Right Column */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* === OPERATIONAL MODE === */}
              {activeTab === 'operational' && (
              <>
              {/* Main Visualizer */}
              <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 transition-all">
                <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center">
                        <TrendingDown className="mr-2 text-blue-600" size={24} />
                        Cost Breakdown
                    </h3>
                    <div className="text-right">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Estimated Savings</div>
                        <div className="text-3xl font-black text-slate-800 dark:text-white">
                            {currency}{results.savings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            <span className="text-sm font-medium text-slate-400 ml-1">/yr</span>
                        </div>
                    </div>
                </div>

                {/* Bars */}
                <div className="space-y-8">
                    {/* Gas Bar */}
                    <div className="relative">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center">
                                <Fuel size={16} className="mr-1"/> Gas
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-lg">{currency}{results.gasCostPerUnitDist.toFixed(3)}</span>/{results.distanceUnitLabel}
                            </span>
                        </div>
                        <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden relative">
                            <div 
                                className="h-full bg-orange-400 dark:bg-orange-500 transition-all duration-500 flex items-center justify-end pr-3"
                                style={{ width: `${gasBarWidth}%` }}
                            >
                                <span className="text-white font-bold text-sm drop-shadow-md">
                                    {currency}{(results.annualGasCost/12).toFixed(0)}/mo
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* EV Bar */}
                    <div className="relative">
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                                <Zap size={16} className="mr-1"/> Electric
                            </span>
                            <span className="text-slate-600 dark:text-slate-300">
                                <span className="font-bold text-lg">{currency}{results.evCostPerUnitDist.toFixed(3)}</span>/{results.distanceUnitLabel}
                            </span>
                        </div>
                        <div className="h-12 bg-slate-100 dark:bg-slate-700 rounded-xl overflow-hidden relative">
                            <div 
                                className="h-full bg-emerald-400 dark:bg-emerald-500 transition-all duration-500 flex items-center justify-end pr-3"
                                style={{ width: `${evBarWidth}%` }}
                            >
                                <span className="text-white font-bold text-sm drop-shadow-md">
                                    {currency}{(results.annualEvCost/12).toFixed(0)}/mo
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Winner Badge */}
                <div className={`mt-8 p-4 rounded-xl flex items-center ${results.winner === 'EV' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300' : 'bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300'}`}>
                    {results.winner === 'EV' ? <Zap size={24} className="mr-3" /> : <Fuel size={24} className="mr-3" />}
                    <div>
                        <span className="font-bold">{results.winner === 'EV' ? 'Electric' : 'Gas'} is cheaper. </span>
                        You save <span className="font-black">{currency}{(results.savings / 12).toFixed(2)}</span> per month by choosing {results.winner === 'EV' ? 'Electric' : 'Gas'}.
                    </div>
                </div>
              </div>
               
               {/* Secondary Stats */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* Fill Up Cost */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center">
                        <Battery size={14} className="mr-1"/> Cost to Fill Up (0-100%)
                    </h4>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 dark:text-slate-300 text-sm">Gas Tank ({inputs.gasTank} {inputs.gasTankUnit})</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">{currency}{results.gasFillCost.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600 dark:text-slate-300 text-sm">EV Battery ({inputs.evBattery} kWh)</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{currency}{results.evFillCost.toFixed(2)}</span>
                        </div>
                    </div>
                 </div>

                 {/* Efficiency Context */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 flex items-center">
                        <Info size={14} className="mr-1"/> Range Check
                    </h4>
                    <div className="space-y-3">
                         <div className="flex justify-between items-center">
                            <span className="text-slate-600 dark:text-slate-300 text-sm">Gas Range</span>
                            <span className="font-mono font-bold text-slate-800 dark:text-white">{results.gasRange.toFixed(0)} {results.distanceUnitLabel}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-slate-600 dark:text-slate-300 text-sm">EV Range</span>
                            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{results.evRange.toFixed(0)} {results.distanceUnitLabel}</span>
                        </div>
                    </div>
                 </div>
              </div>
              </>
              )}

              {/* === TCO MODE === */}
              {activeTab === 'tco' && (
              <>
                 {/* TCO Summary */}
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 transition-all">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center">
                                <Car className="mr-2 text-blue-600" size={24} />
                                Lifetime Total Cost
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">
                                {inputs.ownershipYears} Year Ownership • {inputs.annualDist.toLocaleString()} {inputs.distanceUnitLabel}/yr
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Lifetime Savings</div>
                            <div className="text-3xl font-black text-slate-800 dark:text-white">
                                {currency}{results.tcoSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>
                        </div>
                    </div>

                    {/* Stacked Bars */}
                    <div className="space-y-8">
                        {/* Gas Stack */}
                        <div className="relative">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center">
                                    <Fuel size={16} className="mr-1"/> Gas Total
                                </span>
                                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">
                                    {currency}{results.totalTcoGas.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl relative flex">
                                {/* Purchase */}
                                <ChartSegment
                                    width={getTcoBarWidth(inputs.gasPurchasePrice)}
                                    color="bg-slate-400"
                                    label="Car"
                                    tooltipTitle="Purchase Price"
                                    tooltipValue={`${currency}${inputs.gasPurchasePrice.toLocaleString()}`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                                {/* Fuel */}
                                <ChartSegment
                                    width={getTcoBarWidth(results.lifetimeGasFuel)}
                                    color="bg-orange-400"
                                    label="Fuel"
                                    tooltipTitle="Fuel Cost"
                                    tooltipValue={`${currency}${results.lifetimeGasFuel.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                                {/* Maint */}
                                <ChartSegment
                                    width={getTcoBarWidth(results.lifetimeGasMaint)}
                                    color="bg-red-400"
                                    label="Maint."
                                    tooltipTitle="Maintenance"
                                    tooltipValue={`${currency}${results.lifetimeGasMaint.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                            </div>
                        </div>

                        {/* EV Stack */}
                        <div className="relative">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                                    <Zap size={16} className="mr-1"/> EV Total
                                </span>
                                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">
                                    {currency}{results.totalTcoEv.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </span>
                            </div>
                            <div className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl relative flex">
                                {/* Purchase */}
                                <ChartSegment
                                    width={getTcoBarWidth(inputs.evPurchasePrice)}
                                    color="bg-slate-400"
                                    label="Car"
                                    tooltipTitle="Purchase Price"
                                    tooltipValue={`${currency}${inputs.evPurchasePrice.toLocaleString()}`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                                {/* Fuel */}
                                <ChartSegment
                                    width={getTcoBarWidth(results.lifetimeEvFuel)}
                                    color="bg-emerald-400"
                                    label="Fuel"
                                    tooltipTitle="Electricity Cost"
                                    tooltipValue={`${currency}${results.lifetimeEvFuel.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                                {/* Maint */}
                                <ChartSegment
                                    width={getTcoBarWidth(results.lifetimeEvMaint)}
                                    color="bg-red-400"
                                    label="Maint."
                                    tooltipTitle="Maintenance"
                                    tooltipValue={`${currency}${results.lifetimeEvMaint.toLocaleString(undefined, {maximumFractionDigits: 0})}`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex justify-center space-x-6 mt-6 text-xs text-slate-500 font-medium">
                        <div className="flex items-center"><div className="w-3 h-3 bg-slate-400 rounded-full mr-2"></div>Purchase Price</div>
                        <div className="flex items-center"><div className="w-3 h-3 bg-gradient-to-r from-orange-400 to-emerald-400 rounded-full mr-2"></div>Fuel/Energy</div>
                        <div className="flex items-center"><div className="w-3 h-3 bg-red-400 rounded-full mr-2"></div>Maintenance</div>
                    </div>
                 </div>

                 {/* Maintenance Editor */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                         <h4 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center">
                            <Wrench size={20} className="mr-2 text-slate-400"/> Maintenance Items
                         </h4>
                         <div className="flex items-center mt-2 sm:mt-0">
                           <span className="text-xs text-slate-400 mr-2 uppercase font-bold">Intervals:</span>
                           <UnitToggle 
                              value={inputs.annualDistUnit} 
                              options={['mi', 'km']} 
                              onChange={toggleAnnualDistUnit}
                              label="Interval Unit"
                           />
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Gas List */}
                        <div>
                             <div className="flex justify-between items-center mb-3">
                                <h5 className="text-xs font-bold text-orange-500 uppercase tracking-wider">Gas Maintenance</h5>
                                <button onClick={() => addMaintenanceItem('gas')} className="flex items-center text-xs font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded hover:bg-orange-200 transition-colors">
                                    <Plus size={12} className="mr-1"/> Add Item
                                </button>
                            </div>
                            <div className="space-y-2">
                                {maintenanceItems.filter(i => i.type === 'gas' || i.type === 'both').map(item => (
                                    <MaintenanceItem 
                                        key={item.id} 
                                        item={item} 
                                        onDelete={deleteMaintenanceItem} 
                                        onChange={updateMaintenanceItem}
                                        unitLabel={results.distanceUnitLabel}
                                        currency={currency}
                                    />
                                ))}
                            </div>
                            <div className="mt-4 text-right text-sm text-slate-500">
                                Lifetime Total: <span className="font-bold text-slate-700 dark:text-slate-200">{currency}{results.lifetimeGasMaint.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>

                        {/* EV List */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h5 className="text-xs font-bold text-emerald-500 uppercase tracking-wider">EV Maintenance</h5>
                                <button onClick={() => addMaintenanceItem('ev')} className="flex items-center text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-1 rounded hover:bg-emerald-200 transition-colors">
                                    <Plus size={12} className="mr-1"/> Add Item
                                </button>
                            </div>
                            <div className="space-y-2">
                                {maintenanceItems.filter(i => i.type === 'ev' || i.type === 'both').map(item => (
                                    <MaintenanceItem 
                                        key={item.id} 
                                        item={item} 
                                        onDelete={deleteMaintenanceItem} 
                                        onChange={updateMaintenanceItem}
                                        unitLabel={results.distanceUnitLabel}
                                        currency={currency}
                                    />
                                ))}
                            </div>
                            <div className="mt-4 text-right text-sm text-slate-500">
                                Lifetime Total: <span className="font-bold text-slate-700 dark:text-slate-200">{currency}{results.lifetimeEvMaint.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                            </div>
                        </div>
                    </div>
                 </div>
              </>
              )}
              
              {/* === ENVIRONMENTAL MODE === */}
              {activeTab === 'env' && (
              <>
                 <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 transition-all">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-200 flex items-center">
                                <Leaf className="mr-2 text-green-600" size={24} />
                                Environmental Impact
                            </h3>
                            <p className="text-xs text-slate-400 mt-1 uppercase tracking-wider">
                                Lifetime CO<sub>2</sub>e Emissions (Metric Tons)
                            </p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">Carbon Savings</div>
                            <div className="text-3xl font-black text-slate-800 dark:text-white flex items-end justify-end">
                                {results.envSavingsTons.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                                <span className="text-sm font-medium text-slate-400 ml-1 mb-1">tons</span>
                            </div>
                        </div>
                    </div>

                    {/* Stacked Bars - Environmental */}
                    <div className="space-y-8">
                        {/* Gas Stack */}
                        <div className="relative">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-bold text-orange-600 dark:text-orange-400 flex items-center">
                                    <Fuel size={16} className="mr-1"/> Gas
                                </span>
                                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">
                                    {results.totalGasCO2Ton.toFixed(1)} <span className="text-sm text-slate-400">t</span>
                                </span>
                            </div>
                            <div className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl relative flex">
                                {/* Mfg */}
                                <ChartSegment
                                    width={getEnvBarWidth(results.gasMfgCO2Ton)}
                                    color="bg-slate-400"
                                    label={results.gasMfgCO2Ton > 0 ? "Mfg" : ""}
                                    tooltipTitle="Manufacturing"
                                    tooltipValue={`${results.gasMfgCO2Ton.toFixed(1)} tons`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                                {/* Tailpipe */}
                                <ChartSegment
                                    width={getEnvBarWidth(results.gasTailpipeCO2Ton)}
                                    color="bg-slate-600"
                                    label="Fuel"
                                    tooltipTitle="Tailpipe + Upstream"
                                    tooltipValue={`${results.gasTailpipeCO2Ton.toFixed(1)} tons`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                            </div>
                        </div>

                        {/* EV Stack */}
                        <div className="relative">
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center">
                                    <Zap size={16} className="mr-1"/> Electric
                                </span>
                                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">
                                    {results.totalEvCO2Ton.toFixed(1)} <span className="text-sm text-slate-400">t</span>
                                </span>
                            </div>
                            <div className="h-14 bg-slate-100 dark:bg-slate-700 rounded-xl relative flex">
                                {/* Mfg */}
                                <ChartSegment
                                    width={getEnvBarWidth(results.evMfgCO2Ton)}
                                    color="bg-slate-400"
                                    label={results.evMfgCO2Ton > 0 ? "Mfg" : ""}
                                    tooltipTitle="Manufacturing"
                                    tooltipValue={`${results.evMfgCO2Ton.toFixed(1)} tons`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                                {/* Grid */}
                                <ChartSegment
                                    width={getEnvBarWidth(results.evGridCO2Ton)}
                                    color="bg-green-500"
                                    label="Grid"
                                    tooltipTitle="Grid Power"
                                    tooltipValue={`${results.evGridCO2Ton.toFixed(1)} tons`}
                                    onHover={handleSegmentHover}
                                    onLeave={handleSegmentLeave}
                                />
                            </div>
                        </div>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex justify-center space-x-6 mt-6 text-xs text-slate-500 font-medium">
                        <div className="flex items-center"><div className="w-3 h-3 bg-slate-400 rounded-full mr-2"></div>Manufacturing</div>
                        <div className="flex items-center"><div className="w-3 h-3 bg-slate-600 rounded-full mr-2"></div>Fuel Cycle (CO<sub>2</sub>e)</div>
                        <div className="flex items-center"><div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>Grid (CO<sub>2</sub>e)</div>
                    </div>
                 </div>

                 {/* NOx Metrics Card */}
                 <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                     <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center">
                         <Cloud size={18} className="mr-2 text-blue-400"/> Air Quality Impact: Nitrogen Oxides (NOx)
                     </h4>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-orange-50 dark:bg-orange-900/10 rounded-xl border border-orange-100 dark:border-orange-800/30">
                            <div className="text-xs text-orange-600 dark:text-orange-400 font-bold uppercase mb-1">Gas Vehicle</div>
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-200">
                                {results.gasNOxKg.toFixed(1)} <span className="text-sm font-medium text-slate-400">kg</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">Lifetime Emissions</div>
                        </div>
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/30">
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 font-bold uppercase mb-1">Electric Vehicle</div>
                            <div className="text-2xl font-black text-slate-800 dark:text-slate-200">
                                {results.evNOxKg.toFixed(1)} <span className="text-sm font-medium text-slate-400">kg</span>
                            </div>
                            <div className="text-xs text-slate-400 mt-1">Lifetime Emissions</div>
                        </div>
                     </div>
                     <p className="text-xs text-slate-400 mt-3">
                         NOx contributes to smog and respiratory issues. EV emissions are based on power plant exhaust (remote), while gas emissions occur at street level (local).
                     </p>
                 </div>

                 {/* Impact Metrics Card */}
                 <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-2xl shadow-sm border border-green-100 dark:border-green-800">
                     <div className="flex items-start justify-between">
                         <div className="pr-4">
                             <h4 className="text-green-800 dark:text-green-300 font-bold text-lg mb-1">Offset Impact</h4>
                             <p className="text-green-700 dark:text-green-400 text-sm mb-4">
                                 To match the {results.envWinner === 'EV' ? 'carbon savings of the EV' : 'cleanliness of the Gas car'}, 
                                 you would need:
                             </p>
                             
                             <div className="flex flex-wrap gap-2">
                                {Object.entries(OFFSET_METRICS).map(([key, m]) => (
                                    <button 
                                        key={key}
                                        onClick={() => setOffsetMetric(key)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center transition-all ${offsetMetric === key ? 'bg-green-600 text-white shadow-md' : 'bg-white dark:bg-slate-700 text-slate-500 hover:text-green-600'}`}
                                    >
                                        <m.icon size={12} className="mr-1.5"/>
                                        {m.label}
                                    </button>
                                ))}
                             </div>
                         </div>
                         <div className="hidden sm:flex bg-white dark:bg-slate-800 p-4 rounded-full shadow-sm text-green-600 dark:text-green-400">
                             <results.MetricIcon size={32} />
                         </div>
                     </div>

                     <div className="mt-6 p-4 bg-white/60 dark:bg-slate-800/60 rounded-xl flex items-center justify-center text-center">
                        <div>
                             <div className="text-3xl font-black text-green-700 dark:text-green-400">
                                {results.offsetCount.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                             </div>
                             <div className="text-sm font-medium text-green-800 dark:text-green-300">
                                {results.metricDesc}
                             </div>
                        </div>
                     </div>
                 </div>
                 
                 {/* Sources & Info Footer */}
                 <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">
                     <button 
                        onClick={() => setShowSources(!showSources)}
                        className="w-full flex justify-between items-center p-6 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                     >
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 flex items-center">
                            <Info size={18} className="mr-2 text-slate-400"/> Data Sources & Methodology
                        </h4>
                        {showSources ? <ChevronUp size={20} className="text-slate-400"/> : <ChevronDown size={20} className="text-slate-400"/>}
                     </button>
                     
                     {showSources && (
                        <div className="px-6 pb-6 pt-0 text-sm text-slate-500 dark:text-slate-400 space-y-4 border-t border-slate-100 dark:border-slate-700 mt-2">
                            <p className="pt-4">
                                This calculator uses lifecycle assessment (LCA) principles to estimate environmental impact.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong>Fuel Emissions:</strong> 8.887 kg CO<sub>2</sub>/gallon (Tailpipe) + ~2.5 kg Upstream (Refining). Source: <span className="italic">EPA/Argonne GREET</span>.
                                </li>
                                <li>
                                    <strong>Manufacturing (Glider):</strong> ~9,000 kg CO<sub>2</sub>e for a standard vehicle body. Source: <span className="italic">UCS</span>.
                                </li>
                                <li>
                                    <strong>Battery Manufacturing:</strong> ~100 kg CO<sub>2</sub>e per kWh. Source: <span className="italic">IVL 2019</span>.
                                </li>
                                <li>
                                    <strong>Grid Intensity:</strong> Defaults to ~385g CO<sub>2</sub>e/kWh (US Average). User adjustable. Source: <span className="italic">EPA eGRID</span>.
                                </li>
                                <li>
                                    <strong>NOx Emissions:</strong> Gas: ~0.18 g/mi (Tier 3 + Upstream). EV: ~0.23 g/kWh (Grid Avg). Source: <span className="italic">EPA MOVES / eGRID</span>.
                                </li>
                                <li>
                                    <strong>Impact Equivalents:</strong> Factors derived from <a href="https://www.epa.gov/energy/greenhouse-gas-equivalencies-calculator" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">EPA Greenhouse Gas Equivalencies Calculator</a>:
                                    <ul className="list-square pl-5 mt-1 space-y-1">
                                        <li>Homes Powered: 5.16 metric tons CO<sub>2</sub>e/year</li>
                                        <li>Forest Sequestration: 0.84 metric tons CO<sub>2</sub>e/acre/year</li>
                                        <li>Vehicle Miles: 0.00039 metric tons CO<sub>2</sub>e/mile</li>
                                    </ul>
                                </li>
                            </ul>
                        </div>
                     )}
                 </div>
              </>
              )}

            </div>
          </div>
          
           {/* Global Tooltip Portal */}
           {tooltip.show && (
             <div 
                className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mt-[-8px]"
                style={{ left: tooltip.x, top: tooltip.y }}
             >
                <div className="bg-slate-900 text-white text-xs rounded-lg py-2 px-3 shadow-xl border border-slate-700 flex flex-col items-center min-w-[120px]">
                  <span className="font-bold mb-0.5 text-slate-300">{tooltip.title}</span>
                  <span className="font-mono text-sm">{tooltip.value}</span>
                  {/* Arrow */}
                  <div className="w-2 h-2 bg-slate-900 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 border-r border-b border-slate-700"></div>
                </div>
             </div>
           )}

        </div>
      </div>
    </div>
  );
};

export default FuelVsCharge;