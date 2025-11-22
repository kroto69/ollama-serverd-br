let __dotenvLoaded = false; try { require('dotenv').config(); __dotenvLoaded = true; } catch (e) {}
// Configuration constants
const PORT = process.env.NODE_PORT || 3000;

// Default provider used when none specified
const DEFAULT_PROVIDER = process.env.DEFAULT_PROVIDER || 'vikey';

// Single host + key for all requests
const URL_HOST = process.env.URL_HOST || 'https://api.vikey.ai/v1';
const API_KEY = process.env.API_KEY || 'your_default_api_key_here';
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || '';
const MODEL_FALLBACK_TARGET = process.env.MODEL_FALLBACK_TARGET || '';

function parseModelMap(str) {
  const map = {};
  if (!str || typeof str !== 'string') return map;
  str.split(',').forEach(pair => {
    const [from, to] = pair.split('=');
    if (from && to) {
      map[from.trim()] = to.trim();
    }
  });
  return map;
}

const MODEL_MAP = parseModelMap(process.env.MODEL_MAP);
function parsePrefixMap(str) {
  const map = {};
  if (!str || typeof str !== 'string') return map;
  str.split(',').forEach(pair => {
    const [from, to] = pair.split('=');
    if (from && to) {
      map[from.trim()] = to.trim();
    }
  });
  return map;
}
const MODEL_MAP_PREFIX = parsePrefixMap(process.env.MODEL_MAP_PREFIX);

function mapModel(name) {
  if (DEFAULT_MODEL) return DEFAULT_MODEL;
  return name;
}
function getApiStyle(host) {
  const h = (host || '').toLowerCase();
  if (h.includes('generativelanguage.googleapis.com')) return 'gemini';
  return 'openai';
}
const API_STYLE = getApiStyle(URL_HOST);
function parseModelsEnv(str) {
  if (!str) return null;
  try {
    if (str.trim().startsWith('[')) return JSON.parse(str);
  } catch (e) {}
  return str.split(',').map(s => s.trim()).filter(Boolean);
}
const SUPPORTED_MODELS = parseModelsEnv(process.env.MODELS) || require('./models.json');

// Map Ollama model names to Intelligence.io model names for embeddings
const EMBEDDING_MODEL_MAP = {
  'hellord/mxbai-embed-large-v1:f16': 'mixedbread-ai/mxbai-embed-large-v1',
  'all-minilm': 'nomic-embed', // Default fallback for Ollama's minilm
  'all-mini': 'nomic-embed', // Handle truncated name
  'default': 'nomic-embed' // Default fallback
};

module.exports = {
  PORT,
  DEFAULT_PROVIDER,
  URL_HOST,
  API_KEY,
  DEFAULT_MODEL,
  SUPPORTED_MODELS,
  EMBEDDING_MODEL_MAP,
  mapModel,
  API_STYLE
};