'use client'

import { useState, useEffect } from 'react'

type MemberContextType = {
  offers?: unknown[]
  campaigns?: unknown[]
  point_accounts?: unknown[]
  recent_activity?: unknown[]
  timeline?: unknown[]
  [key: string]: unknown
}

type Props = {
  context: MemberContextType | null
}

export default function MemberContextViewer({ context }: Props) {
  const [open, setOpen] = useState(false)
  const [ttl, setTtl] = useState<number>(0)

  useEffect(() => {
    const start = Date.now()
    const expirationMs = 15 * 60 * 1000
    const interval = setInterval(() => {
      const remaining = expirationMs - (Date.now() - start)
      setTtl(Math.max(remaining, 0))
    }, 1000)

    return () => clearInterval(interval)
  }, [context])

  const formatTTL = (ms: number) => {
    const min = Math.floor(ms / 60000)
    const sec = Math.floor((ms % 60000) / 1000)
    return `${min}m ${sec}s`
  }

  const getSizeKB = (data: MemberContextType) => {
    const str = JSON.stringify(data)
    return (new TextEncoder().encode(str).length / 1024).toFixed(1)
  }

  const sizeKB = context ? getSizeKB(context) : '0.0'
  const sizeNum = parseFloat(sizeKB)

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setOpen(!open)}
        className="bg-[#2d2f38] border border-gray-500 text-gray-300 text-sm px-3 py-1.5 rounded hover:text-white transition"
      >
        {open ? 'Hide MemberContext' : 'View MemberContext'}
      </button>

      {open && context && (
        <div className="mt-2 w-[400px] max-h-[500px] overflow-auto bg-[#1f1f1f] border border-gray-600 shadow-xl rounded p-4 text-xs text-gray-200 scrollbar-hide">
          <div className="mb-2">
            <strong>Offers:</strong> {context.offers?.length || 0} &nbsp;|&nbsp;
            <strong>Campaigns:</strong> {context.campaigns?.length || 0} &nbsp;|&nbsp;
            <strong>Point Accounts:</strong> {context.point_accounts?.length || 0} &nbsp;|&nbsp;
            <strong>Audit Logs:</strong> {context.recent_activity?.length || 0} &nbsp;|&nbsp;
            <strong>Timeline Events:</strong> {context.timeline?.length || 0}
          </div>

          <div className={`mb-2 ${sizeNum > 50 ? 'text-red-400 font-semibold' : 'text-gray-400'}`}>
            Context size: {sizeKB} KB
            {sizeNum > 50 && <span className="ml-2 text-red-500">⚠️ Large</span>}
          </div>

          <div className="mb-2 text-gray-400">
            ⏳ Expires in: {formatTTL(ttl)}
          </div>

          <pre className="whitespace-pre-wrap">{JSON.stringify(context, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
