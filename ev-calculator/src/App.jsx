import { useState, createContext, useEffect } from 'react'
import EVChargingCalculator from './EVChargingCalculator'
import LifetimeCostCalculator from './LifetimeCostCalculator'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { Calculator, DollarSign, Sun, Moon } from 'lucide-react'

// Create a context for global dark mode
export const DarkModeContext = createContext()

function App() {
  const [darkMode, setDarkMode] = useState(true) // Default to dark mode
  const [currentApp, setCurrentApp] = useState('charging') // 'charging' or 'lifetime'
  const [showTooltip, setShowTooltip] = useState(false)
  const [navbarVisible, setNavbarVisible] = useState(true)
  const [lastScrollY, setLastScrollY] = useState(0)

  // Clear all persisted data when user exits the site
  useEffect(() => {
    const handleBeforeUnload = () => {
      localStorage.clear();
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  // Handle navbar hide/show on scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY < 10) {
        // Always show at the very top
        setNavbarVisible(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down & past threshold
        setNavbarVisible(false);
      } else if (currentScrollY < lastScrollY) {
        // Scrolling up
        setNavbarVisible(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <DarkModeContext.Provider value={{ darkMode, setDarkMode }}>
      <div className={`${darkMode ? "dark" : ""} overflow-x-hidden`}>
        {/* Navigation Bar */}
        <div className={`bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky z-50 shadow-sm transition-all duration-300 ${
          navbarVisible ? 'top-0' : '-top-20'
        }`}>
          <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
            <div className="flex items-center justify-center space-x-1 sm:space-x-2 py-2 sm:py-3 overflow-x-auto">
              <button
                onClick={() => setCurrentApp('charging')}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                  currentApp === 'charging'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <Calculator size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">EV Charging Calculator</span>
                <span className="sm:hidden">Charging</span>
              </button>
              <button
                onClick={() => setCurrentApp('lifetime')}
                className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-4 py-2 rounded-lg font-medium transition-all text-sm whitespace-nowrap ${
                  currentApp === 'lifetime'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                <DollarSign size={16} className="sm:w-[18px] sm:h-[18px]" />
                <span className="hidden sm:inline">Lifetime Cost Calculator</span>
                <span className="sm:hidden">Lifetime</span>
              </button>
              
              {/* Global Dark Mode Toggle */}
              <div className="relative ml-1 sm:ml-4">
                <button 
                  onClick={() => setDarkMode(!darkMode)}
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                  className="p-2 rounded-full bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                  aria-label="Toggle Dark Mode"
                >
                  {darkMode ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
                </button>
                {showTooltip && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded whitespace-nowrap pointer-events-none z-50 shadow-lg">
                    {darkMode ? "Prepare to be blinded!" : "Join the dark side!"}
                  </div>
                )}
              </div>
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