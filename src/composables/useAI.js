import { computed } from 'vue'

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const STORAGE_KEY = 'kelo_gemini_key'

function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || ''
}

export function useAI() {
  const isAvailable = computed(() => !!getApiKey())

  async function generateSummary(task) {
    const apiKey = getApiKey()
    if (!apiKey) throw new Error('Gemini API key not set')

    const parts = [task.text]
    if (task.blocks?.length) {
      task.blocks.forEach(b => {
        if (b.type === 'text') parts.push(`- ${b.text}`)
        else parts.push(`- [${b.type}: ${b.name}]`)
      })
    }
    if (task.tags?.length) parts.push(`Tags: ${task.tags.join(', ')}`)
    if (task.dueDate) parts.push(`Due: ${task.dueDate}`)

    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: 'Summarize what this is about in one short sentence (max 10 words). Respond in the same language as the input. No quotes. No markdown. No prefix.' }]
        },
        contents: [{
          parts: [{ text: parts.join('\n') }]
        }],
        generationConfig: {
          maxOutputTokens: 400,
          temperature: 0.3,
        }
      })
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini API error: ${res.status} ${err}`)
    }

    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || ''
  }

  return { isAvailable, generateSummary }
}
