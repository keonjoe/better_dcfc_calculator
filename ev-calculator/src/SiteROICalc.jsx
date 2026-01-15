import React, { useState, useEffect, useMemo, useContext } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Area, ReferenceLine, PieChart as RechartsPieChart, Pie, Cell
} from 'recharts';
import { 
  Calculator, DollarSign, Zap, Activity, Info, TrendingUp, Truck, Settings, Save, RotateCcw, Menu, ChevronLeft, ChevronRight, BarChart2, PieChart, Sun, Moon, Plus, X, ChevronDown, AlertCircle
} from 'lucide-react';
import { DarkModeContext } from './App';

/**
 * DCFC ROI Calculator
 * * Logic adapted from standard DCFC spreadsheets.
 * Key corrections applied:
 * 1. Demand Charges are calculated dynamically based on utilization (Coincidence Factor function).
 * 2. Depreciation is modeled as Straight Line for simplicity in this view (10yr).
 * 3. Vehicle charging speeds are averaged based on the provided CSV snippets.
 * 4. Added Manual Utilization Mode for explicit year-by-year traffic modeling.
 * 5. Operating Composition chart uses split Positive/Negative Stacking.
 * 6. Network fees now include a revenue share component.
 * 7. Inputs are collapsible and graphs are sub-tabbed for better visibility.
 * 8. Fixed input handling for better UX (backspace support, specific increments).
 */

// --- Constants & Data ---

const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

// Default vehicles for reset
const DEFAULT_VEHICLES = [
  { make: 'Tesla', model: 'model_3', variant: 'model_3', populationShare: 25 },
  { make: 'Volkswagen', model: 'id.4', variant: 'id.4_pro', populationShare: 12 },
  { make: 'Ford', model: 'mustang_mach-e', variant: 'mustang_mach-e_gt', populationShare: 12 },
  { make: 'Rivian', model: 'r1', variant: 'r1t_performance_dual-motor_awd_lp', populationShare: 8 },
  { make: 'Tesla', model: 'model_s', variant: 'model_s_awd', populationShare: 8 },
  { make: 'Chevrolet', model: 'bolt', variant: 'bolt', populationShare: 8 },
  { make: 'Hyundai', model: 'ioniq_5', variant: 'ioniq_5_long_range_awd', populationShare: 17 },
  { make: 'Mercedes', model: 'eqe', variant: 'eqe_350_4matic', populationShare: 10 },
];

const DEFAULT_INPUTS = {
  // Project Info
  siteName: "Proposed DCFC Site A",
  
  // Hardware
  numChargers: 4, // Updated default
  portsPerCharger: 2,
  maxPowerPerPort: 400, // Updated default kW
  costPerCharger: 100000, 
  
  // Installation & Soft Costs
  installCostPerPort: 30000, 
  utilityUpgradeCost: 50000,
  designPermitting: 25000,
  
  // Incentives
  grantsAndRebates: 150000,
  
  // Operational - Fixed
  rentPerMonth: 1000,
  networkFeePerPortPerYear: 500,
  networkRevenueShare: 5.0, // New input: % of revenue
  maintenancePerChargerPerYear: 1500,
  insurancePerYear: 2500,
  
  // Operational - Variable (Utility)
  utilityEnergyCost: 0.12, // $/kWh
  utilityDemandCharge: 0.00, // Updated default $/kW/mo (Set to 0)
  
  // Dynamic Coincidence Logic
  // At what utilization % do we assume 100% coincidence (hitting peak load)?
  peakDemandUtilThreshold: 25, 
  
  // Operational - Revenue
  priceToDriver: 0.45, // $/kWh
  lcfsCreditPrice: 0.00, // $/kWh equivalent if applicable
  
  // Traffic & Logic
  startYear: 2025,
  utilizationModel: 'calculated', // 'calculated' or 'manual'
  initialUtilization: 5, // %
  annualGrowthRate: 15, // % relative growth
  maxUtilizationCap: 35, // %
  customYearlyUtilization: [5, 7, 10, 15, 20, 25, 30, 32, 35, 35], // Default manual curve
  
  // Charging Logic
  avgStartSoC: 20, // %
  avgEndSoC: 80, // %
  performanceDerating: 0.85, // Efficiency loss/cold weather factor
  
  // Financials
  inflationRate: 2.5, // %
  discountRate: 8.0, // %
  taxRate: 21, // %
  loanAmount: 0, // Calculated or manual? Let's assume % of Capex
  loanInterestRate: 7.0, // %
  loanTerm: 10, // Years
  equityPercent: 30, // % (Remaining 70% is debt)
};

// --- Helper Components ---

const SectionHeader = ({ icon: Icon, title }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200 dark:border-slate-700">
    <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
    <h3 className="font-semibold text-slate-800 dark:text-slate-100">{title}</h3>
  </div>
);

const InputField = ({ label, value, onChange, type = "number", prefix = "", suffix = "", step="any", tooltip, className = "" }) => (
  <div className={`mb-3 ${className}`}>
    <div className="flex justify-between items-center mb-1">
      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wide truncate pr-2" title={label}>{label}</label>
      {tooltip && (
        <div className="group relative">
          <Info className="w-3 h-3 text-slate-400 dark:text-slate-500 cursor-help" />
          <div className="absolute right-0 bottom-full mb-2 w-48 p-2 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
            {tooltip}
          </div>
        </div>
      )}
    </div>
    <div className="relative">
      {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm">{prefix}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => {
          // Allow empty string to support backspacing to empty
          if (e.target.value === '') {
            onChange('');
          } else {
            // Parse for state but allow strings for input handling if needed in future
            const val = type === 'number' ? parseFloat(e.target.value) : e.target.value;
            onChange(val);
          }
        }}
        step={step}
        className={`w-full bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-sm rounded-md py-2 px-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all ${prefix ? 'pl-7' : ''} ${suffix ? 'pr-8' : ''}`}
      />
      {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-sm">{suffix}</span>}
    </div>
  </div>
);

const MetricCard = ({ icon: Icon, label, value, subtext, iconColor = 'text-blue-600', trend }) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
    <div className="flex justify-between items-start mb-2">
      <Icon className={`w-5 h-5 ${iconColor}`} />
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</div>
    {subtext && <div className={`text-xs mt-1 ${trend === 'positive' ? 'text-green-600 dark:text-green-400' : trend === 'negative' ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>{subtext}</div>}
  </div>
);

// --- Main Application ---

export default function DCFCCalculator() {
  const { darkMode } = useContext(DarkModeContext);
  const [inputs, setInputs] = useState(() => {
    const saved = localStorage.getItem('siteROIInputs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved Site ROI inputs:', e);
      }
    }
    return DEFAULT_INPUTS;
  });
  
  // Database State
  const [db, setDb] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [makes, setMakes] = useState([]);
  
  // Vehicle Mix State
  const [vehicles, setVehicles] = useState(() => {
    const saved = localStorage.getItem('siteROIVehicles');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // If saved data is not empty, use it
        if (parsed && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved Site ROI vehicles:', e);
      }
    }
    // Return empty - we'll load defaults via useEffect when database is ready
    return [];
  });

  // Track if we should load defaults
  const [shouldLoadDefaults, setShouldLoadDefaults] = useState(() => {
    const saved = localStorage.getItem('siteROIVehicles');
    const hasInitialized = sessionStorage.getItem('siteROIInitialized');
    
    // Load defaults if: no saved data OR saved data is empty, AND not yet initialized this session
    if (!hasInitialized) {
      if (!saved) return true;
      try {
        const parsed = JSON.parse(saved);
        return !parsed || parsed.length === 0;
      } catch {
        return true;
      }
    }
    return false;
  });
  
  // Vehicle Selection State (for adding new vehicles)
  const [newVehicle, setNewVehicle] = useState({
    make: '',
    model: '',
    variant: '',
    models: [],
    variants: [],
    populationShare: 0
  });
  
  const [showVehicleMixChart, setShowVehicleMixChart] = useState(false);
  const [excludeChineseMakes, setExcludeChineseMakes] = useState(true);
  
  // UI State
  const [activeTab, setActiveTab] = useState('site');
  const [activeGraphTab, setActiveGraphTab] = useState('financials'); // 'financials' | 'ops' | 'vehicles'
  const [financialSubTab, setFinancialSubTab] = useState('cashflow'); // 'cashflow' | 'composition'
  const [opsSubTab, setOpsSubTab] = useState('utilization'); // 'utilization' | 'throughput'

  const [results, setResults] = useState(null);

  // --- Database Initialization ---
  useEffect(() => {
    const loadDatabase = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/ev_data.db');
        if (!response.ok) throw new Error(`Database file not found (${response.status}).`);
        const arrayBuffer = await response.arrayBuffer();
        const uInt8Array = new Uint8Array(arrayBuffer);
        const SQL = await window.initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
        const newDb = new SQL.Database(uInt8Array);
        setDb(newDb);
        
        const res = newDb.exec("SELECT DISTINCT make FROM vehicles ORDER BY make COLLATE NOCASE ASC");
        if (res.length > 0) {
          let makesList = res[0].values.map(v => v[0].trim()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          setMakes(makesList);
        }
        
        setError(null);
      } catch (err) {
        console.error(err);
        setError(err.message || "Failed to load vehicle database.");
      } finally {
        setIsLoading(false);
      }
    };
    loadDatabase();
  }, []);

  // Filter makes based on Chinese exclusion setting
  useEffect(() => {
    if (!db) return;
    
    let query = "SELECT DISTINCT make FROM vehicles";
    if (excludeChineseMakes) {
      query += " WHERE country != 'CN'";
    }
    query += " ORDER BY make COLLATE NOCASE ASC";
    
    const res = db.exec(query);
    if (res.length > 0) {
      const makesList = res[0].values.map(v => v[0].trim()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
      setMakes(makesList);
    }
  }, [db, excludeChineseMakes]);

  // Load default vehicles when database is ready and it's first visit
  useEffect(() => {
    if (db && shouldLoadDefaults) {
      console.log('Loading default vehicle mix...');
      loadDefaultVehicleMix();
      setShouldLoadDefaults(false);
      sessionStorage.setItem('siteROIInitialized', 'true');
    }
  }, [db, shouldLoadDefaults]);

  // Update models when make is selected
  useEffect(() => {
    if (!db || !newVehicle.make) {
      setNewVehicle(prev => ({ ...prev, models: [], model: '', variants: [], variant: '' }));
      return;
    }
    try {
      const res = db.exec(`SELECT DISTINCT model FROM vehicles WHERE make = ? ORDER BY model ASC`, [newVehicle.make]);
      if (res.length > 0) {
        const modelsList = res[0].values.map(v => v[0]);
        setNewVehicle(prev => ({ ...prev, models: modelsList, model: '', variants: [], variant: '' }));
      }
    } catch (err) {
      console.error('Error fetching models:', err);
    }
  }, [db, newVehicle.make]);

  // Update variants when model is selected
  useEffect(() => {
    if (!db || !newVehicle.model) {
      setNewVehicle(prev => ({ ...prev, variants: [], variant: '' }));
      return;
    }
    try {
      const res = db.exec(`SELECT id, variant FROM vehicles WHERE make = ? AND model = ? ORDER BY variant ASC`, [newVehicle.make, newVehicle.model]);
      if (res.length > 0) {
        const variantsList = res[0].values.map(v => ({ id: v[0], name: v[1] }));
        setNewVehicle(prev => ({ ...prev, variants: variantsList, variant: '' }));
      }
    } catch (err) {
      console.error('Error fetching variants:', err);
    }
  }, [db, newVehicle.model]);

  // Calculate vehicle metrics from charging curve
  const calculateVehicleMetrics = (variantId, startSoc, endSoc, derating) => {
    if (!db || !variantId) {
      console.warn('Database or variant ID missing');
      return { battery: 0, avgKw: 0 };
    }
    
    try {
      // Get battery capacity
      const batteryRes = db.exec(`SELECT battery_net_kwh FROM vehicles WHERE id = ?`, [variantId]);
      if (batteryRes.length === 0 || !batteryRes[0].values[0]) {
        console.error(`No battery data found for vehicle ID: ${variantId}`);
        return { battery: 0, avgKw: 0 };
      }
      const battery = batteryRes[0].values[0][0];
      
      // Get charging curve
      const curveRes = db.exec(`SELECT soc_percent, power_kw FROM charging_curve WHERE vehicle_id = ? ORDER BY soc_percent ASC`, [variantId]);
      if (curveRes.length === 0) {
        console.error(`No charging curve found for vehicle ID: ${variantId}`);
        return { battery, avgKw: 0 };
      }
      
      const curveData = curveRes[0].values.map(v => ({ soc: v[0], kw: v[1] }));
      
      // Calculate average power between startSoc and endSoc
      const relevantPoints = curveData.filter(p => p.soc >= startSoc && p.soc <= endSoc);
      if (relevantPoints.length === 0) {
        console.warn(`No curve points found between ${startSoc}% and ${endSoc}% for vehicle ID: ${variantId}`);
        // If no points in range, try to interpolate or use nearest
        const allPoints = curveData.filter(p => p.soc >= 0);
        if (allPoints.length > 0) {
          const avgKw = allPoints.reduce((sum, p) => sum + p.kw, 0) / allPoints.length;
          return { battery, avgKw: avgKw * derating };
        }
        return { battery, avgKw: 0 };
      }
      
      const avgKw = relevantPoints.reduce((sum, p) => sum + p.kw, 0) / relevantPoints.length;
      
      console.log(`Vehicle ${variantId}: battery=${battery}kWh, avgKw=${avgKw.toFixed(1)}kW (${relevantPoints.length} curve points)`);
      
      return { battery, avgKw: avgKw * derating };
    } catch (err) {
      console.error('Error calculating vehicle metrics:', err);
      return { battery: 0, avgKw: 0 };
    }
  };

  // Format label helper
  const formatLabel = (str) => {
    if (!str) return '';
    return str.toString()
      .replace(/_/g, ' ')
      .split(' ')
      .map(word => {
        // Capitalize entire word if it's less than 3 characters
        if (word.length < 4) return word.toUpperCase();
        // Otherwise just capitalize first letter
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(' ');
  };

  // Vehicle Management Functions
  const addVehicle = () => {
    if (!newVehicle.variant || newVehicle.populationShare <= 0) return;
    
    try {
      const res = db.exec(`SELECT make, model, variant FROM vehicles WHERE id = ?`, [newVehicle.variant]);
      if (res.length === 0) return;
      
      const [make, model, variant] = res[0].values[0];
      const metrics = calculateVehicleMetrics(newVehicle.variant, inputs.avgStartSoC, inputs.avgEndSoC, inputs.performanceDerating);
      
      const newVehicleData = {
        id: newVehicle.variant,
        name: `${formatLabel(make)} ${formatLabel(model)} ${formatLabel(variant)}`,
        battery: metrics.battery,
        avgKw: metrics.avgKw,
        populationShare: newVehicle.populationShare,
        variantId: newVehicle.variant
      };
      
      setVehicles(prev => [...prev, newVehicleData]);
      
      // Reset form
      setNewVehicle({
        make: '',
        model: '',
        variant: '',
        models: [],
        variants: [],
        populationShare: 0
      });
    } catch (err) {
      console.error('Error adding vehicle:', err);
    }
  };

  const removeVehicle = (id) => {
    setVehicles(prev => prev.filter(v => v.id !== id));
  };

  const resetToDefaults = async () => {
    if (!db) return;
    
    try {
      const newVehiclesList = [];
      
      for (const defaultVeh of DEFAULT_VEHICLES) {
        // Find the variant ID from database
        const res = db.exec(
          `SELECT id, make, model, variant FROM vehicles WHERE make = ? AND model = ? AND variant = ? COLLATE NOCASE`,
          [defaultVeh.make, defaultVeh.model, defaultVeh.variant]
        );
        
        if (res.length > 0 && res[0].values.length > 0) {
          const [id, make, model, variant] = res[0].values[0];
          const metrics = calculateVehicleMetrics(id, inputs.avgStartSoC, inputs.avgEndSoC, inputs.performanceDerating);
          
          newVehiclesList.push({
            id: id,
            name: `${formatLabel(make)} ${formatLabel(model)} ${formatLabel(variant)}`,
            battery: metrics.battery,
            avgKw: metrics.avgKw,
            populationShare: defaultVeh.populationShare,
            variantId: id
          });
        }
      }
      
      setVehicles(newVehiclesList);
      setInputs(DEFAULT_INPUTS);
    } catch (err) {
      console.error('Error resetting to defaults:', err);
    }
  };

  const handleVehicleChange = (id, field, value) => {
    setVehicles(prev => prev.map(v => {
      if (v.id === id) {
        if (field === 'populationShare') {
          return { ...v, [field]: value };
        }
        return { ...v, [field]: value };
      }
      return v;
    }));
  };

  // Recalculate vehicle metrics when SoC or derating changes
  useEffect(() => {
    if (!db || vehicles.length === 0) return;
    
    const updatedVehicles = vehicles.map(v => {
      if (!v.variantId) return v;
      const metrics = calculateVehicleMetrics(v.variantId, inputs.avgStartSoC, inputs.avgEndSoC, inputs.performanceDerating);
      return { ...v, battery: metrics.battery, avgKw: metrics.avgKw };
    });
    
    setVehicles(updatedVehicles);
  }, [inputs.avgStartSoC, inputs.avgEndSoC, inputs.performanceDerating]);

  // Calculate total vehicle mix percentage
  const totalVehicleMix = useMemo(() => {
    return vehicles.reduce((sum, v) => sum + (v.populationShare || 0), 0);
  }, [vehicles]);

  // Save inputs to localStorage
  useEffect(() => {
    localStorage.setItem('siteROIInputs', JSON.stringify(inputs));
  }, [inputs]);

  // Save vehicles to localStorage
  useEffect(() => {
    localStorage.setItem('siteROIVehicles', JSON.stringify(vehicles));
  }, [vehicles]);

  // Handle Input Changes
  const handleInputChange = (key, value) => {
    setInputs(prev => ({ ...prev, [key]: value }));
  };

  const handleManualUtilChange = (index, value) => {
    const newArr = [...inputs.customYearlyUtilization];
    newArr[index] = value;
    setInputs(prev => ({ ...prev, customYearlyUtilization: newArr }));
  };

  const loadDefaultVehicleMix = () => {
    if (!db) {
      console.error('Database not loaded yet');
      return;
    }

    try {
      const loadedVehicles = [];
      
      for (const defaultVehicle of DEFAULT_VEHICLES) {
        // Query database to get the vehicle ID
        const res = db.exec(
          `SELECT id, make, model, variant FROM vehicles WHERE make = ? AND model = ? AND variant = ?`,
          [defaultVehicle.make, defaultVehicle.model, defaultVehicle.variant]
        );
        
        if (res.length > 0 && res[0].values.length > 0) {
          const [id, make, model, variant] = res[0].values[0];
          const metrics = calculateVehicleMetrics(id, inputs.avgStartSoC, inputs.avgEndSoC, inputs.performanceDerating);
          
          if (metrics.battery > 0 && metrics.avgKw > 0) {
            loadedVehicles.push({
              id: id,
              name: `${formatLabel(make)} ${formatLabel(model)} ${formatLabel(variant)}`,
              battery: metrics.battery,
              avgKw: metrics.avgKw,
              populationShare: defaultVehicle.populationShare,
              variantId: id
            });
          } else {
            console.warn(`Could not load metrics for ${defaultVehicle.make} ${defaultVehicle.model} ${defaultVehicle.variant}`);
          }
        } else {
          console.warn(`Vehicle not found in database: ${defaultVehicle.make} ${defaultVehicle.model} ${defaultVehicle.variant}`);
        }
      }
      
      if (loadedVehicles.length > 0) {
        setVehicles(loadedVehicles);
      } else {
        console.error('Failed to load any default vehicles');
      }
    } catch (err) {
      console.error('Error loading default vehicle mix:', err);
    }
  };

  // --- Calculation Engine ---
  useEffect(() => {
    calculateFinancials();
  }, [inputs, vehicles]);

  const calculateFinancials = () => {
    // Sanitize inputs (handle empty strings from backspacing)
    const safeInputs = {};
    Object.keys(inputs).forEach(key => {
      const val = inputs[key];
      // Keep strings as strings, convert numbers/empty numbers to safe floats
      if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parseFloat(val)))) {
         safeInputs[key] = val === '' ? 0 : parseFloat(val);
      } else {
         safeInputs[key] = val;
      }
    });

    const {
      numChargers, portsPerCharger, costPerCharger, installCostPerPort, utilityUpgradeCost, designPermitting,
      grantsAndRebates, equityPercent, loanInterestRate, loanTerm,
      startYear, initialUtilization, annualGrowthRate, maxUtilizationCap, utilizationModel,
      avgStartSoC, avgEndSoC, performanceDerating,
      priceToDriver, utilityEnergyCost, utilityDemandCharge, peakDemandUtilThreshold,
      rentPerMonth, networkFeePerPortPerYear, networkRevenueShare, maintenancePerChargerPerYear, insurancePerYear,
      inflationRate, taxRate, discountRate
    } = safeInputs;

    const totalPorts = numChargers * portsPerCharger;
    
    // 1. CAPEX
    const hardwareCost = numChargers * costPerCharger;
    const installCost = totalPorts * installCostPerPort;
    const totalCapex = hardwareCost + installCost + utilityUpgradeCost + designPermitting;
    const netCapex = totalCapex - grantsAndRebates;

    // Debt vs Equity
    const loanAmount = netCapex * (1 - (equityPercent / 100));
    const equityInvestment = netCapex * (equityPercent / 100);

    // Loan Payment (PMT)
    const monthlyRate = (loanInterestRate / 100) / 12;
    const numPayments = loanTerm * 12;
    // Standard PMT formula
    const monthlyLoanPayment = loanAmount > 0 
      ? (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numPayments))
      : 0;
    const annualDebtService = monthlyLoanPayment * 12;

    // 2. Vehicle Session Metrics (Weighted Average)
    let totalPop = 0;
    let weightedKWh = 0;
    let weightedDuration = 0;

    // Validate vehicles array exists and has data
    if (!vehicles || vehicles.length === 0) {
      console.warn('No vehicles configured. Using default values.');
      // Use default fallback values if no vehicles
      setResults(null);
      return;
    }

    vehicles.forEach(v => {
      totalPop += v.populationShare || 0;
    });

    // Check if total population is valid
    if (totalPop === 0) {
      console.warn('Total vehicle population share is 0. Please add vehicles with population share.');
      setResults(null);
      return;
    }

    vehicles.forEach(v => {
      const share = v.populationShare / totalPop;
      // Energy Delivered = Battery * (EndSoC - StartSoC)
      const energyDelivered = v.battery * ((avgEndSoC - avgStartSoC) / 100);
      // Real Duration = Energy / (AvgKW * Derating)
      const avgPowerReal = v.avgKw * performanceDerating;
      
      // Prevent division by zero
      if (avgPowerReal === 0 || energyDelivered === 0) {
        console.warn(`Invalid vehicle data for ${v.name}: avgKw=${v.avgKw}, battery=${v.battery}`);
        return;
      }
      
      const durationHours = energyDelivered / avgPowerReal;
      
      weightedKWh += energyDelivered * share;
      weightedDuration += durationHours * share;
    });

    // Validate calculated values
    if (!isFinite(weightedKWh) || !isFinite(weightedDuration) || weightedDuration === 0) {
      console.warn('Invalid calculated vehicle metrics. Please check vehicle configuration.');
      setResults(null);
      return;
    }

    const avgSessionKWh = weightedKWh;
    const avgSessionHours = weightedDuration; // 30-45 mins usually

    // 3. Pro Forma Loop (10 Years)
    const yearlyData = [];
    let cumulativeCashFlow = -equityInvestment;
    let currentLoanBalance = loanAmount;

    for (let year = 1; year <= 10; year++) {
      const displayYear = startYear + year - 1;
      
      // -- Utilization Logic --
      let utilization;
      if (utilizationModel === 'manual') {
        // Safe access to array index
        utilization = inputs.customYearlyUtilization[year - 1] || 0;
      } else {
        // Growth modeled as Year-over-Year percentage, capped at max
        utilization = initialUtilization * Math.pow(1 + (annualGrowthRate / 100), year - 1);
        if (utilization > maxUtilizationCap) utilization = maxUtilizationCap;
      }
      
      // Calculate Sessions
      const dailyHoursOccupied = (utilization / 100) * 24 * totalPorts;
      const dailySessions = dailyHoursOccupied / avgSessionHours;
      const annualSessions = dailySessions * 365;
      
      const annualEnergyMWh = (annualSessions * avgSessionKWh) / 1000;
      const annualEnergyKWh = annualSessions * avgSessionKWh;

      // -- Revenue --
      // Apply inflation to price
      const inflator = Math.pow(1 + (inflationRate / 100), year - 1);
      
      const revenueCharging = annualEnergyKWh * (priceToDriver * inflator);
      const revenueLCFS = annualEnergyKWh * (inputs.lcfsCreditPrice * inflator);
      const totalRevenue = revenueCharging + revenueLCFS;

      // -- OpEx --
      // 1. Utility Costs
      const energyCost = annualEnergyKWh * (utilityEnergyCost * inflator);
      
      // Dynamic Coincidence Factor Calculation
      const calculatedCoincidence = Math.min(1.0, 0.1 + (0.9 * (utilization / peakDemandUtilThreshold)));

      // Demand Charge Estimate
      const siteMaxPower = totalPorts * inputs.maxPowerPerPort;
      const estimatedPeakDemand = siteMaxPower * calculatedCoincidence; 
      const demandCost = estimatedPeakDemand * (utilityDemandCharge * inflator) * 12;
      
      const totalUtilityCost = energyCost + demandCost;

      // 2. Fixed Ops
      const rent = rentPerMonth * 12 * inflator;
      // Network Fee: Fixed Component + Revenue Share Component
      const networkFeesFixed = networkFeePerPortPerYear * totalPorts * inflator;
      const networkFeesVariable = totalRevenue * (networkRevenueShare / 100);
      const networkFeesTotal = networkFeesFixed + networkFeesVariable;

      const maintenance = maintenancePerChargerPerYear * numChargers * inflator;
      const insurance = insurancePerYear * inflator;
      
      const totalFixedOpex = rent + networkFeesTotal + maintenance + insurance;
      const totalOpEx = totalUtilityCost + totalFixedOpex;

      // -- EBITDA --
      const ebitda = totalRevenue - totalOpEx;

      // -- Net Income & Cash Flow --
      const depreciation = totalCapex / 10;
      const interestExpense = year <= loanTerm ? (currentLoanBalance * (loanInterestRate/100)) : 0;
      
      const taxableIncome = ebitda - depreciation - interestExpense;
      const taxes = taxableIncome > 0 ? taxableIncome * (taxRate / 100) : 0;
      
      const annualDebtPay = year <= loanTerm ? annualDebtService : 0;
      const freeCashFlow = ebitda - taxes - annualDebtPay;

      // Update Cumulative
      cumulativeCashFlow += freeCashFlow;

      // Discounted Cash Flow for NPV
      const dcf = freeCashFlow / Math.pow(1 + (discountRate / 100), year);

      // Loan Balance Update
      if (year <= loanTerm) {
        const principalPaid = annualDebtPay - interestExpense;
        currentLoanBalance -= principalPaid;
      }

      yearlyData.push({
        year: displayYear,
        utilization: utilization,
        sessions: Math.round(annualSessions),
        energy: Math.round(annualEnergyMWh),
        
        // Positive Revenue
        revenue: Math.round(totalRevenue),
        
        // Negative Costs (Split for Stacking)
        utilityCostNeg: Math.round(-totalUtilityCost),
        fixedOpexNeg: Math.round(-totalFixedOpex),
        taxesNeg: Math.round(-taxes),
        debtNeg: Math.round(-annualDebtPay),

        opex: Math.round(totalOpEx),
        utilityCost: Math.round(totalUtilityCost),
        ebitda: Math.round(ebitda),
        cashFlow: Math.round(freeCashFlow),
        cumulativeCashFlow: Math.round(cumulativeCashFlow),
        dcf: dcf,
        // Helper
        coincidenceFactorUsed: calculatedCoincidence,
        displayLabel: `Yr ${year}`
      });
    }

    // -- Summary Metrics --
    const npv = yearlyData.reduce((acc, curr) => acc + curr.dcf, 0) - equityInvestment;
    const paybackYearObj = yearlyData.find(y => y.cumulativeCashFlow > 0);
    const paybackPeriod = paybackYearObj ? paybackYearObj.year - startYear + 1 : "10+";

    setResults({
      yearlyData,
      totalCapex,
      netCapex,
      equityInvestment,
      npv,
      paybackPeriod
    });
  };

  const formatCurrency = (val) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);
  const formatNumber = (val) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(val);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-2 sm:p-4 md:p-6 transition-colors duration-200 overflow-x-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <BarChart2 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                DCFC Site ROI Calculator
              </h1>
            </div>
            <button 
              onClick={resetToDefaults}
              className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-300"
            >
              <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" /> 
              <span>Reset to Defaults</span>
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="px-3 py-2 text-xs sm:text-sm font-medium bg-blue-600 text-white rounded-lg shadow-sm flex items-center gap-2 whitespace-nowrap">
              <Activity size={14} className="sm:w-4 sm:h-4" />
              {inputs.siteName}
            </div>
          </div>
        </div>

        {/* Main Layout - Two Column on Desktop */}
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
          
          {/* Left Column - Configuration Inputs */}
          <div className="w-full lg:w-80 xl:w-96 flex-shrink-0 space-y-4">
            {/* Configuration Tabs */}
            <div className="flex gap-1 sm:gap-2 bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-x-auto">
              {['site', 'costs', 'ops'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 px-2 sm:px-3 text-xs sm:text-sm font-semibold rounded-md capitalize transition-all whitespace-nowrap ${activeTab === tab ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                >
                  {tab === 'site' && <Settings className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
                  {tab === 'costs' && <DollarSign className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
                  {tab === 'ops' && <TrendingUp className="inline w-3 h-3 sm:w-4 sm:h-4 mr-1" />}
                  {tab}
                </button>
              ))}
            </div>

            {/* Configuration Sections */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-3 sm:p-4 md:p-6">
              <div className="space-y-6">

            {activeTab === 'site' && (
              <>
                <section>
                  <SectionHeader icon={Activity} title="Site Parameters" />
                  <InputField label="Site Name" type="text" value={inputs.siteName} onChange={(v) => handleInputChange('siteName', v)} />
                  <InputField label="Start Year" value={inputs.startYear} onChange={(v) => handleInputChange('startYear', v)} suffix="Yr" step="1" />
                  <div className="grid grid-cols-2 gap-3">
                     <InputField label="Chargers" value={inputs.numChargers} onChange={(v) => handleInputChange('numChargers', v)} step="1" />
                     <InputField label="Ports/Chgr" value={inputs.portsPerCharger} onChange={(v) => handleInputChange('portsPerCharger', v)} step="1" />
                  </div>
                  <InputField label="Max Power/Port" value={inputs.maxPowerPerPort} onChange={(v) => handleInputChange('maxPowerPerPort', v)} suffix="kW" step="10" tooltip="Maximum theoretical output of the hardware per port." />
                </section>

                <section>
                  <SectionHeader icon={Truck} title="Vehicle Logic" />
                  <InputField label="Avg Start SoC" value={inputs.avgStartSoC} onChange={(v) => handleInputChange('avgStartSoC', v)} suffix="%" />
                  <InputField label="Avg End SoC" value={inputs.avgEndSoC} onChange={(v) => handleInputChange('avgEndSoC', v)} suffix="%" />
                  <InputField label="Perf. Derating" value={inputs.performanceDerating} onChange={(v) => handleInputChange('performanceDerating', v)} step="0.05" tooltip="Real world factor (cold weather, curve taper). 1.0 = Ideal."/>
                  
                  {/* Vehicle Mix Section */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Vehicle Mix</label>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${totalVehicleMix === 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {totalVehicleMix.toFixed(0)}%
                        </span>
                        <button
                          onClick={() => setShowVehicleMixChart(!showVehicleMixChart)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="View Mix Chart"
                        >
                          <PieChart size={14} />
                        </button>
                      </div>
                    </div>
                    
                    {totalVehicleMix !== 100 && (
                      <div className="mb-2 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
                        <AlertCircle size={12} className="mt-0.5 shrink-0" />
                        <span>Total must equal 100%</span>
                      </div>
                    )}
                    
                    {/* Existing Vehicles */}
                    <div className="space-y-2 mb-3">
                      {vehicles.map((v, idx) => (
                        <div key={v.id} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/50 p-2 rounded-lg text-xs">
                          <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}></div>
                          <span className="text-slate-700 dark:text-slate-300 truncate flex-1 text-[10px]">{v.name}</span>
                          <input 
                            type="number" 
                            className="w-14 border border-slate-300 dark:border-slate-600 rounded px-1 py-0.5 text-right bg-white dark:bg-slate-800"
                            value={v.populationShare}
                            onChange={(e) => handleVehicleChange(v.id, 'populationShare', parseFloat(e.target.value) || 0)}
                            step="1"
                            min="0"
                            max="100"
                          />
                          <span className="text-slate-400">%</span>
                          <button
                            onClick={() => removeVehicle(v.id)}
                            className="p-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                            title="Remove"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Add Vehicle Form */}
                    {!isLoading && !error && db && (
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">Add Vehicle</label>
                          <label className="flex items-center gap-1.5 text-[9px] text-blue-700 dark:text-blue-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={excludeChineseMakes}
                              onChange={(e) => setExcludeChineseMakes(e.target.checked)}
                              className="w-3 h-3 rounded border-blue-300 dark:border-blue-700 text-blue-600 focus:ring-1 focus:ring-blue-500 dark:bg-slate-800"
                            />
                            Exclude Chinese Makes
                          </label>
                        </div>
                        
                        <div>
                          <select 
                            value={newVehicle.make} 
                            onChange={(e) => setNewVehicle(prev => ({ ...prev, make: e.target.value }))}
                            className="w-full py-1 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                          >
                            <option value="">Select Make...</option>
                            {makes.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
                          </select>
                        </div>
                        
                        {newVehicle.models.length > 0 && (
                          <div>
                            <select 
                              value={newVehicle.model} 
                              onChange={(e) => setNewVehicle(prev => ({ ...prev, model: e.target.value }))}
                              className="w-full py-1 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                            >
                              <option value="">Select Model...</option>
                              {newVehicle.models.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
                            </select>
                          </div>
                        )}
                        
                        {newVehicle.variants.length > 0 && (
                          <div>
                            <select 
                              value={newVehicle.variant} 
                              onChange={(e) => setNewVehicle(prev => ({ ...prev, variant: e.target.value }))}
                              className="w-full py-1 px-2 text-xs bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded"
                            >
                              <option value="">Select Variant...</option>
                              {newVehicle.variants.map(v => <option key={v.id} value={v.id}>{formatLabel(v.name)}</option>)}
                            </select>
                          </div>
                        )}
                        
                        {newVehicle.variant && (
                          <div className="space-y-2">
                            <div>
                              <label className="block text-[10px] text-slate-600 dark:text-slate-400 mb-1">
                                Population Share: <span className="font-medium text-slate-900 dark:text-slate-100">{newVehicle.populationShare}%</span>
                              </label>
                              <input 
                                type="range" 
                                value={newVehicle.populationShare}
                                onChange={(e) => setNewVehicle(prev => ({ ...prev, populationShare: parseFloat(e.target.value) || 0 }))}
                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                min="0"
                                max={100 - totalVehicleMix}
                                step="1"
                              />
                              <div className="flex justify-between text-[9px] text-slate-500 dark:text-slate-500 mt-0.5">
                                <span>0%</span>
                                <span>{100 - totalVehicleMix}%</span>
                              </div>
                            </div>
                            <button
                              onClick={addVehicle}
                              disabled={!newVehicle.variant || newVehicle.populationShare <= 0}
                              className="w-full px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-xs rounded transition-colors flex items-center justify-center gap-1 disabled:cursor-not-allowed"
                            >
                              <Plus size={12} /> Add Vehicle
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {isLoading && (
                      <div className="text-xs text-slate-500 dark:text-slate-400 italic text-center py-2">
                        Loading database...
                      </div>
                    )}
                    
                    {error && (
                      <div className="text-xs text-red-600 dark:text-red-400 text-center py-2">
                        {error}
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}

            {activeTab === 'costs' && (
              <>
                <section>
                  <SectionHeader icon={DollarSign} title="CAPEX (Upfront)" />
                  <InputField label="Hardware $/Unit" value={inputs.costPerCharger} onChange={(v) => handleInputChange('costPerCharger', v)} prefix="$" step="1000" />
                  <InputField label="Install $/Port" value={inputs.installCostPerPort} onChange={(v) => handleInputChange('installCostPerPort', v)} prefix="$" step="1000" />
                  <InputField label="Utility Upgrade" value={inputs.utilityUpgradeCost} onChange={(v) => handleInputChange('utilityUpgradeCost', v)} prefix="$" step="1000" />
                  <InputField label="Soft Costs" value={inputs.designPermitting} onChange={(v) => handleInputChange('designPermitting', v)} prefix="$" tooltip="Design, Engineering, Permitting" step="100" />
                  <InputField label="Grants/Rebates" value={inputs.grantsAndRebates} onChange={(v) => handleInputChange('grantsAndRebates', v)} prefix="$" step="1000" />
                </section>

                <section>
                  <SectionHeader icon={DollarSign} title="Financial Structuring" />
                  <InputField label="Equity Contribution" value={inputs.equityPercent} onChange={(v) => handleInputChange('equityPercent', v)} suffix="%" step="5" />
                  <InputField label="Loan Interest" value={inputs.loanInterestRate} onChange={(v) => handleInputChange('loanInterestRate', v)} suffix="%" step="0.25" />
                  <InputField label="Discount Rate" value={inputs.discountRate} onChange={(v) => handleInputChange('discountRate', v)} suffix="%" tooltip="For NPV Calculation" step="0.25" />
                  <InputField label="Inflation Rate" value={inputs.inflationRate} onChange={(v) => handleInputChange('inflationRate', v)} suffix="%" step="0.1" />
                </section>
              </>
            )}

            {activeTab === 'ops' && (
              <>
                <section>
                  <SectionHeader icon={TrendingUp} title="Traffic & Growth" />
                  
                  <div className="mb-4">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">Utilization Model</label>
                    <div className="flex rounded-md shadow-sm border border-slate-300 dark:border-slate-600 overflow-hidden">
                      <button
                        onClick={() => handleInputChange('utilizationModel', 'calculated')}
                        className={`flex-1 py-1.5 text-xs font-medium transition-colors ${inputs.utilizationModel === 'calculated' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                      >
                        Annual Growth
                      </button>
                      <button 
                         onClick={() => handleInputChange('utilizationModel', 'manual')}
                         className={`flex-1 py-1.5 text-xs font-medium transition-colors ${inputs.utilizationModel === 'manual' ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                      >
                        Manual / Year
                      </button>
                    </div>
                  </div>

                  {inputs.utilizationModel === 'calculated' ? (
                    <>
                      <InputField label="Year 1 Utilization" value={inputs.initialUtilization} onChange={(v) => handleInputChange('initialUtilization', v)} suffix="%" />
                      <InputField label="Annual Growth" value={inputs.annualGrowthRate} onChange={(v) => handleInputChange('annualGrowthRate', v)} suffix="%" />
                      <InputField label="Max Util. Cap" value={inputs.maxUtilizationCap} onChange={(v) => handleInputChange('maxUtilizationCap', v)} suffix="%" />
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {inputs.customYearlyUtilization.map((val, idx) => (
                         <InputField 
                            key={idx}
                            label={`Year ${idx + 1}`} 
                            value={val} 
                            onChange={(v) => handleManualUtilChange(idx, v)} 
                            suffix="%" 
                            className="mb-1"
                         />
                      ))}
                    </div>
                  )}
                </section>

                <section>
                  <SectionHeader icon={Zap} title="Energy & Revenue" />
                  <InputField label="Price to Driver" value={inputs.priceToDriver} onChange={(v) => handleInputChange('priceToDriver', v)} prefix="$" suffix="/kWh" />
                  <InputField label="Utility Energy Cost" value={inputs.utilityEnergyCost} onChange={(v) => handleInputChange('utilityEnergyCost', v)} prefix="$" suffix="/kWh" />
                  <InputField label="Demand Charge" value={inputs.utilityDemandCharge} onChange={(v) => handleInputChange('utilityDemandCharge', v)} prefix="$" suffix="/kW" />
                  <InputField label="Peak Probability Thresh." value={inputs.peakDemandUtilThreshold} onChange={(v) => handleInputChange('peakDemandUtilThreshold', v)} suffix="%" tooltip="Utilization % at which Coincidence Factor reaches 100% (Demand Charge Max)" step="1" />
                </section>

                <section>
                  <SectionHeader icon={Settings} title="Fixed OpEx" />
                  <InputField label="Rent (Monthly)" value={inputs.rentPerMonth} onChange={(v) => handleInputChange('rentPerMonth', v)} prefix="$" step="10" />
                  <InputField label="Network Fee/Port/Yr" value={inputs.networkFeePerPortPerYear} onChange={(v) => handleInputChange('networkFeePerPortPerYear', v)} prefix="$" step="10" />
                  <InputField label="Network Rev. Share" value={inputs.networkRevenueShare} onChange={(v) => handleInputChange('networkRevenueShare', v)} suffix="%" tooltip="Software fee as % of gross revenue" step="1" />
                  <InputField label="Maint/Charger/Yr" value={inputs.maintenancePerChargerPerYear} onChange={(v) => handleInputChange('maintenancePerChargerPerYear', v)} prefix="$" step="100" />
                </section>
              </>
            )}
              </div>
            </div>
          </div>

          {/* Right Column - Results/Graphs */}
          <div className="flex-1 min-w-0">
            {!results && (
            <div className="mt-0 lg:mt-6">
              <div className="flex flex-col items-center justify-center min-h-[300px] sm:min-h-[400px] text-center bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
                <Truck className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 dark:text-slate-600 mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  No Vehicle Mix Configured
                </h3>
                <p className="text-sm sm:text-base text-slate-500 dark:text-slate-400 max-w-md mb-4 px-4">
                  Add at least one vehicle to the Vehicle Mix in the Site Parameters tab to see financial projections and ROI analysis.
                </p>
                <button
                  onClick={loadDefaultVehicleMix}
                  className="mb-4 px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg shadow-md transition-all duration-200 flex items-center gap-2 mx-auto text-sm sm:text-base"
                >
                  <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                  Use Default Vehicle Mix
                </button>
                <div className="flex flex-col gap-2 text-xs sm:text-sm text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Total vehicle mix must equal 100%</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>Each vehicle will use charging curve data from the database</span>
                  </div>
                </div>
              </div>
            </div>
          )}
              
          {results && (
            <div className="space-y-4 sm:space-y-6">
              
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <MetricCard 
                  icon={TrendingUp}
                  label="Net Present Value (NPV)" 
                  value={formatCurrency(results.npv)} 
                  subtext={`Discount Rate: ${inputs.discountRate}%`}
                  trend={results.npv > 0 ? 'positive' : 'negative'}
                />
                <MetricCard 
                  icon={Activity}
                  label="Payback Period" 
                  value={`${results.paybackPeriod} Years`} 
                  subtext={results.paybackPeriod < 7 ? "Healthy Return" : "Long Term Hold"}
                />
                <MetricCard 
                  icon={DollarSign}
                  label="Total CAPEX (Net)" 
                  value={formatCurrency(results.netCapex)} 
                  subtext={`Equity: ${formatCurrency(results.equityInvestment)}`}
                />
                 <MetricCard 
                  icon={BarChart2}
                  label="Year 5 EBITDA" 
                  value={formatCurrency(results.yearlyData[4]?.ebitda || 0)} 
                  subtext={`Margin: ${Math.round((results.yearlyData[4]?.ebitda / results.yearlyData[4]?.revenue)*100)}%`}
                  trend="positive"
                />
              </div>

              {/* Visualization Section with Tabs */}
              <div className="space-y-4">
                
                {/* Category Tabs */}
                <div className="border-b border-slate-200 dark:border-slate-700">
                  <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                    <button
                      onClick={() => setActiveGraphTab('financials')}
                      className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                        activeGraphTab === 'financials'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <DollarSign className="w-4 h-4" />
                      Financial Performance
                    </button>
                    <button
                      onClick={() => setActiveGraphTab('ops')}
                      className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                        activeGraphTab === 'ops'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <Activity className="w-4 h-4" />
                      Operational Metrics
                    </button>
                    <button
                      onClick={() => setActiveGraphTab('vehicles')}
                      className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                        activeGraphTab === 'vehicles'
                          ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                          : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <PieChart className="w-4 h-4" />
                      Vehicle Mix
                    </button>
                  </nav>
                </div>

                {/* Graph Content Area */}
                <div className="bg-white dark:bg-slate-800 p-3 sm:p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  
                  {activeGraphTab === 'financials' && (
                    <div className="flex flex-col h-[300px] sm:h-[400px] md:h-[500px]">
                      {/* Sub-Tabs */}
                      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto">
                         <button 
                            onClick={() => setFinancialSubTab('cashflow')}
                            className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${financialSubTab === 'cashflow' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                         >
                            Cumulative Cash Flow
                         </button>
                         <button 
                            onClick={() => setFinancialSubTab('composition')}
                            className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-semibold rounded-full border transition-colors whitespace-nowrap ${financialSubTab === 'composition' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                         >
                            Operating Composition
                         </button>
                      </div>

                      {/* Financial Charts */}
                      <div className="flex-1 w-full min-h-0">
                          {financialSubTab === 'cashflow' && (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={results.yearlyData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                    <RechartsTooltip 
                                    formatter={(value) => formatCurrency(value)}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend wrapperStyle={{paddingTop: '20px'}} />
                                    <Area type="monotone" dataKey="cumulativeCashFlow" name="Cumulative CF" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} />
                                    <Line type="monotone" dataKey="cashFlow" name="Annual FCF" stroke="#10b981" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                          )}

                          {financialSubTab === 'composition' && (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={results.yearlyData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }} stackOffset="sign">
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                                    <ReferenceLine y={0} stroke="#9ca3af" />
                                    <RechartsTooltip 
                                    formatter={(value) => formatCurrency(Math.abs(value))}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend wrapperStyle={{paddingTop: '20px'}} />
                                    <Area type="monotone" dataKey="revenue" name="Revenue" stackId="pos" fill="#3b82f6" stroke="#3b82f6" fillOpacity={0.8} />
                                    <Area type="monotone" dataKey="utilityCostNeg" name="Utility Cost" stackId="neg" fill="#ef4444" stroke="#ef4444" fillOpacity={0.8} />
                                    <Area type="monotone" dataKey="fixedOpexNeg" name="Fixed OpEx" stackId="neg" fill="#f97316" stroke="#f97316" fillOpacity={0.8} />
                                    <Area type="monotone" dataKey="taxesNeg" name="Taxes" stackId="neg" fill="#9ca3af" stroke="#9ca3af" fillOpacity={0.8} />
                                    <Area type="monotone" dataKey="debtNeg" name="Debt Svc" stackId="neg" fill="#64748b" stroke="#64748b" fillOpacity={0.8} />
                                    <Line type="monotone" dataKey="cashFlow" name="Free Cash Flow" stroke="#10b981" strokeWidth={3} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                          )}
                      </div>
                    </div>
                  )}

                  {activeGraphTab === 'ops' && (
                    <div className="flex flex-col h-[300px] sm:h-[400px] md:h-[500px]">
                      {/* Sub-Tabs */}
                      <div className="flex gap-1 sm:gap-2 mb-4 sm:mb-6 overflow-x-auto">
                         <button 
                            onClick={() => setOpsSubTab('utilization')}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${opsSubTab === 'utilization' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                         >
                            Utilization Rate
                         </button>
                         <button 
                            onClick={() => setOpsSubTab('throughput')}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${opsSubTab === 'throughput' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                         >
                            Throughput Volume
                         </button>
                      </div>

                      {/* Operational Charts */}
                      <div className="flex-1 w-full min-h-0">
                         {opsSubTab === 'utilization' && (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={results.yearlyData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis fontSize={12} tickLine={false} axisLine={false} unit="%" domain={[0, 'auto']} />
                                    <RechartsTooltip 
                                    formatter={(value) => `${formatNumber(value)}%`}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend wrapperStyle={{paddingTop: '20px'}} />
                                    <Line type="monotone" dataKey="utilization" name="Utilization %" stroke="#f59e0b" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                         )}

                         {opsSubTab === 'throughput' && (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={results.yearlyData} margin={{ top: 20, right: 30, bottom: 20, left: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="year" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="left" fontSize={12} tickLine={false} axisLine={false} />
                                    <YAxis yAxisId="right" orientation="right" fontSize={12} tickLine={false} axisLine={false} />
                                    <RechartsTooltip 
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Legend wrapperStyle={{paddingTop: '20px'}} />
                                    <Bar yAxisId="left" dataKey="energy" name="Energy (MWh)" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Line yAxisId="right" type="monotone" dataKey="sessions" name="Sessions/Yr" stroke="#6366f1" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                         )}
                      </div>
                    </div>
                  )}

                  {activeGraphTab === 'vehicles' && (
                    <div className="flex flex-col items-center justify-center min-h-[500px]">
                      {vehicles.length === 0 ? (
                        <div className="text-center text-slate-500 dark:text-slate-400">
                          <PieChart className="w-16 h-16 mx-auto mb-4 opacity-50" />
                          <p className="text-sm font-medium">No vehicles added yet</p>
                          <p className="text-xs mt-2">Add vehicles in the Site Parameters tab to see the mix visualization</p>
                        </div>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-6">Vehicle Mix Distribution</h3>
                          <ResponsiveContainer width="100%" height={400}>
                            <RechartsPieChart>
                              <Pie
                                data={vehicles.map((v, idx) => ({
                                  name: v.name,
                                  value: v.populationShare,
                                  battery: v.battery,
                                  avgKw: v.avgKw
                                }))}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={(entry) => `${entry.name}: ${entry.value}%`}
                                outerRadius={120}
                                fill="#8884d8"
                                dataKey="value"
                              >
                                {vehicles.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <RechartsTooltip 
                                formatter={(value, name, props) => [
                                  `${value}% (${props.payload.battery}kWh, Avg: ${props.payload.avgKw.toFixed(1)}kW)`,
                                  name
                                ]}
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                              />
                            </RechartsPieChart>
                          </ResponsiveContainer>
                          
                          {/* Vehicle Mix Summary */}
                          <div className="mt-6 w-full max-w-2xl">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Vehicles</div>
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{vehicles.length}</div>
                              </div>
                              <div className="bg-slate-50 dark:bg-slate-700/50 p-4 rounded-lg">
                                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Total Mix</div>
                                <div className={`text-2xl font-bold ${totalVehicleMix === 100 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                  {totalVehicleMix.toFixed(0)}%
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-3 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100">Pro Forma Statement</h3>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Detailed annual breakdown</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-3 sm:px-6 py-2 sm:py-3">Year</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3">Util %</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 hidden sm:table-cell">Sessions</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 hidden md:table-cell">Energy (MWh)</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right">Revenue</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-red-600 dark:text-red-400 hidden lg:table-cell">Utility Cost</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right text-red-600 dark:text-red-400 hidden lg:table-cell">Total OpEx</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right font-bold hidden md:table-cell">EBITDA</th>
                        <th className="px-3 sm:px-6 py-2 sm:py-3 text-right font-bold text-blue-600 dark:text-blue-400">Free CF</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {results.yearlyData.map((row) => (
                        <tr key={row.year} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-3 sm:px-6 py-2 sm:py-3 font-medium text-slate-900 dark:text-slate-100">{row.year}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3">{formatNumber(row.utilization)}%</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 hidden sm:table-cell">{row.sessions.toLocaleString()}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 hidden md:table-cell">{row.energy.toLocaleString()}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-right">{formatCurrency(row.revenue)}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-right text-red-500 dark:text-red-400 hidden lg:table-cell">({formatCurrency(row.utilityCost)})</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-right text-red-500 dark:text-red-400 hidden lg:table-cell">({formatCurrency(row.opex)})</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-right font-medium hidden md:table-cell">{formatCurrency(row.ebitda)}</td>
                          <td className="px-3 sm:px-6 py-2 sm:py-3 text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(row.cashFlow)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-3 sm:p-4 rounded-lg text-xs sm:text-sm text-blue-800 dark:text-blue-300 flex items-start gap-2 sm:gap-3">
                <Info className="w-4 h-4 sm:w-5 sm:h-5 shrink-0 mt-0.5" />
                <div>
                   <strong>Note on Logic:</strong> This model assumes a weighted average of vehicle types (Tesla M3, ID.4, Mach-E, etc.) to calculate session energy and duration. Demand charges are estimated using a Dynamic Coincidence Factor which scales linearly from 10% base to 100% at {inputs.peakDemandUtilThreshold}% utilization.
                </div>
              </div>

            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}