import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Battery, Zap, Clock, MapPin, Settings, Info, Upload, Database, ChevronDown, List, Loader2, Edit3, X, Sun, Moon, Linkedin, Activity, BarChart3, BookOpen } from 'lucide-react';

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
        {typeof value === 'number' ? value.toFixed(step < 1 ? 2 : 0) : value} {unit}
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

const NumberInput = ({ label, value, onChange, unit, disabled }) => {
  const [inputValue, setInputValue] = useState(String(value ?? ''));
  useEffect(() => {
    setInputValue(String(value ?? ''));
  }, [value]);

  const commit = () => {
    const v = inputValue === '' ? 0 : Number(inputValue);
    if (!Number.isNaN(v) && v >= 0) onChange(Math.max(0, v));
  };

  return (
    <div className={`flex flex-col ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      {label && <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">{label}</label>}
      <div className="relative">
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }}
          disabled={disabled}
          className={`w-full px-2 py-1.5 text-sm border rounded-lg text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-mono ${disabled ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 focus:border-blue-500'}`}
        />
        {unit && <span className="absolute right-2 top-1.5 text-slate-400 text-xs font-medium">{unit}</span>}
      </div>
    </div>
  );
};

// Compact charging curve preview for tooltips
const CompactCurvePreview = ({ curveData, startSoc, stopSoc, chargerMaxPower, darkMode }) => {
  const width = 250;
  const height = 150;
  const padding = { top: 10, right: 10, bottom: 20, left: 35 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const theme = {
    grid: darkMode ? "#334155" : "#e2e8f0",
    text: darkMode ? "#94a3b8" : "#64748b",
    carCurve: darkMode ? "#475569" : "#cbd5e1",
  };

  const safeCurveData = Array.isArray(curveData) ? curveData : [];
  if (safeCurveData.length === 0) return null;

  const dataMax = Math.max(...safeCurveData.map(d => d.kw));
  const maxKw = Math.ceil(Math.max(dataMax, chargerMaxPower) / 100) * 100;

  const xScale = (soc) => padding.left + (soc / 100) * graphWidth;
  const yScale = (kw) => height - padding.bottom - (kw / maxKw) * graphHeight;

  const getKwAt = (s) => {
    const p = safeCurveData.find(d => d.soc === s);
    if (p) return p.kw;
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
    return lower.kw + (upper.kw - lower.kw) * ((s - lower.soc) / (upper.soc - lower.soc));
  };

  const actualCurvePoints = safeCurveData.map(p => ({
    soc: p.soc,
    kw: Math.min(p.kw, chargerMaxPower)
  }));

  let actualCurvePath = "";
  if (actualCurvePoints.length > 0) {
    actualCurvePath = `M ${xScale(actualCurvePoints[0].soc)} ${yScale(actualCurvePoints[0].kw)}`;
    actualCurvePoints.slice(1).forEach(p => {
      actualCurvePath += ` L ${xScale(p.soc)} ${yScale(p.kw)}`;
    });
  }

  const innerPoints = actualCurvePoints.filter(p => p.soc > startSoc && p.soc < stopSoc);
  const startKw = Math.min(getKwAt(startSoc), chargerMaxPower);
  const stopKw = Math.min(getKwAt(stopSoc), chargerMaxPower);

  let activeAreaPath = `M ${xScale(startSoc)} ${height - padding.bottom}`;
  activeAreaPath += ` L ${xScale(startSoc)} ${yScale(startKw)}`;
  innerPoints.forEach(p => {
    activeAreaPath += ` L ${xScale(p.soc)} ${yScale(p.kw)}`;
  });
  activeAreaPath += ` L ${xScale(stopSoc)} ${yScale(stopKw)}`;
  activeAreaPath += ` L ${xScale(stopSoc)} ${height - padding.bottom}`;
  activeAreaPath += " Z";

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
      {[0, 50, 100].map(tick => (
        <g key={`x-${tick}`}>
          <line x1={xScale(tick)} y1={padding.top} x2={xScale(tick)} y2={height - padding.bottom} stroke={theme.grid} strokeWidth="1" />
          <text x={xScale(tick)} y={height - 5} textAnchor="middle" fill={theme.text} fontSize="10">{tick}%</text>
        </g>
      ))}
      {[0, maxKw / 2, maxKw].map(tick => (
        <g key={`y-${tick}`}>
          <line x1={padding.left} y1={yScale(tick)} x2={width - padding.right} y2={yScale(tick)} stroke={theme.grid} strokeWidth="1" />
          <text x={padding.left - 5} y={yScale(tick) + 3} textAnchor="end" fill={theme.text} fontSize="10">{tick}</text>
        </g>
      ))}
      <line x1={padding.left} y1={yScale(chargerMaxPower)} x2={width - padding.right} y2={yScale(chargerMaxPower)} stroke="#ef4444" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.6" />
      <path d={activeAreaPath} fill="url(#gradient-compact)" stroke="none" opacity="0.8" />
      <path d={actualCurvePath} fill="none" stroke="#3b82f6" strokeWidth="2" />
      <line x1={xScale(startSoc)} y1={padding.top} x2={xScale(startSoc)} y2={height - padding.bottom} stroke="#10b981" strokeWidth="1.5" />
      <line x1={xScale(stopSoc)} y1={padding.top} x2={xScale(stopSoc)} y2={height - padding.bottom} stroke="#f59e0b" strokeWidth="1.5" />
      <defs>
        <linearGradient id="gradient-compact" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.1" />
        </linearGradient>
      </defs>
    </svg>
  );
};

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
  const [currentPage, setCurrentPage] = useState('calculator'); // 'calculator', 'leaderboards', or 'info'
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

  // Road Trip Mode
  const [tripMode, setTripMode] = useState('single'); // 'single' or 'roadtrip'
  const [tripDistance, setTripDistance] = useState(500);
  const [tripDistanceUnit, setTripDistanceUnit] = useState('mi'); // 'mi' or 'km'
  const [drivingSpeed, setDrivingSpeed] = useState(70); // mph - only used in custom mode
  const [drivingSpeedUnit, setDrivingSpeedUnit] = useState('mph'); // 'mph' or 'kph'
  
  // Leaderboards State
  const [leaderboardMetric, setLeaderboardMetric] = useState('fastest-charging'); // 'fastest-charging', 'highest-avg-power', 'best-range-per-hour'
  const [leaderboardStartSoc, setLeaderboardStartSoc] = useState(10);
  const [leaderboardStopSoc, setLeaderboardStopSoc] = useState(80);
  const [leaderboardChargerPower, setLeaderboardChargerPower] = useState(400);
  const [leaderboardVehicleCount, setLeaderboardVehicleCount] = useState(10);
  const [leaderboardResults, setLeaderboardResults] = useState([]);
  const [isCalculatingLeaderboard, setIsCalculatingLeaderboard] = useState(false);
  const [leaderboardRangeScenarios, setLeaderboardRangeScenarios] = useState([]);
  const [leaderboardSelectedScenario, setLeaderboardSelectedScenario] = useState('');
  const [hoveredCurve, setHoveredCurve] = useState(null);
  const [infoFeatureView, setInfoFeatureView] = useState('calculator'); // 'calculator' or 'leaderboard'
  const [customLeaderboardVehicles, setCustomLeaderboardVehicles] = useState([]); // Custom vehicles for leaderboard
  const [customTagLabel, setCustomTagLabel] = useState('Custom'); // Label for custom tag
  const [leaderboardFeedback, setLeaderboardFeedback] = useState(''); // Feedback message for add to leaderboard
  const [availableCountries, setAvailableCountries] = useState([]); // List of all countries from database
  const [includedCountries, setIncludedCountries] = useState([]); // Countries to include in leaderboard (all by default)
  const [selectedChargePortRegions, setSelectedChargePortRegions] = useState(['chargeport_type_na', 'chargeport_type_china', 'chargeport_type_eu', 'chargeport_type_japan', 'chargeport_type_oceania']); // Selected charge port regions
  const [showCountryFilter, setShowCountryFilter] = useState(false); // Collapse state for country filter
  const [showChargePortFilter, setShowChargePortFilter] = useState(false); // Collapse state for charge port filter
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 }); // Mouse position for tooltip
  const [maxRangeUnit, setMaxRangeUnit] = useState('mi'); // 'mi' or 'km'
  const [dbRangeKm, setDbRangeKm] = useState(null); // Track database range for unit conversion
  const [tripDistanceInput, setTripDistanceInput] = useState(String(500));
  const [drivingSpeedInput, setDrivingSpeedInput] = useState(String(70));
  useEffect(() => { setTripDistanceInput(String(tripDistance)); }, [tripDistance]);
  useEffect(() => { setDrivingSpeedInput(String(drivingSpeed)); }, [drivingSpeed]);
  const commitTripDistance = () => {
    const v = tripDistanceInput === '' ? NaN : Number(tripDistanceInput);
    if (!Number.isNaN(v) && v >= 0) setTripDistance(Math.max(1, v));
  };
  const commitDrivingSpeed = () => {
    const v = drivingSpeedInput === '' ? NaN : Number(drivingSpeedInput);
    if (!Number.isNaN(v) && v >= 0) setDrivingSpeed(Math.max(1, Math.min(300, v)));
  };

  // Handle max range unit changes in database mode
  useEffect(() => {
    if (mode === 'database' && dbRangeKm !== null) {
      if (maxRangeUnit === 'mi') {
        setMaxRange(Math.round(dbRangeKm * 0.621371));
      } else {
        setMaxRange(Math.round(dbRangeKm));
      }
    }
  }, [maxRangeUnit, mode, dbRangeKm]);

  // Comparison
  const [comparisonScenarios, setComparisonScenarios] = useState([]);
  const [comparisonViewMode, setComparisonViewMode] = useState('single'); // 'single' or 'roadtrip'

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

  // Add custom vehicle to leaderboard
  const addCustomToLeaderboard = () => {
    if (mode !== 'custom') {
      setLeaderboardFeedback('This feature is only available in Custom mode.');
      setTimeout(() => setLeaderboardFeedback(''), 3000);
      return;
    }
    
    // Create custom vehicle object
    const customVehicle = {
      id: `custom-${Date.now()}`,
      make: selectedMake || customTagLabel,
      model: selectedModel || 'Vehicle',
      variant: selectedVariant ? variants.find(v => String(v.id) === String(selectedVariant))?.name || customTagLabel : customTagLabel,
      battery: batterySize,
      curve: curveData,
      range: maxRangeUnit === 'mi' ? maxRange : maxRange * 0.621371, // Store in miles
      isCustom: true,
      customTag: customTagLabel
    };
    
    setCustomLeaderboardVehicles(prev => [...prev, customVehicle]);
    setLeaderboardFeedback('✓ Added to leaderboard!');
    setTimeout(() => setLeaderboardFeedback(''), 3000);
  };

  // Extract driving speed from scenario name
  const getScenarioSpeed = (scenarioName) => {
    if (!scenarioName) return 70; // Default fallback
    
    const lowerName = scenarioName.toLowerCase();
    
    // Check for WLTP scenarios - use 29 mph
    if (lowerName.includes('wltp')) return 29;
    
    // Check for EPA scenarios - use 48 mph
    if (lowerName.includes('epa')) return 48;
    
    // Try to extract speed from scenario name (e.g., "120kmh/75mph" or "90kmh")
    // Look for mph first
    const mphMatch = scenarioName.match(/(\d+)\s*mph/i);
    if (mphMatch) return parseInt(mphMatch[1]);
    
    // Look for kmh and convert to mph
    const kmhMatch = scenarioName.match(/(\d+)\s*k[mp]h/i);
    if (kmhMatch) return Math.round(parseInt(kmhMatch[1]) * 0.621371);
    
    // Default to 70 mph if no speed found
    return 70;
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
        
        const res = newDb.exec("SELECT DISTINCT make FROM vehicles ORDER BY make COLLATE NOCASE ASC");
        if (res.length > 0) {
          // Trim whitespace and sort again in JavaScript to ensure proper ordering
          const makesList = res[0].values.map(v => v[0].trim()).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
          setMakes(makesList);
        }
        
        // Load all range scenarios for leaderboard dropdown
        const scenariosRes = newDb.exec("SELECT DISTINCT scenario_name FROM range_scenarios ORDER BY scenario_name ASC");
        if (scenariosRes.length > 0 && scenariosRes[0].values.length > 0) {
          const scenariosList = scenariosRes[0].values.map(v => v[0]);
          setLeaderboardRangeScenarios(scenariosList);
          // Set default to 120kph scenario
          const defaultScenario = scenariosList.find(s => s.toLowerCase().includes('120kmh/75mph range in perfect condition'));
          setLeaderboardSelectedScenario(defaultScenario || scenariosList[0] || '');
        }
        
        // Load available countries for leaderboard filtering
        const countriesRes = newDb.exec("SELECT DISTINCT country FROM vehicles WHERE country IS NOT NULL ORDER BY country ASC");
        if (countriesRes.length > 0 && countriesRes[0].values.length > 0) {
          // Map country names to ISO 2-letter codes
          const countryCodeMap = {
            'China': 'CN', 'Germany': 'DE', 'USA': 'US', 'United States': 'US', 'Japan': 'JP',
            'South Korea': 'KR', 'Korea': 'KR', 'France': 'FR', 'UK': 'GB', 'United Kingdom': 'GB',
            'Sweden': 'SE', 'Italy': 'IT', 'Netherlands': 'NL', 'Spain': 'ES', 'Austria': 'AT',
            'Czech Republic': 'CZ', 'Poland': 'PL', 'India': 'IN', 'Australia': 'AU', 'Canada': 'CA',
            'Mexico': 'MX', 'Brazil': 'BR', 'Norway': 'NO', 'Denmark': 'DK', 'Finland': 'FI',
            'Belgium': 'BE', 'Switzerland': 'CH', 'Portugal': 'PT', 'Ireland': 'IE', 'Greece': 'GR',
            'Hungary': 'HU', 'Romania': 'RO', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Croatia': 'HR',
            'Serbia': 'RS', 'Bulgaria': 'BG', 'Turkey': 'TR', 'Israel': 'IL', 'UAE': 'AE',
            'Saudi Arabia': 'SA', 'Thailand': 'TH', 'Vietnam': 'VN', 'Malaysia': 'MY', 'Singapore': 'SG',
            'Indonesia': 'ID', 'Philippines': 'PH', 'New Zealand': 'NZ', 'Argentina': 'AR', 'Chile': 'CL'
          };
          // Create reverse mapping: code -> full name
          const codeToNameMap = {
            'CN': 'China', 'DE': 'Germany', 'US': 'United States', 'JP': 'Japan',
            'KR': 'South Korea', 'FR': 'France', 'GB': 'United Kingdom',
            'SE': 'Sweden', 'IT': 'Italy', 'NL': 'Netherlands', 'ES': 'Spain', 'AT': 'Austria',
            'CZ': 'Czech Republic', 'PL': 'Poland', 'IN': 'India', 'AU': 'Australia', 'CA': 'Canada',
            'MX': 'Mexico', 'BR': 'Brazil', 'NO': 'Norway', 'DK': 'Denmark', 'FI': 'Finland',
            'BE': 'Belgium', 'CH': 'Switzerland', 'PT': 'Portugal', 'IE': 'Ireland', 'GR': 'Greece',
            'HU': 'Hungary', 'RO': 'Romania', 'SK': 'Slovakia', 'SI': 'Slovenia', 'HR': 'Croatia',
            'RS': 'Serbia', 'BG': 'Bulgaria', 'TR': 'Turkey', 'IL': 'Israel', 'AE': 'United Arab Emirates',
            'SA': 'Saudi Arabia', 'TH': 'Thailand', 'VN': 'Vietnam', 'MY': 'Malaysia', 'SG': 'Singapore',
            'ID': 'Indonesia', 'PH': 'Philippines', 'NZ': 'New Zealand', 'AR': 'Argentina', 'CL': 'Chile'
          };
          const countriesList = countriesRes[0].values.map(v => {
            const countryName = v[0];
            const code = countryCodeMap[countryName] || countryName.substring(0, 2).toUpperCase();
            const fullName = codeToNameMap[code] || countryName;
            return { name: countryName, code, fullName };
          });
          setAvailableCountries(countriesList);
          // Initialize includedCountries with all countries by default
          setIncludedCountries(countriesList.map(c => c.name));
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
      const res = db.exec(`SELECT id, variant, variant_url FROM vehicles WHERE make = '${selectedMake}' AND model = '${selectedModel}'`);
      if (res.length > 0) {
        const variantsList = res[0].values.map(v => ({ id: v[0], name: v[1], url: v[2] }));
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
                if (scenarios[defIdx].range_km) {
                    setDbRangeKm(scenarios[defIdx].range_km);
                    setMaxRange(maxRangeUnit === 'mi' ? Math.round(scenarios[defIdx].range_km * 0.621371) : Math.round(scenarios[defIdx].range_km));
                }
                if (loadedBattery > 0) setBatterySize(loadedBattery);
                setCurveData(loadedCurve);
            } else {
                // In custom mode, update battery and range but allow curve editing
                if (scenarios[defIdx].range_km) {
                    setDbRangeKm(scenarios[defIdx].range_km);
                    setMaxRange(maxRangeUnit === 'mi' ? Math.round(scenarios[defIdx].range_km * 0.621371) : Math.round(scenarios[defIdx].range_km));
                }
                if (loadedBattery > 0) setBatterySize(loadedBattery);
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
    let variantName = variantObj?.name || '';
    const scenario = {
      id: Date.now(),
      make: selectedMake,
      model: selectedModel,
      variant: variantName,
      isCustom: mode === 'custom',
      customTag: mode === 'custom' ? customTagLabel : null,
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
      avgSpeedKph: result.avgSpeedKph,
      // Road trip data
      isRoadTrip: tripMode === 'roadtrip',
      tripDistance: tripMode === 'roadtrip' ? tripDistance : null,
      tripDistanceUnit: tripMode === 'roadtrip' ? tripDistanceUnit : null,
      roadTripStops: tripMode === 'roadtrip' ? roadTripResult.numStops : null,
      roadTripStopTime: tripMode === 'roadtrip' ? roadTripResult.totalStopTime : null,
      roadTripLostDistance: tripMode === 'roadtrip' ? roadTripResult.totalStopDistance : null,
      roadTripAvgSpeed: tripMode === 'roadtrip' ? roadTripResult.avgTripSpeed : null,
      roadTripAvgPower: tripMode === 'roadtrip' ? roadTripResult.avgPowerDraw : null,
      roadTripTotalTime: tripMode === 'roadtrip' ? roadTripResult.totalTripTime : null,
      drivingSpeed: tripMode === 'roadtrip' ? (mode === 'custom' ? (drivingSpeedUnit === 'mph' ? drivingSpeed : drivingSpeed * 0.621371) : getScenarioSpeed(rangeScenarios[selectedScenarioIndex]?.scenario_name)) : null
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
    const maxRangeMi = maxRangeUnit === 'mi' ? maxRange : maxRange * 0.621371;
    const rangeAdded = (safeStop - safeStart) / 100 * maxRangeMi;
    const rangeAddedKm = rangeAdded * 1.60934;
    const avgSpeed = kwhAdded / totalHours;
    
    const avgSpeedMph = totalHours > 0 ? rangeAdded / totalHours : 0;
    const avgSpeedKph = totalHours > 0 ? rangeAddedKm / totalHours : 0;

    return { timeMins, kwhAdded, rangeAdded, rangeAddedKm, avgSpeed, avgSpeedMph, avgSpeedKph };
  }, [startSoc, stopSoc, batterySize, maxRange, maxRangeUnit, chargerPower, curveData, dwellTime]);

  // --- Road Trip Calculations ---
  const roadTripResult = useMemo(() => {
    if (tripMode !== 'roadtrip' || result.rangeAdded === 0) {
      return { numStops: 0, totalStopTime: 0, totalStopDistance: 0, avgTripSpeed: 0, avgPowerDraw: 0 };
    }

    const tripDistanceMi = tripDistanceUnit === 'mi' ? tripDistance : tripDistance * 0.621371;
    const startRangeMi = (startSoc / 100) * maxRange;
    const chargeRangeMi = result.rangeAdded;
    
    // Calculate minimum stops needed
    let remainingDistance = tripDistanceMi - startRangeMi;
    let numStops = 0;
    
    if (remainingDistance > 0) {
      numStops = Math.ceil(remainingDistance / chargeRangeMi);
    }
    
    // Total time spent at charging stops (in minutes)
    const totalStopTime = numStops * result.timeMins;
    
    // Determine driving speed based on mode
    let effectiveDrivingSpeed;
    if (mode === 'custom') {
      // Custom mode: use user-defined driving speed, convert to mph if needed
      effectiveDrivingSpeed = drivingSpeedUnit === 'mph' ? drivingSpeed : drivingSpeed * 0.621371;
    } else {
      // Database mode: extract speed from selected scenario
      const selectedScenario = rangeScenarios[selectedScenarioIndex];
      effectiveDrivingSpeed = getScenarioSpeed(selectedScenario?.scenario_name);
    }
    
    // Equivalent distance lost due to stops (mph * hours)
    const totalStopDistance = effectiveDrivingSpeed * (totalStopTime / 60);
    
    // Total trip time including stops (distance / speed + stop time)
    const drivingTime = tripDistanceMi / effectiveDrivingSpeed * 60; // minutes
    const totalTripTime = drivingTime + totalStopTime; // minutes
    
    // Average trip speed including stops
    const avgTripSpeed = totalTripTime > 0 ? tripDistanceMi / (totalTripTime / 60) : 0;
    
    // Average power draw for entire trip
    // Energy used = battery start + all charging stops
    const totalEnergyDelivered = (startSoc / 100 * batterySize) + (numStops * result.kwhAdded);
    const avgPowerDraw = totalTripTime > 0 ? totalEnergyDelivered / (totalTripTime / 60) : 0;
    
    return { 
      numStops, 
      totalStopTime, 
      totalStopDistance, 
      avgTripSpeed, 
      avgPowerDraw,
      drivingTime,
      totalTripTime
    };
  }, [tripMode, tripDistance, tripDistanceUnit, startSoc, maxRange, maxRangeUnit, result, batterySize, mode, drivingSpeed, drivingSpeedUnit, rangeScenarios, selectedScenarioIndex]);

  // --- Leaderboard Calculations ---
  const calculateLeaderboard = () => {
    if (!db || isCalculatingLeaderboard) return;

    setIsCalculatingLeaderboard(true);
    
    // Use setTimeout to allow UI to update with loading state
    setTimeout(() => {
      try {
        console.log('Calculate Leaderboard - Starting');
        console.log('Available countries:', availableCountries.length);
        console.log('Included countries:', includedCountries.length, includedCountries);
        console.log('Selected charge port regions:', selectedChargePortRegions);
        
        // Build country inclusion filter
        let countryFilter = '';
        if (includedCountries.length === 0) {
          // No countries selected - return no results
          console.log('No countries selected - returning empty results');
          setLeaderboardResults([]);
          setIsCalculatingLeaderboard(false);
          return;
        } else if (includedCountries.length < availableCountries.length) {
          // Subset of countries selected - apply filter
          const countriesStr = includedCountries.map(c => `'${c}'`).join(',');
          countryFilter = `AND v.country IN (${countriesStr})`;
          console.log('Country filter applied:', countryFilter);
        } else {
          console.log('All countries selected - no country filter');
        }
        // If all countries are selected, no filter needed (countryFilter stays empty)
        
        // Build charge port region filter
        let chargePortFilter = '';
        if (selectedChargePortRegions.length > 0 && selectedChargePortRegions.length < 5) {
          const conditions = selectedChargePortRegions.map(region => `v.${region} IS NOT NULL`);
          chargePortFilter = `AND (${conditions.join(' OR ')})`;
          console.log('Charge port filter applied:', chargePortFilter);
        } else {
          console.log('All charge port regions selected - no filter');
        }
        
        // Get all vehicles with their basic info - with filtering to improve performance
        // Only get vehicles with battery > 40 kWh and that have charging curves
        const vehiclesRes = db.exec(`
          SELECT DISTINCT v.id, v.make, v.model, v.variant, v.battery_net_kwh, v.country
          FROM vehicles v
          WHERE v.battery_net_kwh > 40
          AND v.id IN (SELECT DISTINCT vehicle_id FROM charging_curve)
          ${countryFilter}
          ${chargePortFilter}
          ORDER BY v.make, v.model
        `);
        
        if (!vehiclesRes.length || !vehiclesRes[0].values.length) {
          setLeaderboardResults([]);
          setIsCalculatingLeaderboard(false);
          return;
        }

        const vehicles = vehiclesRes[0].values.map(row => ({
          id: row[0],
          make: row[1],
          model: row[2],
          variant: row[3],
          battery: row[4],
          country: row[5]
        }));

        console.log('Total vehicles found:', vehicles.length);

        // Batch query for ranges to reduce queries
        const vehicleIds = vehicles.map(v => `'${v.id}'`).join(',');
        const scenarioFilter = leaderboardSelectedScenario ? `AND scenario_name = '${leaderboardSelectedScenario}'` : '';
        const rangesRes = db.exec(`
          SELECT vehicle_id, range_km 
          FROM range_scenarios 
          WHERE vehicle_id IN (${vehicleIds})
          ${scenarioFilter}
        `);
        
        const rangeMap = {};
        if (rangesRes.length && rangesRes[0].values.length) {
          rangesRes[0].values.forEach(row => {
            // Use the first range found for each vehicle
            if (!rangeMap[row[0]]) {
              rangeMap[row[0]] = row[1];
            }
          });
        }

        console.log('Vehicles with range data:', Object.keys(rangeMap).length);
        
        // Log missing vehicles for debugging
        const missingRange = vehicles.filter(v => !rangeMap[v.id]);
        if (missingRange.length > 0) {
          console.log('Vehicles missing range data:', missingRange.map(v => `${v.make} ${v.model} ${v.variant}`).slice(0, 10));
        }

        // Calculate metrics for database vehicles
        const results = vehicles.map(vehicle => {
          // Get charging curve
          const curveRes = db.exec(`
            SELECT soc_percent, power_kw 
            FROM charging_curve 
            WHERE vehicle_id = '${vehicle.id}' 
            ORDER BY soc_percent ASC
          `);

          if (!curveRes.length || !curveRes[0].values.length) return null;

          const curve = curveRes[0].values.map(row => ({
            soc: row[0],
            kw: row[1]
          }));

          // Get range from map or fallback
          let rangeKm = rangeMap[vehicle.id] || 0;
          if (rangeKm === 0) {
            // If no range in map, skip this vehicle
            return null;
          }

          const rangeMi = rangeKm * 0.621371;

          // Interpolate kW at any SOC
          const getKwAtSoc = (s) => {
            const p = curve.find(x => x.soc === s);
            if (p) return p.kw;
            const lower = curve.filter(x => x.soc < s).pop();
            const upper = curve.find(x => x.soc > s);
            if (!lower) return upper ? upper.kw : 0;
            if (!upper) return lower.kw;
            return lower.kw + (upper.kw - lower.kw) * ((s - lower.soc) / (upper.soc - lower.soc));
          };

          // Calculate charging metrics for leaderboard SOC range
          const safeStart = Math.min(leaderboardStartSoc, 99);
          const safeStop = Math.max(safeStart + 1, leaderboardStopSoc);
          
          if (vehicle.battery === 0 || vehicle.battery === null) return null;
          
          const energyPerStep = vehicle.battery * 0.01;
          let totalHours = 0;

          for (let i = safeStart; i < safeStop; i++) {
            const carCapability = getKwAtSoc(i);
            const actualPower = Math.min(carCapability, leaderboardChargerPower);
            const powerSafe = Math.max(1, actualPower);
            totalHours += energyPerStep / powerSafe;
          }

          const timeMins = totalHours * 60;
          const kwhAdded = (safeStop - safeStart) / 100 * vehicle.battery;
          const rangeAdded = (safeStop - safeStart) / 100 * rangeMi;
          const avgPower = totalHours > 0 ? kwhAdded / totalHours : 0;
          const rangePerHour = totalHours > 0 ? rangeAdded / totalHours : 0;

          return {
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            variant: vehicle.variant,
            battery: vehicle.battery,
            country: vehicle.country,
            rangeMi,
            rangeKm,
            timeMins,
            avgPower,
            rangePerHour,
            rangeAdded,
            curve: curve // Store curve data for tooltip
          };
        }).filter(r => r !== null);

        // Add custom vehicles to results
        const customResults = customLeaderboardVehicles.map(vehicle => {
          const curve = vehicle.curve;
          const rangeMi = vehicle.range; // Already in miles
          
          const getKwAtSoc = (s) => {
            const p = curve.find(x => x.soc === s);
            if (p) return p.kw;
            const lower = curve.filter(x => x.soc < s).pop();
            const upper = curve.find(x => x.soc > s);
            if (!lower) return upper ? upper.kw : 0;
            if (!upper) return lower.kw;
            return lower.kw + (upper.kw - lower.kw) * ((s - lower.soc) / (upper.soc - lower.soc));
          };

          const safeStart = Math.min(leaderboardStartSoc, 99);
          const safeStop = Math.max(safeStart + 1, leaderboardStopSoc);
          
          const energyPerStep = vehicle.battery * 0.01;
          let totalHours = 0;

          for (let i = safeStart; i < safeStop; i++) {
            const carCapability = getKwAtSoc(i);
            const actualPower = Math.min(carCapability, leaderboardChargerPower);
            const powerSafe = Math.max(1, actualPower);
            totalHours += energyPerStep / powerSafe;
          }

          const timeMins = totalHours * 60;
          const kwhAdded = (safeStop - safeStart) / 100 * vehicle.battery;
          const rangeAdded = (safeStop - safeStart) / 100 * rangeMi;
          const avgPower = totalHours > 0 ? kwhAdded / totalHours : 0;
          const rangePerHour = totalHours > 0 ? rangeAdded / totalHours : 0;

          return {
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            variant: vehicle.variant,
            battery: vehicle.battery,
            country: vehicle.country || null,
            rangeMi,
            rangeKm: rangeMi * 1.60934,
            timeMins,
            avgPower,
            rangePerHour,
            rangeAdded,
            curve: curve,
            isCustom: true,
            customTag: vehicle.customTag
          };
        });

        const allResults = [...results, ...customResults];

        // Sort based on selected metric
        let sorted = [...allResults];
        if (leaderboardMetric === 'fastest-charging') {
          sorted.sort((a, b) => a.timeMins - b.timeMins);
        } else if (leaderboardMetric === 'highest-avg-power') {
          sorted.sort((a, b) => b.avgPower - a.avgPower);
        } else if (leaderboardMetric === 'best-range-per-hour') {
          sorted.sort((a, b) => b.rangePerHour - a.rangePerHour);
        }

        // Combine vehicles with identical battery and time, even across different makes/models
        const combined = [];
        const perfGroups = [];
        
        sorted.forEach(vehicle => {
          // Round battery and time for comparison
          const roundedTime = Math.round(vehicle.timeMins * 20) / 20; // 0.05 min precision
          const roundedBattery = Math.round(vehicle.battery * 2) / 2; // 0.5 kWh precision
          
          // Find existing group with same battery and time
          const existingGroup = perfGroups.find(g => {
            const gRoundedTime = Math.round(g.timeMins * 20) / 20;
            const gRoundedBattery = Math.round(g.battery * 2) / 2;
            
            // Combine if battery and time match
            return gRoundedBattery === roundedBattery && 
                   gRoundedTime === roundedTime;
          });
          
          if (existingGroup) {
            // Check if this make/model/variant combination already exists
            const existingVehicle = existingGroup.vehicles.find(v => 
              v.make === vehicle.make && v.model === vehicle.model
            );
            
            if (existingVehicle) {
              // Add variant to existing make/model if not already present
              const formattedVariants = existingVehicle.variants.map(v => formatLabel(v));
              const formattedVariant = formatLabel(vehicle.variant);
              if (!formattedVariants.includes(formattedVariant)) {
                existingVehicle.variants.push(vehicle.variant);
              }
            } else {
              // Add new make/model to this performance group
              existingGroup.vehicles.push({
                make: vehicle.make,
                model: vehicle.model,
                country: vehicle.country,
                variants: [vehicle.variant]
              });
            }
          } else {
            // Create new performance group
            perfGroups.push({
              ...vehicle,
              vehicles: [{
                make: vehicle.make,
                model: vehicle.model,
                country: vehicle.country,
                variants: [vehicle.variant]
              }]
            });
          }
        });
        
        // Re-sort the combined results
        if (leaderboardMetric === 'fastest-charging') {
          perfGroups.sort((a, b) => a.timeMins - b.timeMins);
        } else if (leaderboardMetric === 'highest-avg-power') {
          perfGroups.sort((a, b) => b.avgPower - a.avgPower);
        } else if (leaderboardMetric === 'best-range-per-hour') {
          perfGroups.sort((a, b) => b.rangePerHour - a.rangePerHour);
        }

        console.log('Results calculated:', sorted.length, 'Combined to:', perfGroups.length);
        setLeaderboardResults(perfGroups.slice(0, leaderboardVehicleCount));
      } catch (err) {
        console.error('Leaderboard calculation error:', err);
        setLeaderboardResults([]);
      } finally {
        setIsCalculatingLeaderboard(false);
      }
    }, 50);
  };

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

  const formatTripTime = (totalMins) => {
      const h = Math.floor(totalMins / 60);
      const m = Math.floor(totalMins % 60);
      return (
        <span>
          {h}<span className="text-[10px]">h</span> {m}<span className="text-[10px]">m</span>
        </span>
      );
  };

  return (
    <div className={darkMode ? "dark" : ""}>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 font-sans p-4 md:p-6 transition-colors duration-200">
        
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <div className="flex justify-between items-end mb-3">
              <div>
                <h1 className="text-2xl font-bold flex items-center justify-start gap-2">
                  <Zap className="text-blue-600 dark:text-blue-400" fill="currentColor" />
                  A Better DCFC Charging Calculator
                </h1>
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
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage('calculator')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  currentPage === 'calculator' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Zap size={16} />
                Calculator
              </button>
              <button
                onClick={() => setCurrentPage('leaderboards')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  currentPage === 'leaderboards' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <BarChart3 size={16} />
                Leaderboards
              </button>
              <button
                onClick={() => setCurrentPage('info')}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  currentPage === 'info' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <BookOpen size={16} />
                Info
              </button>
            </div>
          </div>

          {/* Calculator Page */}
          {currentPage === 'calculator' && (
          <>
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
                          min={0.1} max={5.0} step={0.05} unit="x" 
                          subtext="Scale the reference charging speed"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}

              <Card className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Battery size={16} className="text-slate-400" />
                    Specs {mode === 'custom' && <Edit3 size={12} className="text-purple-400 ml-1" />}
                  </h3>
                  <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded p-0.5">
                    <button
                      onClick={() => setTripMode('single')}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors font-medium ${tripMode === 'single' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                      Single
                    </button>
                    <button
                      onClick={() => setTripMode('roadtrip')}
                      className={`text-[10px] px-2 py-0.5 rounded transition-colors font-medium ${tripMode === 'roadtrip' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                    >
                      Road Trip
                    </button>
                  </div>
                </div>
                
                {tripMode === 'roadtrip' && (
                  <div className="mb-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-2">
                     <div className="flex items-center gap-1.5 mb-1">
                        <MapPin size={10} className="text-blue-600 dark:text-blue-400" />
                        <label className="text-[9px] font-bold text-blue-700 dark:text-blue-300 uppercase">Trip Distance</label>
                     </div>
                     <div className="flex gap-1 mb-2">
                        <input 
                          type="number"
                          value={tripDistanceInput}
                          onChange={(e) => setTripDistanceInput(e.target.value)}
                          onBlur={commitTripDistance}
                          onKeyDown={(e) => { if (e.key === 'Enter') { commitTripDistance(); e.currentTarget.blur(); } }}
                          className="flex-1 text-xs p-1.5 rounded border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700"
                        />
                        <div className="flex gap-0.5 bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-800 rounded">
                          <button
                            onClick={() => setTripDistanceUnit('mi')}
                            className={`text-[10px] px-2 py-1 transition-colors font-medium ${tripDistanceUnit === 'mi' ? 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                          >
                            mi
                          </button>
                          <button
                            onClick={() => setTripDistanceUnit('km')}
                            className={`text-[10px] px-2 py-1 transition-colors font-medium ${tripDistanceUnit === 'km' ? 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                          >
                            km
                          </button>
                        </div>
                     </div>
                     {mode === 'custom' && (
                       <div>
                         <label className="text-[9px] font-bold text-blue-700 dark:text-blue-300 uppercase mb-1 block">Driving Speed</label>
                         <div className="flex gap-1">
                           <input 
                             type="number"
                             value={drivingSpeedInput}
                             onChange={(e) => setDrivingSpeedInput(e.target.value)}
                             onBlur={commitDrivingSpeed}
                             onKeyDown={(e) => { if (e.key === 'Enter') { commitDrivingSpeed(); e.currentTarget.blur(); } }}
                             className="flex-1 text-xs p-1.5 rounded border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-700"
                           />
                           <div className="flex gap-0.5 bg-white dark:bg-slate-700 border border-blue-200 dark:border-blue-800 rounded">
                             <button
                               onClick={() => setDrivingSpeedUnit('mph')}
                               className={`text-[10px] px-2 py-1 transition-colors font-medium ${drivingSpeedUnit === 'mph' ? 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                             >
                               mph
                             </button>
                             <button
                               onClick={() => setDrivingSpeedUnit('kph')}
                               className={`text-[10px] px-2 py-1 transition-colors font-medium ${drivingSpeedUnit === 'kph' ? 'bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                             >
                               kph
                             </button>
                           </div>
                         </div>
                       </div>
                     )}
                  </div>
                )}
                
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

                <div className="flex gap-3 mb-3">
                  <div className={`flex flex-col ${mode === 'database' ? 'opacity-60 pointer-events-none' : ''}`} style={{width: '45%'}}>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Battery Size</label>
                    <div className="flex gap-1">
                      <NumberInput 
                        label="" 
                        value={batterySize} 
                        onChange={setBatterySize} 
                        unit="" 
                        disabled={mode === 'database'} 
                      />
                      <span className="flex items-center text-[9px] text-slate-500 dark:text-slate-400 font-medium ml-1">
                        kWh
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col" style={{width: '55%'}}>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Max Range</label>
                    <div className="flex gap-1">
                      <NumberInput 
                        label="" 
                        value={maxRange} 
                        onChange={setMaxRange} 
                        unit="" 
                        disabled={mode === 'database'} 
                      />
                      <div className="flex gap-0.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded">
                        <button
                          onClick={() => setMaxRangeUnit('mi')}
                          className={`text-[9px] px-1.5 py-0.5 transition-colors font-medium ${maxRangeUnit === 'mi' ? 'bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                          mi
                        </button>
                        <button
                          onClick={() => setMaxRangeUnit('km')}
                          className={`text-[9px] px-1.5 py-0.5 transition-colors font-medium ${maxRangeUnit === 'km' ? 'bg-slate-100 dark:bg-slate-600 text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                          km
                        </button>
                      </div>
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
                  
                  {mode === 'custom' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                        Custom Tag
                      </label>
                      <input
                        type="text"
                        value={customTagLabel}
                        onChange={(e) => setCustomTagLabel(e.target.value)}
                        placeholder="Custom"
                        className="w-full text-xs p-2 mb-2 rounded border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-700 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <button
                        onClick={addCustomToLeaderboard}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-md font-medium transition-colors shadow-sm text-sm"
                      >
                        <BarChart3 size={14} />
                        Add to Leaderboard
                      </button>
                      {leaderboardFeedback && (
                        <p className="text-xs text-center mt-2 text-green-600 dark:text-green-400 font-medium">
                          {leaderboardFeedback}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </Card>
              
              {/* Credits */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-4">
                <span>Made by Qiyuan Zhou</span>
                <a 
                  href="https://www.linkedin.com/in/keonjoe/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                >
                  <Linkedin size={16} />
                </a>
                <a 
                  href="https://github.com/keonjoe" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>

              {/* Add to Comparison Button */}
              <div className="flex gap-2 mt-4 justify-center">
                <button
                  onClick={addToComparison}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Database size={16} />
                  Add to Comparison
                </button>
                
                {selectedMake && selectedModel && selectedVariant && (() => {
                  const variantObj = variants.find(v => String(v.id) === String(selectedVariant));
                  return variantObj?.url && (
                    <a
                      href={variantObj.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 dark:bg-slate-500 dark:hover:bg-slate-600 text-white rounded-lg font-medium transition-colors shadow-sm"
                    >
                      <BookOpen size={16} />
                      Vehicle Info
                    </a>
                  );
                })()}
              </div>
            </div>

            <div className="lg:col-span-8 space-y-6">
              <Card className="p-6 bg-white dark:bg-slate-800">
                <div className="flex justify-between items-center mb-2">
                  <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Charging Session</h2>
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-slate-400 opacity-50"></div><span className="text-slate-500 dark:text-slate-400">Vehicle Limit</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div><span className="text-slate-800 dark:text-slate-200 font-medium">Actual Speed</span></div>
                  </div>
                </div>
                {mode === 'custom' && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                    ⓘ Charging curve can be customized by dragging points on the graph
                  </p>
                )}

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

              <div className="mb-0.5">
                <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Single Charging Session</h3>
              </div>
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
                        <span className="font-bold text-slate-700 dark:text-slate-200">{result.avgSpeed.toFixed(1)} kW</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400">Range</span>
                        <span className="font-mono text-slate-600 dark:text-slate-300">{result.avgSpeedMph.toFixed(1)} mph</span>
                     </div>
                     <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400"></span>
                        <span className="font-mono text-slate-400 dark:text-slate-500">{result.avgSpeedKph.toFixed(1)} kph</span>
                     </div>
                  </div>
                </Card>
              </div>

              {/* Road Trip Results */}
              {tripMode === 'roadtrip' && (
                <>
                  <div className="mt-6 mb-0.5">
                    <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wide">Road Trip Estimates</h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card className="p-4 border-l-4 border-l-amber-500">
                      <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-amber-100 text-amber-600 rounded-lg"><Clock size={20} /></div><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Total Trip Time</span></div>
                      <div className="space-y-1">
                        <div className="flex items-baseline gap-1"><span className="text-2xl font-bold text-slate-800 dark:text-slate-100">{formatTripTime(roadTripResult.totalTripTime)}</span></div>
                        <div className="flex items-baseline gap-1 mt-1"><span className="text-slate-500 dark:text-slate-400 text-xs">Avg: </span><span className="text-slate-600 dark:text-slate-300 text-sm font-semibold">{roadTripResult.avgTripSpeed.toFixed(1)}</span><span className="text-[10px] text-slate-500 dark:text-slate-400"> mph</span></div>
                      </div>
                    </Card>
                  
                    <Card className="p-4 border-l-4 border-l-red-500">
                      <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-red-100 text-red-600 rounded-lg"><MapPin size={20} /></div><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Stopping Cost</span></div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs border-b border-slate-100 dark:border-slate-700 pb-1 mb-1">
                          <span className="text-slate-500 dark:text-slate-400">Stops</span>
                          <span className="font-bold text-slate-700 dark:text-slate-200">{roadTripResult.numStops}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Lost Dist</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300">{roadTripResult.totalStopDistance.toFixed(0)} mi</span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 dark:text-slate-400"></span>
                          <span className="font-mono text-slate-400 dark:text-slate-500">{(roadTripResult.totalStopDistance * 1.60934).toFixed(0)} km</span>
                        </div>
                      </div>
                    </Card>
                    
                    <Card className="p-4 border-l-4 border-l-indigo-500">
                      <div className="flex items-center gap-3 mb-2"><div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg"><Zap size={20} /></div><span className="text-slate-500 dark:text-slate-400 text-sm font-medium">Avg Trip Power</span></div>
                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-slate-500 dark:text-slate-400">Avg Power</span>
                          <span className="font-mono text-slate-600 dark:text-slate-300">{roadTripResult.avgPowerDraw.toFixed(1)} kW</span>
                        </div>
                      </div>
                    </Card>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Comparison Table */}
          {comparisonScenarios.length > 0 && (
            <div className="mt-8">
              <Card className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Comparison Table</h2>
                    {comparisonScenarios.some(s => s.isRoadTrip) && (
                      <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded p-0.5">
                        <button
                          onClick={() => setComparisonViewMode('single')}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors font-medium ${comparisonViewMode === 'single' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                          Single
                        </button>
                        <button
                          onClick={() => setComparisonViewMode('roadtrip')}
                          className={`text-[10px] px-2 py-0.5 rounded transition-colors font-medium ${comparisonViewMode === 'roadtrip' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                        >
                          Road Trip
                        </button>
                      </div>
                    )}
                  </div>
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
                        {comparisonViewMode === 'single' ? (
                          <>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Time</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Range Added</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Avg Speed</th>
                          </>
                        ) : (
                          <>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Trip Dist</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Total Time</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Stops</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Driving Speed</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Avg Speed</th>
                          </>
                        )}
                        <th className="py-2 px-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {comparisonScenarios.map((scenario) => (
                        <tr key={scenario.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <div>
                                <div className="font-medium text-slate-800 dark:text-slate-100">
                                  {formatLabel(scenario.make)} {formatLabel(scenario.model)}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">{formatLabel(scenario.variant)}</div>
                              </div>
                              {scenario.isCustom && (
                                <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-purple-500 text-white rounded">
                                  {scenario.customTag || 'Custom'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.batterySize}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> kWh</span></td>
                          <td className="py-3 px-2">
                            <div><span className="text-slate-700 dark:text-slate-200">{scenario.maxRange}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mi</span></div>
                            <div><span className="text-slate-400 dark:text-slate-500 text-xs">{(scenario.maxRange * 1.60934).toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> km</span></div>
                          </td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.startSoc}</span><span className="text-[10px] text-slate-700 dark:text-slate-200">%</span><span className="text-slate-700 dark:text-slate-200"> → </span><span className="text-slate-700 dark:text-slate-200">{scenario.stopSoc}</span><span className="text-[10px] text-slate-700 dark:text-slate-200">%</span></td>
                          <td className="py-3 px-2"><span className="text-slate-700 dark:text-slate-200">{scenario.chargerPower}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> kW</span></td>
                          {comparisonViewMode === 'single' ? (
                            <>
                              <td className="py-3 px-2 font-mono text-slate-700 dark:text-slate-200">{formatTime(scenario.timeMins)}</td>
                              <td className="py-3 px-2">
                                <div><span className="text-slate-700 dark:text-slate-200">{scenario.rangeAdded.toFixed(0)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mi</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400 text-xs">{scenario.rangeAddedKm.toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> km</span></div>
                              </td>
                              <td className="py-3 px-2">
                                <div><span className="text-slate-700 dark:text-slate-200">{scenario.avgSpeed.toFixed(1)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> kW</span></div>
                                <div><span className="text-slate-500 dark:text-slate-400 text-xs">{scenario.avgSpeedMph.toFixed(1)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> mph</span><span className="text-slate-500 dark:text-slate-400 text-xs"> / </span><span className="text-slate-500 dark:text-slate-400 text-xs">{scenario.avgSpeedKph.toFixed(1)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> kph</span></div>
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="py-3 px-2">
                                {scenario.isRoadTrip ? (
                                  <div>
                                    <div><span className="text-slate-700 dark:text-slate-200">{scenario.tripDistance}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> {scenario.tripDistanceUnit}</span></div>
                                    <div><span className="text-slate-400 dark:text-slate-500 text-xs">{scenario.tripDistanceUnit === 'mi' ? (scenario.tripDistance * 1.60934).toFixed(0) : (scenario.tripDistance / 1.60934).toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> {scenario.tripDistanceUnit === 'mi' ? 'km' : 'mi'}</span></div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                {scenario.isRoadTrip ? (
                                  <span className="font-mono text-slate-700 dark:text-slate-200">{formatTripTime(scenario.roadTripTotalTime)}</span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                {scenario.isRoadTrip ? (
                                  <span className="text-slate-700 dark:text-slate-200">{scenario.roadTripStops}</span>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                {scenario.isRoadTrip ? (
                                  <div>
                                    <div><span className="text-slate-700 dark:text-slate-200">{scenario.drivingSpeed.toFixed(1)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mph</span></div>
                                    <div><span className="text-slate-400 dark:text-slate-500 text-xs">{(scenario.drivingSpeed * 1.60934).toFixed(1)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> kph</span></div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">N/A</span>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                {scenario.isRoadTrip ? (
                                  <div>
                                    <div><span className="text-slate-700 dark:text-slate-200">{scenario.roadTripAvgSpeed.toFixed(1)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mph</span></div>
                                    <div><span className="text-slate-400 dark:text-slate-500 text-xs">{(scenario.roadTripAvgSpeed * 1.60934).toFixed(1)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> kph</span></div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 dark:text-slate-500 text-xs">N/A</span>
                                )}
                              </td>
                            </>
                          )}
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
          </>
          )}

          {/* Leaderboards Page */}
          {currentPage === 'leaderboards' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 space-y-3">
                <Card className="p-4">
                  {/* Metric Selection Dropdown */}
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      Select Metric
                    </label>
                    <div className="relative">
                      <select 
                        value={leaderboardMetric}
                        onChange={(e) => {
                          setLeaderboardMetric(e.target.value);
                          setLeaderboardResults([]);
                        }}
                        className="w-full text-xs p-2 pr-6 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white dark:bg-slate-700 cursor-pointer"
                      >
                        <option value="fastest-charging">⚡ Fastest Charging Time</option>
                        <option value="highest-avg-power">🔋 Highest Average Power</option>
                        <option value="best-range-per-hour">🏁 Best Range Per Hour</option>
                      </select>
                      <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Range Scenario Selector */}
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      Range Scenario
                    </label>
                    <div className="relative">
                      <select 
                        value={leaderboardSelectedScenario}
                        onChange={(e) => {
                          setLeaderboardSelectedScenario(e.target.value);
                          setLeaderboardResults([]);
                        }}
                        className="w-full text-xs p-2 pr-6 rounded border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white dark:bg-slate-700 cursor-pointer"
                      >
                        {leaderboardRangeScenarios.map((scenario, idx) => (
                          <option key={idx} value={scenario}>
                            {formatLabel(scenario)}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* SOC Range Controls */}
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      SOC Range
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <div className="relative h-12 select-none">
                        <div className="absolute top-1/2 left-0 right-0 h-2 bg-slate-200 dark:bg-slate-700 rounded-full -translate-y-1/2"></div>
                        <div 
                          className="absolute top-1/2 h-2 bg-blue-500 rounded-full -translate-y-1/2"
                          style={{ left: `${leaderboardStartSoc}%`, right: `${100 - leaderboardStopSoc}%` }}
                        ></div>
                        <input 
                          type="range" 
                          min="0" max="99" 
                          value={leaderboardStartSoc} 
                          onChange={(e) => { const val = Number(e.target.value); setLeaderboardStartSoc(Math.min(val, leaderboardStopSoc - 1)); setLeaderboardResults([]); }} 
                          className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-2 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-emerald-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab z-20"
                        />
                        <input 
                          type="range" 
                          min="1" max="100" 
                          value={leaderboardStopSoc} 
                          onChange={(e) => { const val = Number(e.target.value); setLeaderboardStopSoc(Math.max(val, leaderboardStartSoc + 1)); setLeaderboardResults([]); }} 
                          className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-2 bg-transparent appearance-none pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-4 [&::-webkit-slider-thumb]:border-amber-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab z-30"
                        />
                        <div 
                          className="absolute top-8 transform -translate-x-1/2 font-mono font-bold text-emerald-600 dark:text-emerald-400 text-base transition-all"
                          style={{ left: `${leaderboardStartSoc}%` }}
                        >
                          {leaderboardStartSoc}%
                        </div>
                        <div 
                          className="absolute top-8 transform -translate-x-1/2 font-mono font-bold text-amber-500 dark:text-amber-400 text-base transition-all"
                          style={{ left: `${leaderboardStopSoc}%` }}
                        >
                          {leaderboardStopSoc}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Charger Power Input */}
                  <div className="mb-3">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      Charger Maximum Power
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <div className="relative">
                        <input 
                          type="range" 
                          min="50" max="800" step="10"
                          value={leaderboardChargerPower} 
                          onChange={(e) => { setLeaderboardChargerPower(Number(e.target.value)); setLeaderboardResults([]); }}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">50 kW</span>
                          <span className="text-base font-bold text-slate-700 dark:text-slate-200">{leaderboardChargerPower} kW</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">800 kW</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Count Slider */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                      Number of Vehicles
                    </label>
                    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                      <div className="relative">
                        <input 
                          type="range" 
                          min="5" max="50" step="1"
                          value={leaderboardVehicleCount} 
                          onChange={(e) => { setLeaderboardVehicleCount(Number(e.target.value)); setLeaderboardResults([]); }}
                          className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-600 [&::-webkit-slider-thumb]:cursor-pointer"
                        />
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-slate-500 dark:text-slate-400">5</span>
                          <span className="text-base font-bold text-slate-700 dark:text-slate-200">{leaderboardVehicleCount}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">50</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Country Inclusion Filter - Collapsible */}
                  <div className="mb-3">
                    <button
                      onClick={() => setShowCountryFilter(!showCountryFilter)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      <span>Include vehicle makes from:</span>
                      <ChevronDown size={14} className={`transition-transform ${showCountryFilter ? 'rotate-180' : ''}`} />
                    </button>
                    {showCountryFilter && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 max-h-60 overflow-y-auto">
                        <div className="grid grid-cols-3 gap-1">
                          {availableCountries.map((country, idx) => {
                            const flagEmoji = country.code ? String.fromCodePoint(...[...country.code.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))) : '';
                            return (
                              <label key={idx} className="flex items-center gap-1 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded">
                                <input
                                  type="checkbox"
                                  checked={includedCountries.includes(country.name)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setIncludedCountries([...includedCountries, country.name]);
                                    } else {
                                      setIncludedCountries(includedCountries.filter(c => c !== country.name));
                                    }
                                    setLeaderboardResults([]);
                                  }}
                                  className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span 
                                  className="text-sm relative group" 
                                  title={country.fullName}
                                  onMouseMove={(e) => setMousePosition({ x: e.clientX, y: e.clientY })}
                                >
                                  {flagEmoji}
                                  <span 
                                    className="invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity delay-100 duration-200 fixed px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-xl border border-slate-600 dark:border-slate-500"
                                    style={{
                                      zIndex: 99999,
                                      left: `${mousePosition.x}px`,
                                      top: `${mousePosition.y - 40}px`,
                                      transform: 'translateX(-50%)'
                                    }}
                                  >
                                    {country.fullName}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Charge Port Region Filter - Collapsible */}
                  <div className="mb-3">
                    <button
                      onClick={() => setShowChargePortFilter(!showChargePortFilter)}
                      className="w-full flex items-center justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                    >
                      <span>Supported charging regions:</span>
                      <ChevronDown size={14} className={`transition-transform ${showChargePortFilter ? 'rotate-180' : ''}`} />
                    </button>
                    {showChargePortFilter && (
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-2 space-y-1">
                        {[
                          { value: 'chargeport_type_na', label: 'North America' },
                          { value: 'chargeport_type_china', label: 'China' },
                          { value: 'chargeport_type_eu', label: 'Europe' },
                          { value: 'chargeport_type_japan', label: 'Japan' },
                          { value: 'chargeport_type_oceania', label: 'Oceania' }
                        ].map((region) => (
                          <label key={region.value} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 p-1 rounded">
                            <input
                              type="checkbox"
                              checked={selectedChargePortRegions.includes(region.value)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedChargePortRegions([...selectedChargePortRegions, region.value]);
                                } else {
                                  setSelectedChargePortRegions(selectedChargePortRegions.filter(r => r !== region.value));
                                }
                                setLeaderboardResults([]);
                              }}
                              className="w-3 h-3 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <span className="text-xs text-slate-700 dark:text-slate-200">{region.label}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Calculate Button */}
                  <button
                    onClick={calculateLeaderboard}
                    disabled={!db || isCalculatingLeaderboard}
                    className="w-full mt-4 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
                  >
                    {isCalculatingLeaderboard ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      <>
                        <BarChart3 size={16} />
                        Calculate Leaderboard
                      </>
                    )}
                  </button>
                </Card>
                
                {/* Credits */}
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-4">
                  <span>Made by Qiyuan Zhou</span>
                  <a 
                    href="https://www.linkedin.com/in/keonjoe/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Linkedin size={16} />
                  </a>
                  <a 
                    href="https://github.com/keonjoe" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                  </a>
                </div>

                {/* Custom Vehicles Management - Separate Card */}
                {customLeaderboardVehicles.length > 0 && (
                  <Card className="p-4">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
                      Custom Vehicles ({customLeaderboardVehicles.length})
                    </label>
                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {customLeaderboardVehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                                {formatLabel(vehicle.make)} {formatLabel(vehicle.model)}
                              </span>
                              <span className="px-1 py-0.5 text-[8px] font-bold uppercase bg-purple-500 text-white rounded">
                                {vehicle.customTag}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {vehicle.battery.toFixed(1)} kWh • {vehicle.range.toFixed(0)} mi
                            </div>
                          </div>
                          <button
                            onClick={() => setCustomLeaderboardVehicles(prev => prev.filter(v => v.id !== vehicle.id))}
                            className="ml-2 p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                            title="Remove from leaderboard"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </div>

              <div className="lg:col-span-8 space-y-6">
                {/* Results Table Section */}
                <Card className="p-6 bg-white dark:bg-slate-800">
                  <h3 className="text-lg font-semibold mb-4 text-slate-700 dark:text-slate-300">
                    {leaderboardMetric === 'fastest-charging' && '⚡ Fastest Charging Times'}
                    {leaderboardMetric === 'highest-avg-power' && '🔋 Highest Average Power'}
                    {leaderboardMetric === 'best-range-per-hour' && '🏁 Best Range Per Hour'}
                  </h3>
                  
                  {isCalculatingLeaderboard ? (
                    <div className="flex flex-col items-center text-center py-8">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                      <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Calculating leaderboard...</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">This may take a few seconds</p>
                    </div>
                  ) : leaderboardResults.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
                        Click "Calculate Leaderboard" to see results
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        Results are calculated based on your selected criteria
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="text-center py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 w-16">Rank</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 w-2/5">Vehicle</th>
                            <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300 w-32">Battery</th>
                            {leaderboardMetric === 'fastest-charging' && (
                              <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Time</th>
                            )}
                            {leaderboardMetric === 'highest-avg-power' && (
                              <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Avg Power</th>
                            )}
                            {leaderboardMetric === 'best-range-per-hour' && (
                              <>
                                <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Range/Hour</th>
                                <th className="text-left py-2 px-2 font-semibold text-slate-700 dark:text-slate-300">Time</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboardResults.map((vehicle, index) => (
                            <tr key={vehicle.id} className="border-b border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">
                              <td className="py-3 px-2 font-bold text-slate-600 dark:text-slate-400 text-center">
                                {index + 1}
                              </td>
                              <td className="py-3 px-2 relative">
                                <div
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredCurve({ vehicle, index })}
                                  onMouseLeave={() => setHoveredCurve(null)}
                                >
                                  {vehicle.vehicles.map((v, vIdx) => {
                                    const countryCode = v.country;
                                    const flagEmoji = countryCode ? String.fromCodePoint(...[...countryCode.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0))) : '';
                                    const evkxUrl = `https://evkx.net/models/${v.make.replace(/\s+/g, '_')}/${v.model.replace(/\s+/g, '_')}`;
                                    return (
                                    <div key={vIdx} className={vIdx > 0 ? 'mt-2 pt-2 border-t border-slate-200 dark:border-slate-700' : ''}>
                                      <div className="flex items-center gap-2">
                                        <a 
                                          href={evkxUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-medium text-slate-800 dark:text-slate-100 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                        >
                                          {flagEmoji && <span className="mr-1">{flagEmoji}</span>}
                                          {formatLabel(v.make)} {formatLabel(v.model)}
                                        </a>
                                        {vehicle.isCustom && (
                                          <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase bg-purple-500 text-white rounded">
                                            {vehicle.customTag || 'Custom'}
                                          </span>
                                        )}
                                      </div>
                                      {v.variants && v.variants.length === 1 ? (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">{formatLabel(v.variants[0])}</div>
                                      ) : (
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          {v.variants.map((variant, i) => (
                                            <span key={i}>
                                              {i > 0 && ', '}
                                              {formatLabel(variant)}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    );
                                  })}
                                </div>
                                {hoveredCurve?.index === index && (
                                  <div className="absolute left-full ml-2 top-0 z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-2xl p-3 w-64">
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                      {leaderboardStartSoc}% → {leaderboardStopSoc}% @ {leaderboardChargerPower}kW
                                    </div>
                                    <CompactCurvePreview 
                                      curveData={vehicle.curve}
                                      startSoc={leaderboardStartSoc}
                                      stopSoc={leaderboardStopSoc}
                                      chargerMaxPower={leaderboardChargerPower}
                                      darkMode={darkMode}
                                    />
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-2">
                                <div className="text-slate-700 dark:text-slate-200">{vehicle.battery.toFixed(1)} kWh</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500">{vehicle.rangeMi.toFixed(0)} mi • {vehicle.rangeKm.toFixed(0)} km</div>
                              </td>
                              {leaderboardMetric === 'fastest-charging' && (
                                <td className="py-3 px-2 font-mono text-slate-700 dark:text-slate-200">
                                  {formatTime(vehicle.timeMins)}
                                </td>
                              )}
                              {leaderboardMetric === 'highest-avg-power' && (
                                <td className="py-3 px-2 font-bold text-slate-700 dark:text-slate-200">
                                  {vehicle.avgPower.toFixed(1)} kW
                                </td>
                              )}
                              {leaderboardMetric === 'best-range-per-hour' && (
                                <>
                                  <td className="py-3 px-2">
                                    <div><span className="font-bold text-slate-700 dark:text-slate-200">{vehicle.rangePerHour.toFixed(0)}</span><span className="text-[10px] text-slate-700 dark:text-slate-200"> mi/h</span></div>
                                    <div><span className="text-slate-500 dark:text-slate-400 text-xs">{(vehicle.rangePerHour * 1.60934).toFixed(0)}</span><span className="text-[10px] text-slate-400 dark:text-slate-500"> km/h</span></div>
                                  </td>
                                  <td className="py-3 px-2 font-mono text-slate-700 dark:text-slate-200">
                                    {formatTime(vehicle.timeMins)}
                                  </td>
                                </>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            </div>
          )}

          {/* Info Page */}
          {currentPage === 'info' && (
            <div className="space-y-6">
              <Card className="p-6">
                <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                  <BookOpen className="text-blue-600 dark:text-blue-400" />
                  Info
                </h2>
                
                <div className="space-y-4 text-slate-600 dark:text-slate-400">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">What is this?</h3>
                    <p>
                      A Better DCFC Charging Calculator helps you better visualize and understand EV DC charging performance. 
                      Using vehicle specific charging curves, you can calculate charging times, range added, 
                      and plan road trips with multiple charging stops. It also includes a leaderboards feature to compare
                      different EVs in different scenarios based on various charging metrics.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Features</h3>
                    <div className="flex gap-1 mb-3">
                      <button
                        onClick={() => setInfoFeatureView('calculator')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                          infoFeatureView === 'calculator'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}
                      >
                        Calculator
                      </button>
                      <button
                        onClick={() => setInfoFeatureView('leaderboard')}
                        className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                          infoFeatureView === 'leaderboard'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-600'
                        }`}
                      >
                        Leaderboards
                      </button>
                    </div>
                    {infoFeatureView === 'calculator' ? (
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Charging performance metrics calculated using vehicle make, model, and variant specific charging curves</li>
                        <li>Custom mode with editable battery capacity, range, and charging curves</li>
                        <li>Simple road trip planning with estimated charging stops</li>
                        <li>Comparison table to evaluate different vehicles and scenarios</li>
                      </ul>
                    ) : (
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>Compare top performing EVs across different charging metrics</li>
                        <li>Filter by fastest charging time, highest average power, or best range per hour</li>
                        <li>Select different range scenarios to see performance in various driving conditions</li>
                        <li>Adjust SOC range and charger power limits for custom comparisons</li>
                        <li>Hover over vehicle names to preview their charging curves</li>
                        <li>Vehicles with identical performance are automatically combined in a single row</li>
                      </ul>
                    )}
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Data Source</h3>
                    <p>
                      All vehicle and charging data is sourced from <a href="https://evkx.net" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">EVKX.net</a>, 
                      a comprehensive database of electric vehicle specifications and charging performance.
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Contact</h3>
                    <p>
                      Questions? Feedback? Please feel free to message me directly on  <a href="https://www.linkedin.com/in/keonjoe" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 inline-flex">
                        <Linkedin size={14} />
                      </a>
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm text-slate-500 dark:text-slate-500">
                      Note: This tool provides estimates based on ideal conditions. Actual charging performance 
                      may vary based on temperature, battery health, and charger capabilities.
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}
      </div>
    </div>
  </div>
  );
}