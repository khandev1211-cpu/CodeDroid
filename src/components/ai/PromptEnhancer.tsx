import { useState } from 'react'
import { Sparkles, Undo2, Loader2 } from 'lucide-react'
import { useStore } from '../../stores/appStore'

interface Props {
  input: string
  setInput: (s: string) => void
}

export default function PromptEnhancer({ input, setInput }: Props) {
  const [showUndo, setShowUndo] = useState(false)
  const [original, setOriginal] = useState('')
  const { settings, enhancerLoading, setEnhancerLoading, setAiError } = useStore()

  const systemInstruction = 
    "You are an expert prompt engineer. Rewrite the user's rough prompt to be " +
    "clear, detailed, and optimized for AI while preserving the original intent. " +
    "Return ONLY the enhanced prompt text."

  const enhance = async () => {
    if (!input.trim() || enhancerLoading) return

    const startTime = Date.now()
    setEnhancerLoading(true)
    setOriginal(input)
    if (setAiError) setAiError(null)

    const provider = settings.activeProvider
    const key = provider === 'groq' ? settings.groqKey : provider === 'gemini' ? settings.geminiKey : provider === 'claude' ? settings.claudeKey : ''
    const model = provider === 'groq' ? settings.groqModel : provider === 'gemini' ? settings.geminiModel : provider === 'claude' ? settings.claudeModel : settings.ollamaModel

    const runDirectEnhance = async (): Promise<string> => {
      if (!key && provider !== 'ollama') {
        throw new Error(`API key for ${provider.toUpperCase()} is missing. Please configure it in Settings.`)
      }

      if (provider === 'groq') {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: input }
            ]
          })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message || 'Groq API error')
        return data.choices?.[0]?.message?.content || ''
      } else if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: `${systemInstruction}\n\nPrompt to enhance:\n${input}` }] }
            ]
          })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message || 'Gemini API error')
        return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else if (provider === 'claude') {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            max_tokens: 1024,
            system: systemInstruction,
            messages: [{ role: 'user', content: input }]
          })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error.message || 'Claude API error')
        return data.content?.[0]?.text || ''
      } else if (provider === 'ollama') {
        const res = await fetch(`${settings.ollamaHost}/api/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            stream: false,
            messages: [
              { role: 'system', content: systemInstruction },
              { role: 'user', content: input }
            ]
          })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error || 'Ollama API error')
        return data.message?.content || ''
      }
      throw new Error('Unsupported AI provider')
    }

    try {
      console.log(`[PromptEnhancer] Requesting enhancement via sidecar...`)
      let enhancedText = ''

      try {
        const res = await fetch('http://127.0.0.1:8765/enhance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: input }],
            provider, api_key: key, model, host: settings.ollamaHost
          })
        })
        const data = await res.json()
        if (data.enhanced) {
          enhancedText = data.enhanced.trim()
        } else if (data.error) {
          console.warn("[PromptEnhancer] Sidecar failed with error, falling back to direct API:", data.error)
          enhancedText = await runDirectEnhance()
        } else {
          enhancedText = await runDirectEnhance()
        }
      } catch (e) {
        console.warn("[PromptEnhancer] Sidecar down, falling back to direct API:", e)
        enhancedText = await runDirectEnhance()
      }

      if (enhancedText) {
        setInput(enhancedText.trim())
        setShowUndo(true)
        setTimeout(() => setShowUndo(false), 8000)
      }
    } catch (e: any) {
      console.error("Enhancement Failed:", e)
      if (setAiError) {
        setAiError(`Enhancement failed: ${e.message || e}`)
      } else {
        alert(`Enhancement failed: ${e.message || e}`)
      }
    } finally {
      // Enforce a minimum visual delay of 600ms so loader effects are smooth
      const elapsed = Date.now() - startTime
      if (elapsed < 600) {
        await new Promise(resolve => setTimeout(resolve, 600 - elapsed))
      }
      setEnhancerLoading(false)
    }
  }

  const undo = () => {
    setInput(original)
    setShowUndo(false)
  }

  return (
    <div className="prompt-enhancer">
      {showUndo ? (
        <button className="enhance-btn undo" onClick={undo} title="Restore original text">
          <Undo2 size={14} />
          <span>Undo</span>
        </button>
      ) : (
        <button className="enhance-btn" onClick={enhance} disabled={!input.trim() || enhancerLoading}>
          {enhancerLoading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
          <span>{enhancerLoading ? 'Polishing...' : 'Enhance'}</span>
        </button>
      )}
    </div>
  )
}

