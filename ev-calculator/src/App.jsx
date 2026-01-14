import { useState, createContext } from 'react'
import EVChargingCalculator from './EVChargingCalculator'
import LifetimeCostCalculator from './LifetimeCostCalculator'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Calculator, DollarSign } from 'lucide-react'

// Create a context for global dark mode
export const DarkModeContext = createContext()

function App() {
  const [darkMode, setDarkMode] = useState(true) // Default to dark mode
  const [currentApp, setCurrentApp] = useState('charging') // 'charging' or 'lifetime'

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className={darkMode ? "dark" : ""}>
        {/* Navigation Bar */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-center space-x-2 py-3">
              <button
                onClick={() => setCurrentApp('charging')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  currentApp === 'charging'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <Calculator size={18} />
                <span>EV Charging Calculator</span>
              </button>
              <button
                onClick={() => setCurrentApp('lifetime')}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  currentApp === 'lifetime'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <DollarSign size={18} />
                <span>Lifetime Cost Calculator</span>
              </button>
            </div>
          </div>
        </div>

        {/* Render the selected app */}
        {currentApp === 'charging' ? <EVChargingCalculator /> : <LifetimeCostCalculator />}
        
        <Analytics />
        <SpeedInsights />
      </div>
    </DarkModeContext.Provider>
  )
}

export default App