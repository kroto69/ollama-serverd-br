const { getOpenAIModelList, getOpenAIModel } = require('../utils/modelUtils');
const { mapModel, DEFAULT_MODEL, API_STYLE } = require('../config/config');
const { makeChatRequest, makeCompletionRequest, makeEmbeddingsRequest } = require('../utils/apiUtils');

/**
 * Helper function to delay execution
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Handler for POST /v1/chat/completions endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function chatCompletions(req, res) {
  try {
    const { model, messages, stream = false, ...otherParams } = req.body;
    const chosenModel = mapModel(model || DEFAULT_MODEL);
    
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        const wantsStream = stream && API_STYLE !== 'gemini';
        const response = await makeChatRequest(chosenModel, messages, wantsStream, otherParams);
        
        if (wantsStream) {
          // Set proper headers for SSE
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');
          
          let buffer = '';
          
          response.data.on('data', chunk => {
            try {
              // Append the new chunk to our buffer
              buffer += chunk.toString();
              
              // Process any complete messages in the buffer
              while (true) {
                const messageEnd = buffer.indexOf('\n');
                if (messageEnd === -1) break; // No complete message yet
                
                const message = buffer.slice(0, messageEnd);
                buffer = buffer.slice(messageEnd + 1);
                
                // Skip empty messages
                if (!message.trim()) continue;
                
                // Remove 'data: ' prefix if present and parse the JSON
                const jsonStr = message.replace(/^data: /, '');
                
                // Skip [DONE] message
                if (jsonStr.trim() === '[DONE]') {
                  res.write('data: [DONE]\n\n');
                  continue;
                }
                
                const vikeyResponse = JSON.parse(jsonStr);
                const streamResponse = {
                  id: vikeyResponse.id || `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: model || "meta-llama/llama-3.1-8b-instruct/fp-8",
                  choices: [
                    {
                      index: 0,
                      delta: {
                        role: vikeyResponse.choices?.[0]?.delta?.role || null,
                        content: vikeyResponse.choices?.[0]?.delta?.content || "",
                        reasoning_content: null,
                        tool_calls: null
                      },
                      logprobs: null,
                      finish_reason: vikeyResponse.choices?.[0]?.finish_reason || null,
                      matched_stop: null
                    }
                  ],
                  usage: null
                };
                
                // Send the JSON response in SSE format
                res.write(`data: ${JSON.stringify(streamResponse)}\n\n`);
              }
            } catch (error) {
              console.error('Error processing stream chunk:', error);
              console.log('Problematic chunk:', chunk.toString());
            }
          });

          response.data.on('end', () => {
            const finalResponse = {
              id: `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: model || "meta-llama/llama-3.1-8b-instruct/fp-8",
              choices: [
                {
                  index: 0,
                  delta: {
                    role: null,
                    content: "",
                    reasoning_content: null,
                    tool_calls: null
                  },
                  logprobs: null,
                  finish_reason: "stop",
                  matched_stop: 128009
                }
              ],
              usage: null
            };
            
            // Send the final JSON response in SSE format
            res.write(`data: ${JSON.stringify(finalResponse)}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
          });
        } else {
          // Set content type for non-streaming response or gemini fallback
          res.setHeader('Content-Type', 'application/json');
          response.data.model = chosenModel;
          res.json(response.data);
        }
        break; // If successful, break the retry loop
      } catch (error) {
        if (error.response?.status === 429 && retryCount < maxRetries - 1) {
          console.log(`Rate limit hit (429), retrying in 5 seconds... (Attempt ${retryCount + 1}/${maxRetries})`);
          await delay(5000); // Wait 5 seconds before retrying
          retryCount++;
          continue;
        }
        throw error; // If not a 429 or max retries reached, throw the error
      }
    }
  } catch (error) {
    console.error('Error in chat completions endpoint:', error.message);
    res.status(500).json({ 
      error: { 
        message: 'Failed to proxy request', 
        type: 'server_error' 
      } 
    });
  }
}

/**
 * Handler for POST /v1/completions endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function completions(req, res) {
  try {
    const { model, prompt, stream = false, ...otherParams } = req.body;
    const chosenModel = mapModel(model || DEFAULT_MODEL);
    
    const wantsStream = stream && API_STYLE !== 'gemini';
    const response = await makeCompletionRequest(chosenModel, prompt, wantsStream, otherParams);
    
    if (wantsStream) {
      // For streaming response, pipe the response stream directly
      response.data.pipe(res);
    } else {
      // Just return the vikey response as is since it should already be in OpenAI format
      response.data.model = chosenModel;
      res.json(response.data);
    }
  } catch (error) {
    console.error('Error in completions endpoint:', error.message);
    res.status(500).json({ 
      error: { 
        message: 'Failed to proxy request', 
        type: 'server_error' 
      } 
    });
  }
}

/**
 * Handler for GET /v1/models endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function listModels(req, res) {
  res.json(getOpenAIModelList());
}

/**
 * Handler for GET /v1/models/:model endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getModel(req, res) {
  const { model } = req.params;
  const modelInfo = getOpenAIModel(model);
  
  if (modelInfo) {
    res.json(modelInfo);
  } else {
    res.status(404).json({ error: { message: 'Model not found', type: 'invalid_request_error' } });
  }
}

/**
 * Parse request body if it's a string (from curl requests)
 * @param {*} body - Request body
 * @returns {Object} - Parsed body
 */
function parseBodyIfString(body) {
  if (typeof body === 'string' || body instanceof String) {
    try {
      return JSON.parse(body);
    } catch (parseError) {
      console.error('Failed to parse string body as JSON:', parseError.message);
      return body;
    }
  }
  return body;
}

/**
 * Handler for POST /v1/embeddings endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function embeddings(req, res) {
  try {
    // Log the request for debugging
    console.log('OpenAI Embeddings Request Body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Parse body if it's a string
    const body = parseBodyIfString(req.body);
    
    // Extract parameters from the request
    // Handle both JSON and form-data formats
    const model = body.model;
    const input = body.input;
    
    
    // Validate required parameters
    if (!model) {
      return res.status(400).json({ 
        error: { 
          message: 'Missing required parameter: "model"',
          type: 'invalid_request_error'
        }
      });
    }
    
    if (!input) {
      return res.status(400).json({ 
        error: { 
          message: 'Missing required parameter: "input"',
          type: 'invalid_request_error'
        }
      });
    }
    
    console.log('Using model:', model);
    console.log('Input to embed:', input);
    
    // Remove model and input from otherParams
    const { model: _, input: __, ...otherParams } = body;
    
    const response = await makeEmbeddingsRequest(model, input, otherParams);
    
    // Return the response in OpenAI format
    // Intelligence.io responses are already compatible with OpenAI format
    res.json(response.data);
  } catch (error) {
    console.error('Error in embeddings endpoint:', error.message);
    res.status(500).json({ 
      error: { 
        message: 'Failed to proxy request to intelligence.io', 
        type: 'server_error' 
      } 
    });
  }
}

/**
 * Handler for POST /v1/embed endpoint (if needed for compatibility)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function embed(req, res) {
  try {
    // Log the request for debugging
    console.log('OpenAI Embed Request Body:', req.body);
    console.log('Content-Type:', req.headers['content-type']);
    
    // Parse body if it's a string
    const body = parseBodyIfString(req.body);
    
    // Extract parameters from the request
    // Handle both JSON and form-data formats
    const model = body.model;
    const input = body.input;
    
    
    // Validate required parameters
    if (!model) {
      return res.status(400).json({ 
        error: { 
          message: 'Missing required parameter: "model"',
          type: 'invalid_request_error'
        }
      });
    }
    
    if (!input) {
      return res.status(400).json({ 
        error: { 
          message: 'Missing required parameter: "input"',
          type: 'invalid_request_error'
        }
      });
    }
    
    console.log('Using model:', model);
    console.log('Input to embed:', input);
    
    // Remove model and input from otherParams
    const { model: _, input: __, ...otherParams } = body;
    
    const response = await makeEmbeddingsRequest(model, input, otherParams);
    
    // Return the response in OpenAI format
    // Intelligence.io responses are already compatible with OpenAI format
    res.json(response.data);
  } catch (error) {
    console.error('Error in embed endpoint:', error.message);
    res.status(500).json({ 
      error: { 
        message: 'Failed to proxy request to intelligence.io', 
        type: 'server_error' 
      } 
    });
  }
}

module.exports = {
  chatCompletions,
  completions,
  listModels,
  getModel,
  embeddings,
  embed
};