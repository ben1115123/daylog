# DayLog

Smart calendar & spending tracker. Type anything — it figures out the rest.

## Setup

```bash
npm install
cp .env.example .env.local
# Add your Gemini API key to .env.local
npm run dev
```

## Deploy to Vercel (free)

1. Push this folder to a GitHub repo
2. Go to vercel.com → New Project → Import your repo
3. Add environment variable: `VITE_GEMINI_API_KEY` = your key
4. Deploy — done

## Add to iPhone home screen

1. Open the deployed URL in Safari
2. Tap Share → Add to Home Screen
3. Done — works like a native app

## Features

- Natural language input parsed by Gemini 1.5 Flash (free tier)
- 7 expense categories with per-category budget limits
- Monthly spending overview with progress bars
- Calendar with event management
- Export events as .ics for Apple Calendar
- Quick preset buttons (Rental, TradingView, Gym, Grab, Groceries)
- Export data as JSON backup
