import Wheel from './Wheel.jsx'
import './App.css'

const DEFAULT_ITEMS = ['Option A', 'Option B', 'Option C', 'Option D']

export default function App() {
  return (
    <div className="app">
      <h1>Spinner</h1>
      <div className="wheels-row">
        <Wheel storageKey="spinner.wheelA" defaultItems={DEFAULT_ITEMS} />
        <Wheel storageKey="spinner.wheelB" defaultItems={DEFAULT_ITEMS} />
      </div>
    </div>
  )
}
