const { getModelList, transformChatResponse } = require('../utils/modelUtils');
const { mapModel, DEFAULT_MODEL, API_STYLE } = require('../config/config');
const { makeChatRequest, makeCompletionRequest, makeEmbeddingsRequest } = require('../utils/apiUtils');

/**
 * Handler for GET /api/tags endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
function getModels(req, res) {
  res.json(getModelList());
}

/**
 * Handler for POST /api/chat endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function chat(req, res) {
  try {
    const { model, messages, stream = true, ...otherParams } = req.body;
    const chosenModel = mapModel(model || DEFAULT_MODEL);
    const wantsStream = stream && API_STYLE !== 'gemini';
    const response = await makeChatRequest(chosenModel, messages, wantsStream, otherParams);
    
    if (wantsStream) {
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
            if (jsonStr.trim() === '[DONE]') continue;
            
            const vikeyResponse = JSON.parse(jsonStr);
            const streamResponse = {
              model: chosenModel || "meta-llama/Meta-Llama-3-8B-Instruct",
              created_at: new Date().toISOString(),
              message: {
                role: "assistant",
                content: vikeyResponse.choices[0].delta.content || ""
              },
              done: false
            };
            
            // Send the JSON response
            res.header('Content-Type', 'application/json');
            res.write(JSON.stringify(streamResponse) + '\n');
          }
        } catch (error) {
          console.error('Error processing stream chunk:', error);
          console.log('Problematic chunk:', chunk.toString());
        }
      });

      response.data.on('end', () => {
        const finalResponse = {
          model: chosenModel || "qwen2.5:0.5b",
          created_at: new Date().toISOString(),
          message: {
            role: "assistant",
            content: ""
          },
          done: true,
          done_reason: "stop",
          total_duration: Math.floor(Math.random() * 20000000000),
          load_duration: Math.floor(Math.random() * 3000000000),
          prompt_eval_count: Math.floor(Math.random() * 50) + 10,
          prompt_eval_duration: Math.floor(Math.random() * 500000000),
          eval_count: Math.floor(Math.random() * 1000) + 100,
          eval_duration: Math.floor(Math.random() * 17000000000)
        };
        
        // Send the final JSON response
        res.write(JSON.stringify(finalResponse) + '\n');
        res.end();
      });
    } else {
      // For non-streaming, transform the response to match Ollama format
      const vikeyResponse = response.data;
      vikeyResponse.model = chosenModel;
      res.json(transformChatResponse(chosenModel, messages, vikeyResponse));
    }
  } catch (error) {
    console.error('Error in chat endpoint:', error.message);
    res.status(500).json({ error: 'Failed to proxy request', details: error.message });
  }
}

/**
 * Handler for POST /api/generate endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function generate(req, res) {
  try {
    // Parse request body if necessary
    const body = parseRequestBody(req);
    
    // Extract parameters with fallbacks
    const model = mapModel(body.model || DEFAULT_MODEL);
    const prompt = body.prompt || '';
    const stream = body.stream === false ? false : true;
    const { model: _, prompt: __, stream: ___, ...otherParams } = body;
    
    console.log('Generate with model:', model);
    console.log('Prompt:', prompt);
    
    const wantsStream = stream && API_STYLE !== 'gemini';
    const response = await makeCompletionRequest(model, prompt, wantsStream, otherParams);
    
    if (wantsStream) {
      // For streaming response, pipe the response stream directly
      response.data.pipe(res);
    } else {
      // For non-streaming, transform the response to match Ollama format
      const vikeyResponse = response.data;
      
      // Create a response in the specified format
      const ollamaResponse = {
        model: model,
        created_at: new Date().toISOString(),
        response: vikeyResponse.choices[0].message.content,
        done: true,
        done_reason: "stop",
        context: generateRandomContext(500), // Generate fake context tokens
        total_duration: Math.floor(Math.random() * 15000000000),
        load_duration: Math.floor(Math.random() * 60000000),
        prompt_eval_count: prompt.length > 0 ? Math.floor(prompt.length / 10) : 39,
        prompt_eval_duration: Math.floor(Math.random() * 50000000),
        eval_count: Math.floor(Math.random() * 500) + 100,
        eval_duration: Math.floor(Math.random() * 14000000000)
      };
      
      res.json(ollamaResponse);
    }
  } catch (error) {
    console.error('Error in generate endpoint:', error.message);
    res.status(500).json({ error: 'Failed request', details: error.message });
  }
}

/**
 * Generate random context tokens (fake token IDs)
 * @param {number} count - Number of tokens to generate
 * @returns {Array} - Array of token IDs
 */
function generateRandomContext(count) {
  const context = [];
  for (let i = 0; i < count; i++) {
    context.push(Math.floor(Math.random() * 100000));
  }
  return context;
}

/**
 * Parse raw request data when content-type is missing
 * @param {Object} req - Express request object
 * @returns {Object} - Parsed body
 */
function parseRequestBody(req) {
  console.log('Headers:', req.headers);
  console.log('Raw body:', req.body);
  
  let body = req.body;
  
  // If the body is a string (text/plain or no content-type), try to parse it as JSON
  if (typeof body === 'string' || body instanceof String) {
    try {
      body = JSON.parse(body);
      console.log('Successfully parsed string body as JSON:', body);
    } catch (parseError) {
      console.error('Failed to parse string body as JSON:', parseError.message);
    }
  }
  // If the body is a Buffer (raw data), try to parse it
  else if (Buffer.isBuffer(body)) {
    try {
      const jsonString = body.toString('utf8');
      console.log('Raw buffer data:', jsonString);
      body = JSON.parse(jsonString);
      console.log('Successfully parsed buffer data as JSON:', body);
    } catch (parseError) {
      console.error('Failed to parse buffer as JSON:', parseError.message);
    }
  }
  // If we have a raw body (no content-type), try to parse it
  else if (!req.headers['content-type'] && body) {
    try {
      // Try to parse as JSON if it's an object
      if (typeof body === 'object') {
        console.log('Using object body as-is:', body);
      }
      // Default case: if we have raw data but couldn't parse it
      else {
        console.log('Could not parse body, using as plain text');
      }
    } catch (error) {
      console.error('Error processing raw body:', error.message);
    }
  }
  
  return body || {};
}

/**
 * Handler for POST /api/embeddings endpoint
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function embeddings(req, res) {
  try {
    // Parse request body regardless of content-type
    const body = parseRequestBody(req);
    
    // Extract parameters with fallbacks
    const model = body.model || 'all-minilm';
    const prompt = body.prompt || body.input;
    const input = body.input || body.prompt;
    const textToEmbed = input || prompt || '';
    
    console.log('Extracted model:', model);
    console.log('Extracted text to embed:', textToEmbed);
    
    if (!model) {
      return res.status(400).json({ 
        error: 'Missing required parameter: "model"' 
      });
    }
    
    if (!textToEmbed) {
      return res.status(400).json({ 
        error: 'Missing required parameter: Either "prompt" or "input" must be provided' 
      });
    }
    
    // Remove model and input/prompt from otherParams
    const { model: _, prompt: __, input: ___, ...otherParams } = body;
    
    const response = await makeEmbeddingsRequest(model, textToEmbed, otherParams);
    
    // Transform the intelligence.io response to Ollama format
    const intelligenceResponse = response.data;
    res.json({
      embeddings: [intelligenceResponse.data[0].embedding]
    });
  } catch (error) {
    console.error('Error in embeddings endpoint:', error.message);
    res.status(500).json({ error: 'Failed request', details: error.message });
  }
}

/**
 * Handler for POST /api/embed endpoint (new endpoint alias for embeddings)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function embed(req, res) {
  try {
    // Log the request info for debugging
    console.log('Embed Request URL:', req.url);
    console.log('Embed Request Method:', req.method);
    console.log('Content-Type:', req.headers['content-type']);
    console.log('All Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Raw Body:', req.body);
    
    // Parse request body regardless of content-type
    const body = parseRequestBody(req);
    
    // Extract parameters with fallbacks
    const model = body.model || 'all-minilm';
    const prompt = body.prompt || body.input;
    const input = body.input || body.prompt;
    const textToEmbed = input || prompt || '';
    
    console.log('Parsed request body:', body);
    console.log('Using model:', model);
    console.log('Text to embed:', textToEmbed);
    
    // Validate required parameters (with more forgiving validation)
    if (!textToEmbed) {
      return res.status(400).json({ 
        error: 'Missing required parameter: Either "prompt" or "input" must be provided' 
      });
    }
    
    // Remove model and input/prompt from otherParams
    const { model: _, prompt: __, input: ___, ...otherParams } = body;
    
    const response = await makeEmbeddingsRequest(model, textToEmbed, otherParams);
    
    // Transform the intelligence.io response to Ollama format
    const intelligenceResponse = response.data;
    res.json({
      embeddings: [intelligenceResponse.data[0].embedding]
    });
  } catch (error) {
    console.error('Error in embed endpoint:', error.message);
    res.status(500).json({ error: 'Failed request', details: error.message });
  }
}

module.exports = {
  getModels,
  chat,
  generate,
  embeddings,
  embed
};