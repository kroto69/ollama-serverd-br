const axios = require('axios');
const { URL_HOST, API_KEY, API_STYLE, EMBEDDING_MODEL_MAP } = require('../config/config');


/**
 * Makes a chat completion request to vikey.ai
 * @param {string} model - Model name
 * @param {Array} messages - Chat messages
 * @param {boolean} stream - Whether to stream the response
 * @param {Object} otherParams - Additional parameters
 * @returns {Promise<Object>} - API response
 */
async function makeChatRequest(model, messages, stream = true, otherParams = {}) {
  if (API_STYLE === 'gemini') {
    const contents = (messages || []).map(m => ({
      role: m.role === 'system' ? 'user' : m.role,
      parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }]
    }));
    const payload = { contents, generationConfig: { maxOutputTokens: otherParams.max_tokens || 2048 } };
    const url = `${URL_HOST}/models/${model}:generateContent`;
    const response = await axios.post(url, payload, {
      params: { key: API_KEY },
      headers: { 'Content-Type': 'application/json' }
    });
    const candidates = response.data.candidates || [];
    const text = candidates.length > 0 ? (candidates[0].content?.parts || []).map(p => p.text || '').join('') : '';
    return { data: {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
      usage: null
    } };
  }
  return await axios.post(`${URL_HOST}/chat/completions`, {
    model,
    messages,
    stream,
    max_tokens: 3000,
    ...otherParams
  }, {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
    },
    responseType: stream ? 'stream' : 'json',
    timeout: stream ? 0 : 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    timeoutErrorMessage: 'Request timed out'
  });
}

/**
 * Makes a completion request to vikey.ai
 * @param {string} model - Model name
 * @param {string} prompt - Text prompt
 * @param {boolean} stream - Whether to stream the response
 * @param {Object} otherParams - Additional parameters
 * @returns {Promise<Object>} - API response
 */
async function makeCompletionRequest(model, prompt, stream = true, otherParams = {}) {
  if (API_STYLE === 'gemini') {
    const payload = {
      contents: [{ role: 'user', parts: [{ text: prompt }]}],
      generationConfig: { maxOutputTokens: otherParams.max_tokens || 1024 }
    };
    const url = `${URL_HOST}/models/${model}:generateContent`;
    const response = await axios.post(url, payload, { params: { key: API_KEY }, headers: { 'Content-Type': 'application/json' } });
    const candidates = response.data.candidates || [];
    const text = candidates.length > 0 ? (candidates[0].content?.parts || []).map(p => p.text || '').join('') : '';
    return { data: {
      id: `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }]
    } };
  }
  const payload = {
    model,
    messages: [{ role: 'user', content: prompt }],
    stream,
    max_tokens: 500,
    ...otherParams
  };
  return await axios.post(`${URL_HOST}/chat/completions`, payload, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    responseType: stream ? 'stream' : 'json'
  });
}

/**
 * Makes an embeddings request to intelligence.io.solutions
 * @param {string} model - Model name
 * @param {string|Array} input - Input for embedding
 * @param {Object} otherParams - Additional parameters
 * @returns {Promise<Object>} - API response
 */
async function makeEmbeddingsRequest(model, input, otherParams = {}) {
  try {
    const formattedInput = Array.isArray(input) ? input : (typeof input === 'string' ? input : String(input));
    if (API_STYLE === 'gemini') {
      const url = `${URL_HOST}/models/${model}:embedContent`;
      const payload = { content: { parts: [{ text: formattedInput }] } };
      const response = await axios.post(url, payload, { params: { key: API_KEY }, headers: { 'Content-Type': 'application/json' } });
      const embedding = response.data.embedding?.values || [];
      return { data: { data: [{ embedding, index: 0 }], model } };
    }
    // Optional mapping when host points to GAIA
    const payload = { model, input: formattedInput, ...otherParams };
    const url = `${URL_HOST}/embeddings`;
    return await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` }
    });
  } catch (error) {
    // Improved error logging
    console.error('Error in makeEmbeddingsRequest:');
    console.error('- Status:', error.response?.status);
    console.error('- Message:', error.message);
    console.error('- Response data:', error.response?.data);
    console.error('- Original model:', model);
    console.error('- Input type:', typeof input);
    throw error;
  }
}

module.exports = {
  makeChatRequest,
  makeCompletionRequest,
  makeEmbeddingsRequest
};