import EVChargingCalculator from './EVChargingCalculator'
import { Analytics } from '@vercel/analytics/react'

function App() {
  return (
    <>
      <EVChargingCalculator />
      <Analytics />
    </>
  )
}

export default App