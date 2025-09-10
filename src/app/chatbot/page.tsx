'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { v4 as uuid } from 'uuid'
import MemberContextViewer from '@/components/MemberContextViewer'
import ReactMarkdown from 'react-markdown'

// Available background videos under /public/video
const VIDEO_SOURCES = [
  '/video/AdobeStock_281413858.mov',
  '/video/AdobeStock_281567012.mov',
  '/video/AdobeStock_281821924.mov',
]

const MCP_BACKEND_SERVER = process.env.NEXT_PUBLIC_MCP_BACKEND_SERVER || "http://localhost:8000";

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

  // Choose background video deterministically on SSR, then randomize after mount to avoid hydration mismatch
  const [bgVideo, setBgVideo] = useState<string>(VIDEO_SOURCES[0])
  useEffect(() => {
    setBgVideo(VIDEO_SOURCES[Math.floor(Math.random() * VIDEO_SOURCES.length)])
  }, [])

  // JWT token validation helper
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return payload.exp * 1000 < Date.now()
    } catch {
      return true
    }
  }

  // On mount, fetch JWT if not present or expired
  useEffect(() => {
    const fetchJwt = async () => {
      const storedJwt = localStorage.getItem('jwtToken')
      if (storedJwt && !isTokenExpired(storedJwt)) {
        setJwt(storedJwt)
        return
      }
      
      // Clear expired token
      if (storedJwt) {
        localStorage.removeItem('jwtToken')
      }

      try {
        console.log('Attempting to authenticate with MCP server at:', MCP_BACKEND_SERVER)
        
        const res = await fetch(`${MCP_BACKEND_SERVER}/auth/login`, {
          method: 'POST',
          mode: 'cors',
          headers: { 
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username: 'chatbot', password: 'chatbot' })
        })
        
        console.log('Authentication response status:', res.status)
        console.log('Authentication response headers:', Object.fromEntries(res.headers.entries()))
        
        if (!res.ok) {
          const errorData = await res.json()
          throw new Error(errorData.detail || `Authentication failed: ${res.status}`)
        }
        
        const data = await res.json()
        console.log('Authentication response data:', data)
        
        if (!data.access_token) {
          throw new Error('No access token received')
        }
        
        setJwt(data.access_token)
        localStorage.setItem('jwtToken', data.access_token)
        setJwtError(null)
        console.log('JWT authentication successful')
      } catch (err: unknown) {
        console.error('Full authentication error:', err)
        console.error('Error type:', typeof err)
        console.error('Error constructor:', err?.constructor?.name)
        
        let message = 'Authentication failed'
        if (err instanceof TypeError && err.message.includes('fetch')) {
          message = `Network error: Cannot connect to MCP server at ${MCP_BACKEND_SERVER}. Please check if the server is running.`
        } else if (err instanceof Error) {
          message = err.message
        }
        
        console.error('JWT Authentication Error:', message)
        setJwtError(message)
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
      setJwtError('Unable to authenticate with backend. Please refresh the page.')
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
      // Check if token is expired before making request
      if (isTokenExpired(jwt)) {
        throw new Error('Session expired. Please refresh the page.')
      }

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

      if (!res.ok) {
        // Handle specific HTTP status codes
        if (res.status === 401) {
          localStorage.removeItem('jwtToken')
          throw new Error('Authentication expired. Please refresh the page.')
        } else if (res.status === 403) {
          throw new Error('Access denied. Insufficient permissions.')
        } else {
          throw new Error(body.detail || `Request failed: ${res.status}`)
        }
      }

      if (body.response?.error) {
        throw new Error(body.response.error)
      }

      const agentReply = body.response?.summary || body.summary || JSON.stringify(body.response || body)
      const steps = body.response?.steps || body.steps || []

      if (body.response?.context || body.context) {
        setRawContext(body.response?.context || body.context)
      }

      await simulateTyping(agentReply, steps)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Something went wrong'
      console.error('API Request Error:', message)
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: 'agent', text: `❌ ${message}` },
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
      <div className="relative min-h-screen text-white">
        <video
          key={bgVideo}
          className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
          src={bgVideo}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
        <div className="relative z-10 min-h-screen flex items-center justify-center bg-black/30">
          <h2 className="text-2xl mb-4">Connecting to backend…</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="relative min-h-screen text-white">
      {/* Fullscreen background video */}
      <video
        key={bgVideo}
        className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none"
        src={bgVideo}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />

      {/* Overlay container */}
      <div className="relative z-10 flex flex-col min-h-screen bg-black/30">
      {/* Header */}
      <header className="w-full border-b border-[#262626] bg-[#0b0b0b]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto w-full px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Image src="/images/mc_logo.png" alt="Mastercard" width={28} height={28} />
            <div className="leading-tight">
              <div className="text-[13px] font-medium">SessionM Product</div>
              <div className="text-[11px] text-[#a3a3a3] tracking-wide">AGENTIC LOYALTY EXPLORATIONS</div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline text-[11px] uppercase text-[#a3a3a3]">Use case:</span>
            <select
              id="mode"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'classification' | 'reasoning' | 'freeform')}
              className="bg-[#171717] text-[#ededed] border border-[#262626] rounded-full px-3 py-1 text-sm focus:outline-none"
            >
              <option value="classification">Classification</option>
              <option value="reasoning">Reasoning</option>
              <option value="freeform">Freeform</option>
            </select>
          </div>
        </div>
      </header>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-4 py-8 scrollbar-hide pb-44">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

            return (
              <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`px-4 py-3 rounded-2xl whitespace-pre-wrap text-sm max-w-[80%] border shadow-sm ${
                    isUser
                      ? 'bg-[#1f1f1f] border-[#262626] ml-auto'
                      : 'bg-[#171717] border-[#262626] mr-auto'
                  }`}
                >
                  {msg.isTyping ? <TypingDots /> : <ReactMarkdown>{msg.text}</ReactMarkdown>}
                  <div className="text-xs text-[#a3a3a3] mt-1 text-right">{timestamp}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer input */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[#262626] bg-[#0b0b0b]/80 backdrop-blur-md z-40">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSubmit()
            }}
          >
            <div className="flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-[#171717] text-[#ededed] placeholder-[#7a7a7a] border border-[#262626] rounded-full px-5 py-3 focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                aria-label="Send"
                className="ml-2 h-10 w-10 rounded-full flex items-center justify-center bg-[var(--mc-orange)] text-black font-semibold shadow hover:brightness-110 disabled:opacity-60"
              >
                ➤
              </button>
            </div>
            <div className="mt-2 text-center text-[11px] text-[#a3a3a3]">
              Experimental. Don’t share any sensitive data. | a sessionm product | © {new Date().getFullYear()} All Rights Reserved
              <button type="button" onClick={resetChat} className="ml-3 underline hover:no-underline">Reset</button>
            </div>
          </form>
        </div>
      </footer>

      <div className="fixed bottom-24 right-4 z-50">
        <MemberContextViewer context={rawContext} />
      </div>
    </div>
  </div>
  )
}