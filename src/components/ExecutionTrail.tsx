'use client'

import { useState, useEffect } from 'react'

type Props = {
  steps: string[]
}

export default function ExecutionTrail({ steps }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (steps.length > 0) {
      setVisible(true)
    }
  }, [steps])

  return (
    <div className="w-full bg-[#1f1f1f] border-t border-gray-700 px-4 py-3 text-xs text-gray-300 transition-all">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold">🧩 Execution Trail</span>
          <button
            onClick={() => setVisible(!visible)}
            className="text-gray-400 hover:text-white text-xs"
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>

        {visible && steps.length > 0 && (
          <ul className="mt-2 space-y-1 max-h-[200px] overflow-auto pr-1">
            {steps.map((step, idx) => (
              <li key={idx} className="text-gray-400">
                {idx + 1}. {step}
              </li>
            ))}
          </ul>
        )}

        {visible && steps.length === 0 && (
          <div className="text-gray-500 italic">No execution steps recorded yet.</div>
        )}
      </div>
    </div>
  )
}
