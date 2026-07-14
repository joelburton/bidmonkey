import { useState } from 'react'
import { problems } from './data/problems'
import { ProblemList } from './components/ProblemList'
import { BridgeTable } from './components/BridgeTable'

export default function App() {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const selected = problems.find((p) => p.id === selectedId)

  return (
    <div className={`app ${selected ? 'detail' : 'list'}`}>
      <header className="app-header">
        {selected ? (
          <button className="back" onClick={() => setSelectedId(null)}>
            ‹ Problems
          </button>
        ) : (
          <span className="brand">🐵 bidmonkey</span>
        )}
      </header>

      <main className={`app-main ${selected ? 'detail' : 'list'}`}>
        {selected ? (
          <BridgeTable problem={selected} />
        ) : (
          <ProblemList problems={problems} onSelect={setSelectedId} />
        )}
      </main>
    </div>
  )
}
