import os

# Project Structure and File Contents
project_name = "ev-calculator"

files = {
    "package.json": """{
  "name": "ev-calculator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "lucide-react": "^0.263.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "sql.js": "^1.8.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@vitejs/plugin-react": "^4.0.3",
    "autoprefixer": "^10.4.14",
    "eslint": "^8.45.0",
    "eslint-plugin-react": "^7.32.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "postcss": "^8.4.27",
    "tailwindcss": "^3.3.3",
    "vite": "^4.4.5"
  }
}""",

    "vite.config.js": """import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})""",

    "tailwind.config.js": """/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}""",

    "postcss.config.js": """export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}""",

    ".gitignore": """node_modules
.DS_Store
dist
dist-ssr
*.local
.vercel
*.db
""",

    "index.html": """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>A Better DCFC Charging Calculator</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>""",

    "src/main.jsx": """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)""",

    "src/index.css": """@tailwind base;
@tailwind components;
@tailwind utilities;

/* Reduce tooltip delay for faster appearance */
[title] {
  position: relative;
}

/* Limit dropdown menu height to match chart height (300px) */
@layer utilities {
  .dropdown-limited {
    appearance: none;
  }
  
  /* For browsers that support it, limit the dropdown options height */
  select[size] {
    max-height: 300px;
    overflow-y: auto;
  }
}""",

    "src/App.jsx": """import EVChargingCalculator from './EVChargingCalculator'

function App() {
  return <EVChargingCalculator />
}

export default App""",

    "src/EVChargingCalculator.jsx": """import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Battery, Zap, Clock, MapPin, Settings, Info, Upload, Database, ChevronDown, List, Loader2, Edit3, X, Sun, Moon, Linkedin } from 'lucide-react';

const Card = ({ children, className = "" }) => (
  <div className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 ${className}`}>
    {children}
  </div>
);

// Compacted InputGroup
const InputGroup = ({ label, value, onChange, min, max, step = 1, unit, subtext, disabled }) => (
  <div className={`mb-3 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
    <div className="flex justify-between items-baseline mb-1">
      <label className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
        {typeof value === 'number' ? value.toFixed(step < 1 ? 1 : 0) : value} {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      disabled={disabled}
      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
    />
    {subtext && <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtext}</p>}
  </div>
);

const NumberInput = ({ label, value, onChange, unit, disabled }) => (
  <div className={`flex flex-col ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</label>
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className={`w-full px-2 py-1.5 text-sm border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono ${disabled ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-blue-500'}`}
      />
      <span className="absolute right-2 top-1.5 text-slate-400 text-xs font-medium">{unit}</span>
    </div>
  </div>
);

const ChargingCurveChart = ({ curveData, startSoc, stopSoc, chargerMaxPower, darkMode, isCustomMode, onCurveEdit, editedPoints, setEditedPoints, onClearEdits }) => {
  const width = 600;
  const height = 300;
  const padding = { top: 20, right: 30, bottom: 40, left: 50 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [draggedPointIndex, setDraggedPointIndex] = useState(null);

  // Theme colors
  const theme = {
    grid: darkMode ? "#334155" : "#e2e8f0", 
    text: darkMode ? "#94a3b8" : "#94a3b8",
    chartBg: darkMode ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200",
    carCurve: darkMode ? "#475569" : "#cbd5e1",
    tooltipBg: darkMode ? "#1e293b" : "#ffffff",
    tooltipText: darkMode ? "#e2e8f0" : "#1e293b",
  };

  // Safe data check
  const safeCurveData = Array.isArray(curveData) ? curveData : [];

  // Determine Max Scale with Rounding
  const dataMax = safeCurveData.length > 0 ? Math.max(...safeCurveData.map(d => d.kw)) : 0;
  const scalingBase = Math.max(dataMax, chargerMaxPower + 100);
  const maxKw = Math.ceil(scalingBase / 100) * 100;
  
  // Generate 5 evenly spaced ticks (0 to 5)
  const yTicks = [0, 1, 2, 3, 4, 5].map(i => Math.round(i * (maxKw / 5)));

  const xScale = (soc) => padding.left + (soc / 100) * graphWidth;
  const yScale = (kw) => height - padding.bottom - (kw / maxKw) * graphHeight;

  // Helper to interpolate curve values correctly on the chart logic
  const getKwAt = (s) => {
    if (safeCurveData.length === 0) return 0;
    // exact match
    const p = safeCurveData.find(d => d.soc === s);
    if (p) return p.kw;
    
    // Find neighbors for interpolation
    let lower = safeCurveData[0];
    let upper = safeCurveData[safeCurveData.length - 1];
    
    for (let i = 0; i < safeCurveData.length; i++) {
        if (safeCurveData[i].soc <= s) lower = safeCurveData[i];
        if (safeCurveData[i].soc >= s && upper === safeCurveData[safeCurveData.length - 1]) {
            upper = safeCurveData[i];
            break; 
        }
    }
    
    if (lower.soc === upper.soc) return lower.kw;
    
    // Linear interpolation
    return lower.kw + (upper.kw - lower.kw) * ((s - lower.soc) / (upper.soc - lower.soc));
  };

  // Generate Path for Car's Curve
  const carCurvePath = useMemo(() => {
    if (safeCurveData.length === 0) return "";
    const firstPoint = safeCurveData[0];
    let d = `M ${xScale(firstPoint.soc)} ${yScale(firstPoint.kw)}`;
    safeCurveData.slice(1).forEach(p => {
      d += ` L ${xScale(p.soc)} ${yScale(p.kw)}`;
    });
    return d;
  }, [safeCurveData, maxKw]);

  // Generate Path for Actual Charging (Limited by Charger)
  const actualCurvePoints = useMemo(() => {
      return safeCurveData.map(p => ({
        soc: p.soc,
        kw: Math.min(p.kw, chargerMaxPower)
      }));
  }, [safeCurveData, chargerMaxPower]);
  
  const actualCurvePath = useMemo(() => {
    if (actualCurvePoints.length === 0) return "";
    const firstPoint = actualCurvePoints[0];
    let d = `M ${xScale(firstPoint.soc)} ${yScale(firstPoint.kw)}`;
    actualCurvePoints.slice(1).forEach(p => {
      d += ` L ${xScale(p.soc)} ${yScale(p.kw)}`;
    });
    return d;
  }, [actualCurvePoints, maxKw]);

  // Active Charging Area
  const activeAreaPath = useMemo(() => {
    if (safeCurveData.length === 0) return "";
    
    // Filter points that strictly fall inside the range
    const innerPoints = actualCurvePoints.filter(p => p.soc > startSoc && p.soc < stopSoc);
    
    // Calculate start and end points interpolated
    const startKw = Math.min(getKwAt(startSoc), chargerMaxPower);
    const stopKw = Math.min(getKwAt(stopSoc), chargerMaxPower);

    let d = `M ${xScale(startSoc)} ${height - padding.bottom}`; // Bottom Left
    d += ` L ${xScale(startSoc)} ${yScale(startKw)}`; // Top Left (interpolated)

    // Add all actual curve points in between
    innerPoints.forEach(p => {
      d += ` L ${xScale(p.soc)} ${yScale(p.kw)}`;
    });

    d += ` L ${xScale(stopSoc)} ${yScale(stopKw)}`; // Top Right (interpolated)
    d += ` L ${xScale(stopSoc)} ${height - padding.bottom}`; // Bottom Right
    d += " Z"; // Close

    return d;
  }, [actualCurvePoints, startSoc, stopSoc, safeCurveData, chargerMaxPower, maxKw]);

  const handleMouseMove = (e) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Convert pixel coordinates to SVG viewBox coordinates
    const svgX = (mouseX / rect.width) * width;
    
    // Check bounds to ensure we are within graph area (using SVG coordinates)
    if (svgX < padding.left || svgX > width - padding.right) {
        setTooltip(null);
        return;
    }

    const socRaw = ((svgX - padding.left) / graphWidth) * 100;
    const soc = Math.max(0, Math.min(100, socRaw));
    const idealKw = getKwAt(soc);
    const realKw = Math.min(idealKw, chargerMaxPower);
    
    setTooltip({
        x: svgX,
        yReal: yScale(realKw),
        yIdeal: yScale(idealKw),
        soc: soc,
        idealKw: idealKw,
        realKw: realKw
    });
  };

  const handleMouseLeave = () => {
      setTooltip(null);
  };

  const handlePointMouseDown = (e, index) => {
    if (!isCustomMode) return;
    e.stopPropagation();
    setDraggedPointIndex(index);
    // Mark this point as edited
    setEditedPoints(prev => new Set([...prev, index]));
  };

  const smoothCurveAround = (newCurveData, centerIndex, centerKw) => {
    // Apply smoothing to neighboring points
    const smoothRadius = 5; // Number of points on each side to smooth
    const result = [...newCurveData];
    
    // Set the center point
    result[centerIndex] = { ...result[centerIndex], kw: centerKw };
    
    // Simple smooth falloff for neighboring points
    for (let i = Math.max(0, centerIndex - smoothRadius); i <= Math.min(newCurveData.length - 1, centerIndex + smoothRadius); i++) {
      if (i === centerIndex || editedPoints.has(i)) continue;
      
      const distance = Math.abs(i - centerIndex);
      // Use cubic easing for smooth transition
      const t = distance / (smoothRadius + 1);
      const easing = 1 - Math.pow(1 - t, 3); // Ease-out cubic
      
      const originalKw = newCurveData[i].kw;
      const targetKw = centerKw;
      result[i] = { ...result[i], kw: originalKw * easing + targetKw * (1 - easing) };
    }
    
    return result;
  };

  const handlePointDrag = (e) => {
    if (!isCustomMode || draggedPointIndex === null) return;
    if (!svgRef.current) return;
    
    const rect = svgRef.current.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const svgY = (mouseY / rect.height) * height;
    
    // Convert to kW value
    const newKw = Math.max(0, Math.min(maxKw, ((height - padding.bottom - svgY) / graphHeight) * maxKw));
    
    // Update curve data with smoothing
    let newCurveData = [...safeCurveData];
    newCurveData = smoothCurveAround(newCurveData, draggedPointIndex, newKw);
    
    onCurveEdit(newCurveData);
  };

  const handlePointMouseUp = () => {
    setDraggedPointIndex(null);
  };

  useEffect(() => {
    if (draggedPointIndex !== null) {
      window.addEventListener('mousemove', handlePointDrag);
      window.addEventListener('mouseup', handlePointMouseUp);
      return () => {
        window.removeEventListener('mousemove', handlePointDrag);
        window.removeEventListener('mouseup', handlePointMouseUp);
      };
    }
  }, [draggedPointIndex, safeCurveData, maxKw]);

  return (
    <div className={`w-full overflow-hidden rounded-lg border shadow-inner ${theme.chartBg} transition-colors duration-200 relative`}>
      <svg 
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`} 
        className={`w-full h-auto ${isCustomMode ? 'cursor-default' : 'cursor-crosshair'}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {[0, 25, 50, 75, 100].map(tick => (
          <g key={`x-${tick}`} pointerEvents="none">
            <line 
              x1={xScale(tick)} y1={padding.top} 
              x2={xScale(tick)} y2={height - padding.bottom} 
              stroke={theme.grid} strokeDasharray="4 4" strokeWidth="1" 
            />
            <text x={xScale(tick)} y={height - 15} textAnchor="middle" fill={theme.text} fontSize="12">{tick}%</text>
          </g>
        ))}
        {/* Dynamic Y Scale */}
        {yTicks.map(tick => (
          <g key={`y-${tick}`} pointerEvents="none">
            <line 
              x1={padding.left} y1={yScale(tick)} 
              x2={width - padding.right} y2={yScale(tick)} 
              stroke={theme.grid} strokeDasharray="4 4" strokeWidth="1" 
            />
            <text x={padding.left - 10} y={yScale(tick) + 4} textAnchor="end" fill={theme.text} fontSize="12">{tick}</text>
          </g>
        ))}
        <line pointerEvents="none" x1={padding.left} y1={yScale(chargerMaxPower)} x2={width - padding.right} y2={yScale(chargerMaxPower)} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" opacity="0.6" />
        <text pointerEvents="none" x={width - padding.right - 10} y={yScale(chargerMaxPower) - 10} fill="#ef4444" textAnchor="end" fontSize="12">Charger Limit ({chargerMaxPower} kW)</text>
        <path pointerEvents="none" d={carCurvePath} fill="none" stroke={theme.carCurve} strokeWidth="2" strokeDasharray="4 4" />
        <path pointerEvents="none" d={activeAreaPath} fill="url(#gradient)" stroke="none" opacity="0.8" />
        <path pointerEvents="none" d={actualCurvePath} fill="none" stroke="#3b82f6" strokeWidth="3" />
        <line pointerEvents="none" x1={xScale(startSoc)} y1={padding.top} x2={xScale(startSoc)} y2={height - padding.bottom} stroke="#10b981" strokeWidth="2" />
        <line pointerEvents="none" x1={xScale(stopSoc)} y1={padding.top} x2={xScale(stopSoc)} y2={height - padding.bottom} stroke="#f59e0b" strokeWidth="2" />
        
        {/* Tooltip */}
        {tooltip && (
            <g pointerEvents="none">
                <line x1={tooltip.x} y1={padding.top} x2={tooltip.x} y2={height - padding.bottom} stroke={theme.text} strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
                {/* Ideal circle (behind, gray) */}
                <circle cx={tooltip.x} cy={tooltip.yIdeal} r="5" fill="#94a3b8" stroke="white" strokeWidth="2" />
                {/* Real circle (in front, blue) */}
                <circle cx={tooltip.x} cy={tooltip.yReal} r="5" fill="#3b82f6" stroke="white" strokeWidth="2" />
                <g transform={`translate(${tooltip.x < width / 2 ? tooltip.x + 15 : tooltip.x - 135}, ${tooltip.yReal < height / 2 ? tooltip.yReal : tooltip.yReal - 85})`}>
                    <rect width="120" height="75" rx="6" fill={theme.tooltipBg} stroke={theme.grid} strokeWidth="1" filter="drop-shadow(0 4px 6px rgb(0 0 0 / 0.3))" />
                    <text x="10" y="18" fontSize="11" fill={theme.text} fontWeight="normal">SoC: {Math.round(tooltip.soc)}%</text>
                    <line x1="10" y1="25" x2="110" y2="25" stroke={theme.grid} strokeWidth="1" />
                    <text x="10" y="40" fontSize="10" fill={theme.text} fontWeight="normal">Ideal:</text>
                    <text x="110" y="40" fontSize="12" fill="#94a3b8" fontWeight="bold" textAnchor="end">{Math.round(tooltip.idealKw)} kW</text>
                    <text x="10" y="60" fontSize="10" fill={theme.text} fontWeight="normal">Real:</text>
                    <text x="110" y="60" fontSize="14" fill="#3b82f6" fontWeight="bold" textAnchor="end">{Math.round(tooltip.realKw)} kW</text>
                </g>
            </g>
        )}

        {/* Editable points in custom mode - only show edited points */}
        {isCustomMode && safeCurveData.map((point, index) => {
          if (!editedPoints.has(index)) return null;
          return (
            <circle
              key={`point-${index}`}
              cx={xScale(point.soc)}
              cy={yScale(point.kw)}
              r="6"
              fill={draggedPointIndex === index ? "#3b82f6" : "#60a5fa"}
              stroke="white"
              strokeWidth="2"
              className="cursor-ns-resize hover:fill-blue-600 transition-colors"
              onMouseDown={(e) => handlePointMouseDown(e, index)}
            />
          );
        })}

        {/* Invisible clickable areas for all points in custom mode */}
        {isCustomMode && safeCurveData.map((point, index) => (
          <circle
            key={`clickarea-${index}`}
            cx={xScale(point.soc)}
            cy={yScale(point.kw)}
            r="12"
            fill="transparent"
            className="cursor-ns-resize"
            onMouseDown={(e) => handlePointMouseDown(e, index)}
          />
        ))}

        {/* Clear Edits Button */}
        {isCustomMode && editedPoints.size > 0 && (
          <g>
            <rect
              x={width / 2 - 40}
              y={height - padding.bottom + 10}
              width="80"
              height="22"
              rx="4"
              fill="white"
              fillOpacity="0.9"
              stroke="#dc2626"
              strokeWidth="1"
              className="cursor-pointer"
              onClick={onClearEdits}
            />
            <text
              x={width / 2}
              y={height - padding.bottom + 25}
              textAnchor="middle"
              fontSize="12"
              fill="#dc2626"
              fontWeight="600"
              className="cursor-pointer pointer-events-none"
            >
              Clear Edits
            </text>
          </g>
        )}

        <defs>
          <linearGradient id="gradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};

export default function EVChargingCalculator() {
  const [darkMode, setDarkMode] = useState(true); // Default to dark mode
  const [showTooltip, setShowTooltip] = useState(false);
  const [db, setDb] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modes: 'database' or 'custom'
  const [mode, setMode] = useState('database');

  // Selections
  const [makes, setMakes] = useState([]);
  const [models, setModels] = useState([]);
  const [variants, setVariants] = useState([]);
  
  const [selectedMake, setSelectedMake] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedVariant, setSelectedVariant] = useState(''); // Variant ID
  
  // Range Scenarios
  const [rangeScenarios, setRangeScenarios] = useState([]);
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(-1);

  // Data State
  const [batterySize, setBatterySize] = useState(77); 
  const [maxRange, setMaxRange] = useState(300);
  const [chargerPower, setChargerPower] = useState(400); // Default to 400kW
  const [startSoc, setStartSoc] = useState(10);
  const [stopSoc, setStopSoc] = useState(80);
  const [dwellTime, setDwellTime] = useState(5); // Default to 5 minutes
  
  // Curve Management
  const [rawDbCurve, setRawDbCurve] = useState([]); // Curve directly from DB
  const [curveMultiplier, setCurveMultiplier] = useState(1.0); // Multiplier for custom mode
  const [curveData, setCurveData] = useState([]); // Final curve used for display/calc
  const [userEditedCurve, setUserEditedCurve] = useState(null); // User modifications
  const [editedPointsSet, setEditedPointsSet] = useState(new Set()); // Track edited points

  // Comparison
  const [comparisonScenarios, setComparisonScenarios] = useState([]);

  // --- Formatters ---
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

  // --- DB Initialization ---
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
        
        const res = newDb.exec("SELECT DISTINCT make FROM vehicles ORDER BY make ASC");
        if (res.length > 0) setMakes(res[0].values.map(v => v[0]));
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

  // --- Cascading Selects ---
  useEffect(() => {
    if (!db || !selectedMake) return;
    const res = db.exec(`SELECT DISTINCT model FROM vehicles WHERE make = '${selectedMake}' ORDER BY model ASC`);
    if (res.length > 0) {
      const modelsList = res[0].values.map(v => v[0]);
      setModels(modelsList);
      // Only clear selected model if it's not in the new list
      if (selectedModel && !modelsList.includes(selectedModel)) {
        setSelectedModel('');
        setVariants([]);
      }
    }
  }, [db, selectedMake]);

  useEffect(() => {
    if (!db || !selectedModel) return;
    try {
      const res = db.exec(`SELECT id, variant FROM vehicles WHERE make = '${selectedMake}' AND model = '${selectedModel}'`);
      if (res.length > 0) {
        const variantsList = res[0].values.map(v => ({ id: v[0], name: v[1] }));
        setVariants(variantsList);
        // Only clear selected variant if it's not in the new list
        if (selectedVariant && !variantsList.find(v => v.id === selectedVariant)) {
          setSelectedVariant('');
        }
      }
    } catch (e) { console.warn(e); }
  }, [db, selectedModel]);

  // --- Fetch DB Data on Variant Selection ---
  useEffect(() => {
    if (!db || !selectedVariant) return;

    // Reset user edits when variant changes
    setUserEditedCurve(null);
    setEditedPointsSet(new Set());

    try {
      // 1. Get Charging Curve
      const curveRes = db.exec(`SELECT soc_percent, power_kw, energy_charged_kwh FROM charging_curve WHERE vehicle_id = '${selectedVariant}' ORDER BY soc_percent ASC`);
      
      let loadedCurve = [];
      let loadedBattery = 0;

      if (curveRes.length > 0 && curveRes[0].values.length > 0) {
         loadedCurve = curveRes[0].values.map(row => ({
             soc: row[0],
             kw: row[1],
             energy_kwh: row[2]
         }));
         
         setRawDbCurve(loadedCurve);

         // Battery from curve
         const p100 = loadedCurve.find(p => p.soc === 100);
         const pMax = loadedCurve[loadedCurve.length - 1];
         if (p100 && p100.energy_kwh > 0) loadedBattery = p100.energy_kwh;
         else if (pMax && pMax.energy_kwh > 0) loadedBattery = pMax.energy_kwh;
      } else {
         setRawDbCurve([]);
      }

      // Battery fallback
      if (loadedBattery === 0) {
          const stmt = db.prepare("SELECT battery_usable_kwh FROM vehicles WHERE id = :id");
          const result = stmt.getAsObject({':id': selectedVariant});
          if (result && result.battery_usable_kwh) loadedBattery = result.battery_usable_kwh;
          stmt.free();
      }

      // 2. Fetch Range Scenarios
      try {
        const scenarioRes = db.exec(`SELECT scenario_name, range_km FROM range_scenarios WHERE vehicle_id = '${selectedVariant}'`);
        let scenarios = [];
        if (scenarioRes.length > 0 && scenarioRes[0].values.length > 0) {
            scenarios = scenarioRes[0].values.map(row => ({
                scenario_name: row[0],
                range_km: row[1]
            }));
            setRangeScenarios(scenarios);
            
            // Set Default - prioritize "120kph/75mph range in perfect condition"
            let defIdx = scenarios.findIndex(s => s.scenario_name && s.scenario_name.toLowerCase().includes('120kmh/75mph range in perfect condition'));
            if (defIdx === -1) defIdx = 0; // Fallback to first option
            setSelectedScenarioIndex(defIdx);
            
            // Apply Database Values Only if in Database Mode
            if (mode === 'database') {
                if (scenarios[defIdx].range_km) setMaxRange(Math.round(scenarios[defIdx].range_km * 0.621371));
                if (loadedBattery > 0) setBatterySize(loadedBattery);
                setCurveData(loadedCurve);
            } else {
                // In custom mode, just update the background/reference curve
                if (loadedCurve.length > 0) {
                    setCurveData(loadedCurve.map(p => ({...p, kw: p.kw * curveMultiplier})));
                }
            }
        } else {
            setRangeScenarios([]);
        }
      } catch (e) { console.warn(e); setRangeScenarios([]); }

    } catch (e) { console.error(e); }
  }, [db, selectedVariant, mode]);

  // --- Effect: Handle Curve Logic based on Mode/Inputs ---
  useEffect(() => {
      if (mode === 'database') {
          // Reset multiplier and user edits if we go back to DB
          setCurveMultiplier(1.0);
          setUserEditedCurve(null);
          setEditedPointsSet(new Set());
          // Curve is already set by variant selection effect
          if (rawDbCurve.length > 0) setCurveData(rawDbCurve);
      } else {
          // Custom Mode - Apply multiplier to reference DB curve or user edited curve
          if (rawDbCurve.length > 0) {
              if (userEditedCurve) {
                  // Apply multiplier to user-edited curve
                  const multiplied = userEditedCurve.map(p => ({...p, kw: p.kw * curveMultiplier}));
                  setCurveData(multiplied);
              } else {
                  // Apply multiplier to reference DB curve
                  const multiplied = rawDbCurve.map(p => ({...p, kw: p.kw * curveMultiplier}));
                  setCurveData(multiplied);
              }
          }
      }
  }, [mode, curveMultiplier, rawDbCurve, userEditedCurve]);

  const handleCurveEdit = (newCurveData) => {
    // Store the edited curve without multiplier (base values)
    const baseCurve = newCurveData.map(p => ({...p, kw: p.kw / curveMultiplier}));
    setUserEditedCurve(baseCurve);
    setCurveData(newCurveData);
  };

  const clearCurveEdits = () => {
    setUserEditedCurve(null);
    setEditedPointsSet(new Set());
    // Reset to base curve with multiplier
    if (rawDbCurve.length > 0) {
      const multiplied = rawDbCurve.map(p => ({...p, kw: p.kw * curveMultiplier}));
      setCurveData(multiplied);
    }
  };

  const handleScenarioChange = (idx) => {
      setSelectedScenarioIndex(idx);
      const s = rangeScenarios[idx];
      if (s && s.range_km) {
          setMaxRange(Math.round(s.range_km * 0.621371));
      }
  };

  const addToComparison = () => {
    // Validate that all dropdowns have selections
    if (!selectedMake || !selectedModel || !selectedVariant) {
      alert('Please select a vehicle (Make, Model, and Variant) before adding to comparison.');
      return;
    }
    
    const variantObj = variants.find(v => String(v.id) === String(selectedVariant));
    const variantName = variantObj?.name || '';
    const scenario = {
      id: Date.now(),
      make: selectedMake,
      model: selectedModel,
      variant: variantName,
      batterySize,
      maxRange,
      startSoc,
      stopSoc,
      chargerPower,
      timeMins: result.timeMins,
      kwhAdded: result.kwhAdded,
      rangeAdded: result.rangeAdded,
      rangeAddedKm: result.rangeAddedKm,
      avgSpeed: result.avgSpeed,
      avgSpeedMph: result.avgSpeedMph,
      avgSpeedKph: result.avgSpeedKph
    };
    setComparisonScenarios([...comparisonScenarios, scenario]);
  };

  const surpriseMe = () => {
    if (!db || makes.length === 0) return;
    
    // Select random make
    const randomMake = makes[Math.floor(Math.random() * makes.length)];
    
    // Get models for this make
    const res = db.exec(`SELECT DISTINCT model FROM vehicles WHERE make = '${randomMake}' ORDER BY model ASC`);
    if (res.length > 0) {
      const modelsList = res[0].values.map(v => v[0]);
      const randomModel = modelsList[Math.floor(Math.random() * modelsList.length)];
      
      // Get variants for this model
      const varRes = db.exec(`SELECT id, variant FROM vehicles WHERE make = '${randomMake}' AND model = '${randomModel}'`);
      if (varRes.length > 0) {
        const variantsList = varRes[0].values.map(v => ({ id: v[0], name: v[1] }));
        const randomVariant = variantsList[Math.floor(Math.random() * variantsList.length)];
        
        // Set all state synchronously to avoid cascading effects
        setSelectedMake(randomMake);
        setModels(modelsList);
        setSelectedModel(randomModel);
        setVariants(variantsList);
        setSelectedVariant(randomVariant.id);
      }
    }
  };

  const removeFromComparison = (id) => {
    setComparisonScenarios(comparisonScenarios.filter(s => s.id !== id));
  };

  // --- Calculations ---
  const result = useMemo(() => {
    const safeStart = Math.min(startSoc, 99);
    const safeStop = Math.max(safeStart + 1, stopSoc);
    if (stopSoc <= startSoc || curveData.length === 0) return { timeMins: 0, kwhAdded: 0, rangeAdded: 0, rangeAddedKm: 0, avgSpeed: 0, avgSpeedMph: 0, avgSpeedKph: 0 };

    let totalHours = 0;
    
    const getKwAtSoc = (s) => {
        const p = curveData.find(x => x.soc === s);
        if (p) return p.kw;
        const lower = curveData.filter(x => x.soc < s).pop();
        const upper = curveData.find(x => x.soc > s);
        if (!lower) return upper ? upper.kw : 0;
        if (!upper) return lower.kw;
        return lower.kw + (upper.kw - lower.kw) * ((s - lower.soc) / (upper.soc - lower.soc));
    };

    const energyPerStep = batterySize * 0.01;

    for (let i = safeStart; i < safeStop; i++) {
      const carCapability = getKwAtSoc(i);
      const actualPower = Math.min(carCapability, chargerPower);
      const powerSafe = Math.max(1, actualPower); 
      totalHours += energyPerStep / powerSafe; 
    }

    // Include Dwell Time
    totalHours += dwellTime / 60;

    const timeMins = totalHours * 60;
    const kwhAdded = (safeStop - safeStart) / 100 * batterySize;
    const rangeAdded = (safeStop - safeStart) / 100 * maxRange;
    const rangeAddedKm = rangeAdded * 1.60934;
    const avgSpeed = kwhAdded / totalHours;
    
    const avgSpeedMph = totalHours > 0 ? rangeAdded / totalHours : 0;
    const avgSpeedKph = totalHours > 0 ? rangeAddedKm / totalHours : 0;

    return { timeMins, kwhAdded, rangeAdded, rangeAddedKm, avgSpeed, avgSpeedMph, avgSpeedKph };
  }, [startSoc, stopSoc, batterySize, maxRange, chargerPower, curveData, dwellTime]);

  const formatTime = (totalMins) => {
      const totalSeconds = totalMins * 60;
      const m = Math.floor(totalSeconds / 60);
      const s = Math.floor(totalSeconds % 60);
      return (
        <span>
          {m}<span className="text-[10px]">m</span> {s}<span className="text-[10px]">s</span>
        </span>
      );
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-4 md:p-6 transition-colors duration-200">
        
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-6 flex justify-between items-end">
            <div>
              <h1 className="text-2xl font-bold flex items-center justify-start gap-2">
                <Zap className="text-blue-600 dark:text-blue-400" fill="currentColor" />
                A Better DCFC Charging Calculator
              </h1>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Based on data from EVKX</p>
            </div>
            
            <div className="relative">
              <button 
                onClick={() => setDarkMode(!darkMode)}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className="p-2 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                {darkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              {showTooltip && (
                <div className="absolute top-full right-0 mt-2 px-2 py-1 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50">
                  {darkMode ? "Prepare to be blinded!" : "Join the dark side!"}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-3">
              {/* Database Status */}
              {isLoading && (
                <Card className="p-4 border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800">
                  <div className="flex flex-col items-center text-center py-2">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin mb-2" />
                    <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">Loading Database...</p>
                  </div>
                </Card>
              )}

              {!isLoading && error && (
                <Card className="p-4 border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800">
                  <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
                </Card>
              )}

              {!isLoading && !error && db && (
                <Card className={`p-4 border-l-4 ${mode === 'database' ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                  
                  {/* Mode Toggle */}
                  <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mb-4">
                    <button 
                      onClick={() => setMode('database')}
                      className={`flex-1 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${mode === 'database' ? 'bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Database
                    </button>
                    <button 
                      onClick={() => setMode('custom')}
                      className={`flex-1 py-1 text-[10px] uppercase font-bold rounded-md transition-all ${mode === 'custom' ? 'bg-white dark:bg-slate-600 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                      Custom
                    </button>
                  </div>

                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm flex items-center gap-2">
                      <Settings size={16} className={mode === 'database' ? "text-slate-400" : "text-purple-400"} />
                      {mode === 'database' ? 'Select Vehicle' : 'Reference Curve'}
                    </h3>
                    <button
                      onClick={surpriseMe}
                      className="text-[10px] px-2 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 rounded transition-colors font-medium"
                    >
                      Surprise Me!
                    </button>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Make</label>
                      <div className="relative">
                        <select 
                          value={selectedMake} 
                          onChange={(e) => setSelectedMake(e.target.value)}
                          style={{maxHeight: '300px'}}
                          className="w-full py-1.5 px-2 text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded appearance-none text-slate-800 dark:text-slate-200"
                        >
                          <option value="">Select Make...</option>
                          {makes.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-2 text-slate-400 pointer-events-none"/>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Model</label>
                      <div className="relative">
                        <select 
                          value={selectedModel} 
                          onChange={(e) => setSelectedModel(e.target.value)}
                          disabled={!selectedMake}
                          style={{maxHeight: '300px'}}
                          className="w-full py-1.5 px-2 text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded appearance-none text-slate-800 dark:text-slate-200 disabled:opacity-50"
                        >
                          <option value="">Select Model...</option>
                          {models.map(m => <option key={m} value={m}>{formatLabel(m)}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-2 text-slate-400 pointer-events-none"/>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Variant</label>
                      <div className="relative">
                        <select 
                          value={selectedVariant} 
                          onChange={(e) => setSelectedVariant(e.target.value)}
                          disabled={!selectedModel}
                          style={{maxHeight: '300px'}}
                          className="w-full py-1.5 px-2 text-xs bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded appearance-none text-slate-800 dark:text-slate-200 disabled:opacity-50"
                        >
                          <option value="">Select Variant...</option>
                          {variants.map(v => <option key={v.id} value={v.id}>{formatLabel(v.name)}</option>)}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-2 text-slate-400 pointer-events-none"/>
                      </div>
                    </div>

                    {/* Custom Mode Extras */}
                    {mode === 'custom' && (
                      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-700 animate-in fade-in slide-in-from-top-2">
                        <InputGroup 
                          label="Curve Multiplier" 
                          value={curveMultiplier} 
                          onChange={setCurveMultiplier} 
                          min={0.1} max={5.0} step={0.1} unit="x" 
                          subtext="Scale the reference charging speed"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                  <Battery size={16} className="text-slate-400" />
                  Specs {mode === 'custom' && <Edit3 size={12} className="text-purple-400 ml-1" />}
                </h3>
                
                {rangeScenarios.length > 0 && mode === 'database' && (
                  <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                     <div className="flex items-center gap-1.5 mb-1">
                        <List size={10} className="text-blue-600 dark:text-blue-400" />
                        <label className="text-[9px] font-bold text-blue-700 dark:text-blue-300 uppercase">Range Scenario</label>
                     </div>
                     <div className="relative">
                        <select 
                          value={selectedScenarioIndex}
                          onChange={(e) => handleScenarioChange(Number(e.target.value))}
                          style={{maxHeight: '300px'}}
                          className="w-full text-[10px] p-1.5 pr-6 rounded border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white dark:bg-slate-700 cursor-pointer"
                        >
                          {rangeScenarios.map((opt, idx) => (
                            <option key={idx} value={idx}>
                              {formatLabel(opt.scenario_name)} ({Math.round(opt.range_km * 0.621371)} mi)
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" />
                     </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <NumberInput 
                    label="Battery Size" 
                    value={batterySize} 
                    onChange={setBatterySize} 
                    unit="kWh" 
                    disabled={mode === 'database'} 
                  />
                  <div>
                    <NumberInput 
                      label="Max Range" 
                      value={maxRange} 
                      onChange={setMaxRange} 
                      unit="mi" 
                      disabled={mode === 'database'} 
                    />
                    <div className="text-[9px] text-slate-400 text-right mt-0.5 font-mono">
                      ≈ {(maxRange * 1.60934).toFixed(0)} km
                    </div>
                  </div>
                </div>
                <div className="pt-3 border-t border-slate-100 dark:border-slate-700">
                   <InputGroup 
                    label="Station Power" 
                    value={chargerPower} 
                    onChange={setChargerPower} 
                    min={20} max={600} step={10} unit="kW" 
                  />
                   <InputGroup 
                    label="Dwell Time" 
                    value={dwellTime} 
                    onChange={setDwellTime} 
                    min={0} max={30} step={1} unit="min" 
                    subtext="Non-charging delay (park, pay, etc)"
                  />
                </div>
              </Card>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <Card className="p-6 bg-white dark:bg-slate-800">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Charging Session</h2>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-400 opacity-50"></div><span className="text-slate-500 dark:text-slate-400">Vehicle Limit</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-slate-800 dark:text-slate-200 font-medium">Actual Speed</span></div>
                  </div>
                </div>

                <ChargingCurveChart 
                  curveData={curveData} 
                  startSoc={startSoc} 
                  stopSoc={stopSoc} 
                  chargerMaxPower={chargerPower}
                  darkMode={darkMode}
                  isCustomMode={mode === 'custom'}
                  onCurveEdit={handleCurveEdit}
                  editedPoints={editedPointsSet}
                  setEditedPoints={setEditedPointsSet}
                  onClearEdits={clearCurveEdits}
                />

                <div className="mt-6 px-2 relative h-12 select-none">
                  <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate-200 dark:bg-slate-700 rounded-full -translate-y-1/2"></div>
                  <div 
                    className="absolute top-1/2 h-2 bg-blue-500 rounded-full -translate-y-1/2"
                    style={{ left: `${startSoc}%`, right: `${100 - stopSoc}%` }}
                  ></div>
                  <input 
                    type="range" 
                    min="0" max="99" 
                    value={startSoc} 
                    onChange={(e) => { const val = Number(e.target.value); setStartSoc(Math.min(val, stopSoc - 1)); }} 
                    className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-2 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab z-20"
                  />
                  <input 
                    type="range" 
                    min="1" max="100" 
                    value={stopSoc} 
                    onChange={(e) => { const val = Number(e.target.value); setStopSoc(Math.max(val, startSoc + 1)); }} 
                    className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-2 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-amber-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab z-30"
                  />
                  <div 
                    className="absolute top-8 transform -translate-x-1/2 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base transition-all"
                    style={{ left: `${startSoc}%` }}
                  >
                    {startSoc}%
                  </div>
                  <div 
                    className="absolute top-8 transform -translate-x-1/2 font-mono font-bold text-amber-500 dark:text-amber-400 text-base transition-all"
                    style={{ left: `${stopSoc}%` }}
                  >
                    {stopSoc}%
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4 border-l-4 border-l-blue-500">
                  <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><Clock size={20} /></div><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Time</span></div>
                  <div className="flex items-baseline gap-1"><span className="text-3xl font-bold text-slate-800 dark:text-slate-100">{formatTime(result.timeMins)}</span></div>
                </Card>
                
                <Card className="p-4 border-l-4 border-l-emerald-500">
                  <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><MapPin size={20} /></div><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Range Added</span></div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{result.rangeAdded.toFixed(0)}</span><span className="text-sm text-slate-500 dark:text-slate-400 font-medium">mi</span></div>
                    <div className="flex items-baseline gap-1"><span className="text-lg font-semibold text-slate-400 dark:text-slate-500">{result.rangeAddedKm.toFixed(0)}</span><span className="text-xs text-slate-400 dark:text-slate-500 font-medium">km</span></div>
                  </div>
                </Card>
                
                <Card className="p-4 border-l-4 border-l-purple-500">
                  <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-purple-100 text-purple-600 rounded-lg"><Zap size={20} /></div><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg Speed</span></div>
                  <div className="space-y-1">
                     <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-700 pb-1 mb-1">
                        <span className="text-slate-500 dark:text-slate-400">Power</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{result.avgSpeed.toFixed(0)} kW</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Range</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">{result.avgSpeedMph.toFixed(0)} mph</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400"></span>
                        <span className="font-mono text-slate-400 dark:text-slate-500">{result.avgSpeedKph.toFixed(0)} kph</span>
                     </div>
                  </div>
                </Card>
              </div>

              {/* Add to Comparison Button and Credits */}
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={addToComparison}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Database size={16} />
                  Add to Comparison
                </button>
                
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span>Made by Qiyuan Zhou</span>
                  <a 
                    href="https://www.linkedin.com/in/keonjoe/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Linkedin size={16} />
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Comparison Table */}
          {comparisonScenarios.length > 0 && (
            <div className="mt-8">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Comparison Table</h2>
                  <button
                    onClick={() => setComparisonScenarios([])} 
                    className="text-xs text-slate-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
                  >
                    Clear All
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-slate-200 dark:border-slate-700">
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Vehicle</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Battery</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Range</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">SoC</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Charger</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Time</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Range Added</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Avg Speed</th>
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonScenarios.map((scenario) => (
                        <tr key={scenario.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="py-3 px-2">
                            <div className="font-medium text-slate-800 dark:text-slate-100">
                              {formatLabel(scenario.make)} {formatLabel(scenario.model)}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{formatLabel(scenario.variant)}</div>
                          </td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.batterySize}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> kWh</span></td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.maxRange}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mi</span></td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.startSoc}</span><span className="text-[10px] text-slate-700 dark:text-slate-200">%</span><span className="text-slate-700 dark:text-slate-200"> → </span><span className="text-slate-700 dark:text-slate-200">{scenario.stopSoc}</span><span className="text-[10px] text-slate-700 dark:text-slate-200">%</span></td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.chargerPower}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> kW</span></td>
                          <td className="py-3 px-2 font-mono text-slate-700 dark:text-slate-200">{formatTime(scenario.timeMins)}</td>
                          <td className="py-3 px-2">
                            <div><span className="text-slate-700 dark:text-slate-200">{scenario.rangeAdded.toFixed(0)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mi</span></div>
                            <div><span className="text-slate-500 dark:text-slate-400 text-xs">{scenario.rangeAddedKm.toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> km</span></div>
                          </td>
                          <td className="py-3 px-2">
                            <div><span className="text-slate-700 dark:text-slate-200">{scenario.avgSpeed.toFixed(0)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> kW</span></div>
                            <div><span className="text-slate-500 dark:text-slate-400 text-xs">{scenario.avgSpeedMph.toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> mph</span><span className="text-slate-500 dark:text-slate-400 text-xs"> / </span><span className="text-slate-500 dark:text-slate-400 text-xs">{scenario.avgSpeedKph.toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> kph</span></div>
                          </td>
                          <td className="py-3 px-2">
                            <button onClick={() => removeFromComparison(scenario.id)} className="text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}"""
}

# Ensure directory exists
if not os.path.exists(project_name):
    os.makedirs(project_name)

# Create files
for file_path, content in files.items():
    # Handle subdirectories
    full_path = os.path.join(project_name, file_path)
    dir_name = os.path.dirname(full_path)
    
    if dir_name and not os.path.exists(dir_name):
        os.makedirs(dir_name)
    
    # Write file
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(content)
        print(f"Created {full_path}")

# Create public folder for the DB file
public_dir = os.path.join(project_name, "public")
if not os.path.exists(public_dir):
    os.makedirs(public_dir)

print("\\nProject created successfully!")
print(f"1. Copy your 'ev_data.db' file into the '{public_dir}' folder.")
print(f"2. cd {project_name}")
print("3. npm install")
print("4. vercel dev (to test locally)")
print("5. vercel (to deploy)")