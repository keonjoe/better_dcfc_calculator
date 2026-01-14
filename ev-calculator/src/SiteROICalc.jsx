import React, { useState, useEffect, useMemo, useContext } from 'react';
import { 
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ComposedChart, Area, ReferenceLine
} from 'recharts';
import { 
  Calculator, DollarSign, Zap, Activity, Info, TrendingUp, Truck, Settings, Save, RotateCcw, Menu, ChevronLeft, ChevronRight, BarChart2, PieChart, Sun, Moon
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

const VEHICLE_DATA = [
  { id: 'tesla_m3', name: 'Tesla Model 3 LR', battery: 82, avgKw: 93, populationShare: 25 },
  { id: 'vw_id4', name: 'VW ID.4', battery: 77, avgKw: 91, populationShare: 12 },
  { id: 'mache', name: 'Ford Mach-E LR', battery: 92, avgKw: 85, populationShare: 12 },
  { id: 'rivian_r1s', name: 'Rivian R1S', battery: 135, avgKw: 124, populationShare: 8 },
  { id: 'tesla_s', name: 'Tesla Model S LR', battery: 100, avgKw: 129, populationShare: 8 },
  { id: 'bolt', name: 'Chevy Bolt', battery: 65, avgKw: 44, populationShare: 8 },
  { id: 'ioniq5', name: 'Hyundai Ioniq 5', battery: 77, avgKw: 197, populationShare: 10 },
  { id: 'f150', name: 'Ford F-150 Lightning', battery: 131, avgKw: 115, populationShare: 17 },
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
  const [vehicles, setVehicles] = useState(() => {
    const saved = localStorage.getItem('siteROIVehicles');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved Site ROI vehicles:', e);
      }
    }
    return VEHICLE_DATA;
  });
  
  // UI State
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('site');
  const [activeGraphTab, setActiveGraphTab] = useState('financials'); // 'financials' | 'ops'
  const [financialSubTab, setFinancialSubTab] = useState('cashflow'); // 'cashflow' | 'composition'
  const [opsSubTab, setOpsSubTab] = useState('utilization'); // 'utilization' | 'throughput'

  const [results, setResults] = useState(null);

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

  const handleVehicleChange = (id, field, value) => {
    setVehicles(prev => prev.map(v => v.id === id ? { ...v, [field]: value } : v));
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

    vehicles.forEach(v => {
      totalPop += v.populationShare;
    });

    vehicles.forEach(v => {
      const share = v.populationShare / totalPop;
      // Energy Delivered = Battery * (EndSoC - StartSoC)
      const energyDelivered = v.battery * ((avgEndSoC - avgStartSoC) / 100);
      // Real Duration = Energy / (AvgKW * Derating)
      const avgPowerReal = v.avgKw * performanceDerating;
      const durationHours = energyDelivered / avgPowerReal;
      
      weightedKWh += energyDelivered * share;
      weightedDuration += durationHours * share;
    });

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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans overflow-hidden transition-colors duration-200">
      {/* Header */}
      <header className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 p-4 md:p-6 z-20">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">

              <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                  <BarChart2 className="text-blue-600 dark:text-blue-400" />
                  DCFC Site ROI Calculator
                </h1>
              </div>
            </div>
            <div className="flex gap-2">
               <button 
                 onClick={() => setInputs(DEFAULT_INPUTS)}
                 className="flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors text-slate-700 dark:text-slate-300"
               >
                 <RotateCcw className="w-4 h-4" /> <span className="hidden sm:inline">Reset</span>
               </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg shadow-sm flex items-center gap-2">
              <Activity size={16} />
              {inputs.siteName}
            </div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Inputs */}
        <aside 
            className={`
                bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 overflow-y-auto shadow-md z-10 flex flex-col transition-all duration-300 ease-in-out absolute md:relative h-full
                ${isSidebarOpen ? 'w-80 translate-x-0' : 'w-0 -translate-x-full md:translate-x-0 md:w-0'}
            `}
        >
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10 min-w-[320px]">
             <div className="flex justify-between items-center mb-3">
                 <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Configuration</h2>
                 <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors" title={isSidebarOpen ? "Close sidebar" : "Open sidebar"}>
                   {isSidebarOpen ? <ChevronLeft className="w-5 h-5"/> : <ChevronRight className="w-5 h-5"/>}
                 </button>
             </div>
             <div className="flex gap-1 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
               {['site', 'costs', 'ops'].map(tab => (
                 <button
                   key={tab}
                   onClick={() => setActiveTab(tab)}
                   className={`flex-1 py-1.5 text-xs font-semibold rounded-md capitalize transition-all ${activeTab === tab ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                 >
                   {tab}
                 </button>
               ))}
             </div>
          </div>

          <div className="p-4 space-y-6 pb-20 min-w-[320px]">
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
                  
                  <div className="mt-4">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-2">Vehicle Mix (%)</label>
                    <div className="space-y-2">
                      {vehicles.map(v => (
                        <div key={v.id} className="flex justify-between items-center text-xs">
                          <span className="text-slate-600 dark:text-slate-400 truncate w-32">{v.name}</span>
                          <input 
                            type="number" 
                            className="w-16 border rounded px-1 py-0.5 text-right"
                            value={v.populationShare}
                            onChange={(e) => handleVehicleChange(v.id, 'populationShare', parseFloat(e.target.value))}
                          />
                        </div>
                      ))}
                    </div>
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
        </aside>

        {/* Floating Toggle Button (shown when sidebar is hidden) */}
        {!isSidebarOpen && (
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="fixed top-24 left-4 z-30 p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-lg transition-all duration-200 flex items-center gap-2"
            title="Show Configuration"
          >
            <ChevronRight className="w-5 h-5" />
            <span className="hidden sm:inline text-sm font-medium">Show Inputs</span>
          </button>
        )}

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50 dark:bg-slate-950 w-full">
          
          {results && (
            <div className="max-w-6xl mx-auto space-y-6">
              
              {/* Top KPI Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                  </nav>
                </div>

                {/* Graph Content Area */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                  
                  {activeGraphTab === 'financials' && (
                    <div className="flex flex-col h-[500px]">
                      {/* Sub-Tabs */}
                      <div className="flex gap-2 mb-6">
                         <button 
                            onClick={() => setFinancialSubTab('cashflow')}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${financialSubTab === 'cashflow' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
                         >
                            Cumulative Cash Flow
                         </button>
                         <button 
                            onClick={() => setFinancialSubTab('composition')}
                            className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${financialSubTab === 'composition' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-700' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-600'}`}
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
                    <div className="flex flex-col h-[500px]">
                      {/* Sub-Tabs */}
                      <div className="flex gap-2 mb-6">
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

                </div>
              </div>

              {/* Data Table */}
              <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Pro Forma Statement</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Detailed annual breakdown</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="px-6 py-3">Year</th>
                        <th className="px-6 py-3">Util %</th>
                        <th className="px-6 py-3">Sessions</th>
                        <th className="px-6 py-3">Energy (MWh)</th>
                        <th className="px-6 py-3 text-right">Revenue</th>
                        <th className="px-6 py-3 text-right text-red-600 dark:text-red-400">Utility Cost</th>
                        <th className="px-6 py-3 text-right text-red-600 dark:text-red-400">Total OpEx</th>
                        <th className="px-6 py-3 text-right font-bold">EBITDA</th>
                        <th className="px-6 py-3 text-right font-bold text-blue-600 dark:text-blue-400">Free Cash Flow</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {results.yearlyData.map((row) => (
                        <tr key={row.year} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">{row.year}</td>
                          <td className="px-6 py-3">{formatNumber(row.utilization)}%</td>
                          <td className="px-6 py-3">{row.sessions.toLocaleString()}</td>
                          <td className="px-6 py-3">{row.energy.toLocaleString()}</td>
                          <td className="px-6 py-3 text-right">{formatCurrency(row.revenue)}</td>
                          <td className="px-6 py-3 text-right text-red-500 dark:text-red-400">({formatCurrency(row.utilityCost)})</td>
                          <td className="px-6 py-3 text-right text-red-500 dark:text-red-400">({formatCurrency(row.opex)})</td>
                          <td className="px-6 py-3 text-right font-medium">{formatCurrency(row.ebitda)}</td>
                          <td className="px-6 py-3 text-right font-bold text-blue-600 dark:text-blue-400">{formatCurrency(row.cashFlow)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-4 rounded-lg text-sm text-blue-800 dark:text-blue-300 flex items-start gap-3">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                   <strong>Note on Logic:</strong> This model assumes a weighted average of vehicle types (Tesla M3, ID.4, Mach-E, etc.) to calculate session energy and duration. Demand charges are estimated using a Dynamic Coincidence Factor which scales linearly from 10% base to 100% at {inputs.peakDemandUtilThreshold}% utilization.
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </div>
  );
}