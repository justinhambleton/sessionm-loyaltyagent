'use client'

import { useEffect, useState } from 'react'
import { v4 as uuid } from 'uuid'
import MemberContextViewer from '@/components/MemberContextViewer'
import ReactMarkdown from 'react-markdown'

const MCP_BACKEND_SERVER = process.env.MCP_BACKEND_SERVER || "http://localhost:8000";

type Message = {
  role: 'user' | 'agent'
  text: string
  isTyping?: boolean
  steps?: string[]
}

type MemberContextType = {
  offers?: unknown[]
  campaigns?: unknown[]
  point_accounts?: unknown[]
  recent_activity?: unknown[]
  timeline?: unknown[]
  [key: string]: unknown
}

export default function ChatbotPage() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string>('')
  const [rawContext, setRawContext] = useState<MemberContextType | null>(null)
  const [mode, setMode] = useState<'classification' | 'reasoning' | 'freeform'>('freeform')
  const [jwt, setJwt] = useState<string | null>(null)
  const [jwtError, setJwtError] = useState<string | null>(null)

  // On mount, fetch JWT if not present
  useEffect(() => {
    const fetchJwt = async () => {
      const storedJwt = localStorage.getItem('jwtToken')
      if (storedJwt) {
        setJwt(storedJwt)
        return
      }
      try {
        const res = await fetch(`${MCP_BACKEND_SERVER}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'chatbot', password: 'chatbot' })
        })
        const data = await res.json()
        if (!res.ok || !data.access_token) throw new Error(data.detail || 'JWT fetch failed')
        setJwt(data.access_token)
        localStorage.setItem('jwtToken', data.access_token)
      } catch (err: any) {
        setJwtError(err.message)
      }
    }
    fetchJwt()
  }, [])

  const TypingDots = () => (
    <span className="inline-block animate-pulse text-gray-400">Agent is typing...</span>
  )

  const simulateTyping = async (fullText: string, steps: string[] = []) => {
    let displayed = ''
    for (let i = 0; i < fullText.length; i++) {
      displayed += fullText[i]
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { ...prev[prev.length - 1], text: displayed, isTyping: true }
      ])
      await new Promise((res) => setTimeout(res, 15))
    }

    setMessages((prev) => [
      ...prev.slice(0, -1),
      { ...prev[prev.length - 1], text: fullText, isTyping: false, steps }
    ])
  }

  useEffect(() => {
    const storedSessionId = localStorage.getItem('sessionId') || uuid()
    const storedMessages = JSON.parse(localStorage.getItem('chatMessages') || '[]')

    setSessionId(storedSessionId)

    if (storedMessages.length === 0) {
      const intro: Message = {
        role: 'agent',
        text: "Hi there! To get started, can you tell me your email or phone number so I can look up your loyalty profile?"
      }
      setMessages([intro])
      localStorage.setItem('chatMessages', JSON.stringify([intro]))
    } else {
      setMessages(storedMessages)
    }

    localStorage.setItem('sessionId', storedSessionId)
  }, [])

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages))
  }, [messages])

  const handleSubmit = async () => {
    if (!jwt) {
      setJwtError('Unable to authenticate with backend. Please contact support.')
      return
    }
    if (!input.trim()) return

    const userInput = input.trim()
    setInput('')
    setMessages((prev) => [
      ...prev,
      { role: 'user', text: userInput },
      { role: 'agent', text: '', isTyping: true }
    ])
    setLoading(true)

    try {
      const isIdentifier = /@|\d{6,}/.test(userInput)

      let endpoint = `${MCP_BACKEND_SERVER}/context/agent`

      if (mode === 'reasoning' && !isIdentifier) {
        endpoint = `${MCP_BACKEND_SERVER}/context/reason`
      } else if (mode === 'freeform') {
        endpoint = `${MCP_BACKEND_SERVER}/context/freeform`
      }

      const res = await fetch(`${endpoint}?prompt=${encodeURIComponent(userInput)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          'Session-Id': sessionId,
        },
      })

      const body = await res.json()

      if (!res.ok || body.response?.error) {
        throw new Error(body.response?.error || body.detail || 'Something went wrong')
      }

      const agentReply = body.response.summary || JSON.stringify(body.response)
      const steps = body.response.steps || []

      if (body.response.context) {
        setRawContext(body.response.context)
      }

      await simulateTyping(agentReply, steps)
      } catch (e) {
        const err = e as Error
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'agent', text: err.message || 'Something went wrong' },
        ])
      } finally {
      setLoading(false)
    }
  }

  const resetChat = () => {
    localStorage.removeItem('chatMessages')
    localStorage.removeItem('sessionId')
    setMessages([])
    setRawContext(null)
    setSessionId(uuid())
  }

  if (jwtError) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#202123] text-white">
        <h2 className="text-2xl mb-4">Unable to authenticate with backend</h2>
        <div className="text-red-400 mb-2">{jwtError}</div>
        <p>Please contact support.</p>
      </div>
    )
  }
  if (!jwt) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#202123] text-white">
        <h2 className="text-2xl mb-4">Connecting to backend…</h2>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-[#202123] text-white relative">
      <header className="px-4 py-3 border-b border-gray-700 flex justify-between items-center max-w-7xl mx-auto w-full">
        <h1 className="text-lg font-semibold">🧠 SessionM Loyalty Assistant</h1>
        <div className="flex items-center text-sm text-gray-400">
          <label htmlFor="mode" className="mr-2">Agent Mode:</label>
          <select
            id="mode"
            value={mode}
            onChange={(e) => setMode(e.target.value as 'classification' | 'reasoning' | 'freeform')}
            className="bg-gray-800 text-white border border-gray-600 rounded px-2 py-1"
          >
            <option value="classification">🧠 Classification</option>
            <option value="reasoning">🤔 Reasoning</option>
            <option value="freeform">💡 Freeform</option>
          </select>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={i} className={`flex items-start space-x-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                {!isUser && (
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-lg">
                    🤖
                  </div>
                )}

                <div
                  className={`px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm max-w-[80%] ${
                    isUser ? 'bg-[#1e40af] text-white ml-auto' : 'bg-[#3f3f46] text-white mr-auto'
                  }`}
                >
                  {msg.isTyping ? <TypingDots /> : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                  <div className="text-xs text-gray-400 mt-1 text-right">{timestamp}</div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center text-lg">
                    👤
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          handleSubmit()
        }}
        className="w-full max-w-2xl mx-auto px-4 py-3 border-t border-gray-700 bg-[#202123] z-10 mb-28"
      >
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask me anything..."
            className="flex-1 bg-[#40414f] text-white border-none rounded px-4 py-2 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
          >
            {loading ? '...' : 'Send'}
          </button>
          <button
            type="button"
            onClick={resetChat}
            className="bg-gray-600 hover:bg-gray-500 text-white px-3 py-2 rounded"
          >
            Reset
          </button>
        </div>
      </form>

      <div className="fixed bottom-2 right-4 z-50">
        <MemberContextViewer context={rawContext} />
      </div>
    </div>
  )
}