# MZ07 — AI-Powered Reading Assistant

A dyslexia-friendly mobile app that simplifies complex documents, reads them aloud, and highlights each word as it's spoken.

## Team

| Role | Member | Folder |
|------|--------|--------|
| Mobile App | Waleed | `/waleed` |
| NLP Engine | Alisa | `/alisa` |
| TTS Engine | Jonathan | `/jonathan` |

## How It Works

```
User uploads document
        |
        v
[waleed] extracts text (TXT, image via OCR)
        |
        v
[alisa] simplifies text paragraph-by-paragraph (BART model)
        |
        v
[jonathan] synthesizes audio, returns segments + timestamps
        |
        v
[waleed] plays audio + karaoke word highlighting
```

## Tech Stack

### waleed (Mobile App)
- Expo SDK 54 + React Native 0.81
- TypeScript, NativeWind v4 (Tailwind CSS)
- React Navigation (native stack + bottom tabs)
- Supabase (email/password auth, session persistence)
- expo-av (audio playback)
- expo-document-picker, expo-image-picker

### alisa (NLP Backend)
- FastAPI + uvicorn
- BART model: `elvisbakunzi/dyslexia-friendly-text-simplifier`
- pytesseract (image OCR)
- Deployed: `http://184.146.191.73:8001`

### jonathan (TTS Backend)
- FastAPI + uvicorn
- Custom TTS engine
- Deployed: `http://184.146.191.73:8000`

## Running Locally

### waleed (frontend)
```bash
cd waleed/
npm install
npm start          # Opens Expo dev server
# Press w for web browser
```

For real backend integration, copy `.env.example` to `.env` and fill in the URLs and API key.
For web, also run the TTS CORS proxy:
```bash
node tts-proxy.js  # Forwards :8002 → 184.146.191.73:8000
```

### alisa (NLP)
```bash
cd alisa/
pip install -r requirements.txt
uvicorn api:app --host 0.0.0.0 --port 8001
# Docs at http://localhost:8001/docs
```

### jonathan (TTS)
```bash
cd jonathan/tts/
pip install -r requirements-base.txt   # or requirements-gpu.txt on GPU machine
uvicorn main.main:app --host 0.0.0.0 --port 8000
```

## Project Structure

```
MZ07/
├── waleed/          # React Native / Expo frontend
│   ├── src/
│   │   ├── components/   # AudioPlayer, HighlightedText
│   │   ├── context/      # AuthContext, SettingsContext
│   │   ├── navigation/   # AppNavigator (stack + tabs)
│   │   ├── screens/      # Landing, Login, Signup, Home, Reading, Settings
│   │   └── services/     # config, NLP, TTS, OCR, history
│   ├── App.tsx
│   └── ROADMAP.md
├── alisa/           # FastAPI NLP service
│   ├── api.py       # /api/simplify, /api/ocr
│   └── simplify.py  # BART simplification (chunked)
└── jonathan/        # FastAPI TTS service
    └── tts/
        └── main/
            ├── main.py
            └── tts_engine.py
```

## Course
COE70B — Winter 2026
