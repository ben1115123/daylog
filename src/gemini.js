const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`

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
    "category": "food" | "transport" | "grocery" | "rental" | "subscription" | "sports" | "shopping" | "coffee" | "dining" | "petrol" | "toll" | "online_shopping" | "health" | "entertainment" | "travel" | "utilities" | "education",
    "date": "YYYY-MM-DD"
  } or null,
  "event": {
    "title": "concise event title",
    "date": "YYYY-MM-DD",
    "time": "HH:MM" or null,
    "endTime": "HH:MM" or null,
    "notes": "brief notes" or null,
    "recurring": "daily" | "weekly" | "monthly" | null,
    "category": "work" | "personal" | "health" | "social" | "finance" | null
  } or null
}

Expense category rules:
- food: meals, nasi, rice, bread, snacks, hawker stall, food court (simple takeaway food)
- coffee: kopi, latte, cappuccino, americano, cafe, teh tarik, milo, drinks, beverage, starbucks, zus, gong cha
- dining: restaurant, mamak sit-down, dinner out, lunch out, makan besar, fine dining, hawker restaurant
- transport: grab, taxi, mycar, petrol in general, parking, LRT, MRT, bus, commuter, ride-hail
- petrol: petrol, fuel, shell, petronas, caltex, ron95, ron97, pump, refuel
- toll: toll, plus, smart tag, touch n go highway charge
- grocery: supermarket, pasar, Giant, Jaya Grocer, Cold Storage, 99 Speedmart, tesco, mydin, village grocer
- rental: rent, rental, sewa, deposit
- subscription: netflix, spotify, tradingview, apple one, youtube premium, discord, adobe, any recurring app subscription
- sports: gym, run, swimming, badminton, futsal, yoga, fitness, muay thai, any sport/exercise
- shopping: clothes, shoes, fashion, electronics, ikea, h&m, uniqlo, harvey norman, physical retail
- online_shopping: shopee, lazada, amazon, zalora, airpaz, online order, delivery parcel, grab mart, foodpanda
- health: pharmacy, guardian, watsons, clinic, doctor, dentist, medicine, panadol, ubat, supplement, hospital
- entertainment: cinema, movie, concert, gsc, tgv, mbo, ticket, karaoke, escape room, bowling, show
- travel: flight, hotel, airbnb, airasia, malindo, batik air, grab airport, vacation, holiday, resort, check-in
- utilities: TNB, electricity bill, water bill, indah water, unifi, maxis, celcom, digi, yes 5g, phone bill, internet bill
- education: course, tuition, book, udemy, coursera, class, workshop, exam fee, university, school fee

Event category rules:
- work: meetings, deadlines, work tasks, office events, client calls
- personal: haircut, errands, admin, personal appointments, chores
- health: doctor, dentist, gym session, medical, checkup, therapy
- social: birthday, dinner out, friends, gatherings, parties, celebrations
- finance: bank, investment, bill payment, tax, financial appointments

Recurring rules:
- "every day" / "daily" → "daily"
- "every week" / "weekly" / "every Monday" → "weekly"
- "every month" / "monthly" / "1st of every month" → "monthly"

Time inference: "morning" = 09:00, "lunch" = 12:30, "afternoon" = 14:00, "evening" = 18:00, "night" = 20:00
Date inference: infer from relative terms like "tomorrow", "next Friday", "this weekend" based on today's date.`

export async function parseInput(text) {
  console.log('KEY CHECK:', import.meta.env.VITE_GEMINI_API_KEY?.slice(0, 8))
  console.log('URL:', GEMINI_URL.replace(/key=.*/, 'key=***'))
  if (!GEMINI_API_KEY) throw new Error('No API key configured')

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM_PROMPT + '\n\nUser input: ' + text }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 }
    })
  })

  console.log('Gemini HTTP status:', res.status)
  if (!res.ok) {
    const errBody = await res.text().catch(() => '')
    console.error('Gemini error body:', errBody)
    throw new Error(`Gemini error: ${res.status}`)
  }
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  const clean = raw.replace(/```json|```/g, '').trim()
  return JSON.parse(clean)
}
