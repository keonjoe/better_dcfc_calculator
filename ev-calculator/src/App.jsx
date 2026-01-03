import EVChargingCalculator from './EVChargingCalculator'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'

function App() {
  return (
    <>
      <EVChargingCalculator />
      <Analytics />
      <SpeedInsights />
    </>
  )
}

export default App