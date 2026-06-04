const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`

const today = () => new Date().toISOString().split('T')[0]

const SYSTEM_PROMPT = `You are a smart parser for a personal finance and calendar app used in Malaysia (currency RM).
Parse user input and return ONLY valid JSON, no markdown, no explanation.

Today's date: ${today()}
Day of week: ${new Date().toLocaleDateString('en-MY', { weekday: 'long' })}

Return this exact JSON structure:
{
  "type": "expense" | "event" | "both" | "unknown",
  "expense": {
    "description": "concise label max 4 words",
    "amount": number or null,
    "category": "food" | "transport" | "grocery" | "rental" | "subscription" | "sports" | "shopping",
    "date": "YYYY-MM-DD"
  } or null,
  "event": {
    "title": "concise event title",
    "date": "YYYY-MM-DD",
    "time": "HH:MM" or null,
    "endTime": "HH:MM" or null,
    "notes": "brief notes" or null,
    "recurring": "daily" | "weekly" | "monthly" | null
  } or null
}

Category rules:
- food: meals, drinks, restaurants, cafes, food delivery
- transport: grab, taxi, petrol, parking, toll, LRT, MRT, bus
- grocery: supermarket, pasar, Giant, Jaya Grocer, Cold Storage, 99 Speedmart
- rental: rent, rental, sewa
- subscription: netflix, spotify, tradingview, apple, youtube, any app subscription
- sports: gym, run, swimming, badminton, futsal, yoga, any sport
- shopping: clothes, shoes, electronics, online shopping

Time inference: "morning" = 09:00, "lunch" = 12:30, "afternoon" = 14:00, "evening" = 18:00, "night" = 20:00
Date inference: infer from relative terms like "tomorrow", "next Friday", "this weekend" based on today's date.`

export async function parseInput(text) {
  if (!GEMINI_API_KEY) throw new Error('No API key configured')

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\nUser input: ' + text }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    })
  })

  if (!res.ok) throw new Error(`Gemini error: ${res.status}`)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
