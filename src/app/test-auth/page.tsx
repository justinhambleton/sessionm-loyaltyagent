'use client'

import { useState } from 'react'

export default function TestAuthPage() {
  const [result, setResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  const testAuth = async () => {
    setLoading(true)
    setResult('Testing...')
    
    try {
      console.log('Testing authentication...')
      const response = await fetch('http://127.0.0.1:8000/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username: 'chatbot', password: 'chatbot' })
      })
      
      console.log('Response status:', response.status)
      console.log('Response headers:', Object.fromEntries(response.headers.entries()))
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      console.log('Response data:', data)
      
      setResult(`Success! Token: ${data.access_token?.substring(0, 50)}...`)
    } catch (error) {
      console.error('Test error:', error)
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Authentication Test</h1>
      <button 
        onClick={testAuth}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Authentication'}
      </button>
      <div className="mt-4 p-4 bg-gray-100 rounded">
        <pre className="whitespace-pre-wrap">{result}</pre>
      </div>
    </div>
  )
}
