const { SUPPORTED_MODELS } = require('../config/config');

/**
 * Creates a formatted model object for the Ollama API /api/tags response
 * @param {string} name - Model name
 * @returns {Object} - Formatted model object
 */
function createModelObject(name) {
  const currentDate = new Date();
  // Add 1 year to the current date for the modified_at field
  const modifiedDate = new Date(currentDate);
  modifiedDate.setFullYear(currentDate.getFullYear() + 1);
  
  // Generate a random SHA256-like digest
  const digest = [...Array(64)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  
  // Extract model family and size from name
  const parts = name.split(':');
  const family = parts[0];
  let parameterSize = parts[1] || '';
  parameterSize = parameterSize.includes('b') ? parameterSize.toUpperCase() : parameterSize;
  
  return {
    name,
    model: name,
    modified_at: modifiedDate.toISOString(),
    size: Math.floor(Math.random() * 500000000) + 100000000, // Random size between 100MB and 600MB
    digest,
    details: {
      parent_model: "",
      format: "gguf",
      family,
      families: [family],
      parameter_size: parameterSize,
      quantization_level: Math.random() > 0.5 ? "Q4_K_M" : "F16"
    }
  };
}

/**
 * Gets the list of models formatted for the Ollama API /api/tags endpoint
 * @returns {Object} - Object with models array
 */
function getModelList() {
  return {
    models: SUPPORTED_MODELS.map(model => createModelObject(model))
  };
}

/**
 * Transforms response format from vikey.ai to Ollama API format for chat
 * @param {string} model - Model name
 * @param {Array} messages - Chat messages
 * @param {Object} vikeyResponse - Response from vikey.ai
 * @returns {Object} - Ollama API formatted response
 */
function transformChatResponse(model, messages, vikeyResponse) {
  return {
    model,
    created_at: new Date().toISOString(),
    message: {
      role: 'assistant',
      content: vikeyResponse.choices[0].message.content
    },
    done: true,
    total_duration: Math.floor(Math.random() * 5000000000),
    load_duration: Math.floor(Math.random() * 2000000),
    prompt_eval_count: messages.length,
    prompt_eval_duration: Math.floor(Math.random() * 400000000),
    eval_count: Math.floor(Math.random() * 300) + 100,
    eval_duration: Math.floor(Math.random() * 5000000000)
  };
}

/**
 * Gets models formatted for the OpenAI API /v1/models endpoint
 * @returns {Object} - Object with data array and object type
 */
function getOpenAIModelList() {
  const models = SUPPORTED_MODELS.map(id => ({
    id,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'library'
  }));
  
  return { data: models, object: 'list' };
}

/**
 * Gets a specific model formatted for the OpenAI API /v1/models/:model endpoint
 * @param {string} model - Model name
 * @returns {Object|null} - Model info or null if not found
 */
function getOpenAIModel(model) {
  if (SUPPORTED_MODELS.includes(model)) {
    return {
      id: model,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'library'
    };
  }
  return null;
}

module.exports = {
  createModelObject,
  getModelList,
  transformChatResponse,
  getOpenAIModelList,
  getOpenAIModel
}; 