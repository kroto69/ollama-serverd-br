# Ollama Server Bridging

A lightweight proxy that accepts Ollama/OpenAI‑compatible requests and forwards them to a single upstream provider configured via `.env`.

## Features

- Ollama endpoints: `/api/tags`, `/api/chat`, `/api/generate`, `/api/embeddings`
- OpenAI endpoints: `/v1/chat/completions`, `/v1/completions`, `/v1/models`, `/v1/embeddings`
- Simple env: one `URL_HOST` and one `API_KEY`
- Optional `DEFAULT_MODEL` to force all requests to use a specific model
- Model list exposed to clients is editable in `src/config/models.json`

## Installation

```bash
npm install
npm install dotenv
```

## Configuration

1. Copy `.env.example` to `.env`
2. Set values:
   - `URL_HOST`: e.g. `https://openrouter.ai/api/v1` (OpenAI‑style) or `https://generativelanguage.googleapis.com/v1beta` (Gemini)
   - `API_KEY`: API key for the chosen host
   - `DEFAULT_MODEL`: optional; when set, all requests use this model
3. Edit `src/config/models.json` to control models shown by `/api/tags` and `/v1/models`

## Run

```bash
npm start
# or
npm run dev
```

Server runs at `http://localhost:3000` (or `NODE_PORT`).

## Example

- Chat (OpenAI‑style): `POST /v1/chat/completions` with body:
  ```json
  {
    "model": "meta-llama/llama-3.1-8b-instruct",
    "messages": [{"role":"user","content":"Hello"}],
    "stream": false
  }
  ```
  If `.env` sets `DEFAULT_MODEL=qwen2.5-30b`, it will be forwarded as `model = qwen2.5-30b`.

## License

ISC