const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// Constants
const VIKEY_API_URL = 'https://api.vikey.ai';
const SUPPORTED_MODELS = [
  'deepseek-r1:1.5b',
  'deepseek-r1:7b',
  'deepseek-r1:8b',
  'deepseek-r1:14b',
  'qwen2.5:7b-instruct-fp16'
];

// Function to create a formatted model object for the tags response
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

// Function to get list of models for the /api/tags endpoint
function getModelList() {
  return {
    models: SUPPORTED_MODELS.map(model => createModelObject(model))
  };
}

// Route handlers
// 1. List models endpoint
app.get('/api/tags', (req, res) => {
  res.json(getModelList());
});

// 2. Proxy for Ollama API chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages, stream = true, ...otherParams } = req.body;
    
    // Forward the request to vikey.ai API
    const response = await axios.post(`${VIKEY_API_URL}/chat`, {
      model,
      messages,
      stream,
      ...otherParams
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      // If streaming is enabled, we need to handle the stream properly
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      // For streaming response, pipe the response stream directly
      response.data.pipe(res);
    } else {
      // For non-streaming, transform the response to match Ollama format
      const vikeyResponse = response.data;
      
      // Transform the response to Ollama format
      const ollamaResponse = {
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
      
      res.json(ollamaResponse);
    }
  } catch (error) {
    console.error('Error proxying to vikey.ai:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to vikey.ai', details: error.message });
  }
});

// 3. Proxy for Ollama API generate endpoint
app.post('/api/generate', async (req, res) => {
  try {
    const { model, prompt, stream = true, ...otherParams } = req.body;
    
    // Forward the request to vikey.ai API
    const response = await axios.post(`${VIKEY_API_URL}/completions`, {
      model,
      prompt,
      stream,
      ...otherParams
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      // For streaming response, pipe the response stream directly
      response.data.pipe(res);
    } else {
      // For non-streaming, transform the response to match Ollama format
      const vikeyResponse = response.data;
      
      // Transform the response to Ollama format
      const ollamaResponse = {
        model,
        created_at: new Date().toISOString(),
        response: vikeyResponse.choices[0].text,
        done: true,
        total_duration: Math.floor(Math.random() * 5000000000),
        load_duration: Math.floor(Math.random() * 2000000),
        prompt_eval_count: prompt.length,
        prompt_eval_duration: Math.floor(Math.random() * 400000000),
        eval_count: Math.floor(Math.random() * 300) + 100,
        eval_duration: Math.floor(Math.random() * 5000000000)
      };
      
      res.json(ollamaResponse);
    }
  } catch (error) {
    console.error('Error proxying to vikey.ai:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to vikey.ai', details: error.message });
  }
});

// 4. Proxy for Ollama API embeddings endpoint
app.post('/api/embeddings', async (req, res) => {
  try {
    const { model, prompt, ...otherParams } = req.body;
    
    // Forward the request to vikey.ai API
    const response = await axios.post(`${VIKEY_API_URL}/embeddings`, {
      model,
      input: prompt,
      ...otherParams
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Transform the response to Ollama format
    const vikeyResponse = response.data;
    res.json({
      embedding: vikeyResponse.data[0].embedding
    });
  } catch (error) {
    console.error('Error proxying to vikey.ai:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to vikey.ai', details: error.message });
  }
});

// 5. Add OpenAI compatibility endpoints
// 5.1 Chat completions
app.post('/v1/chat/completions', async (req, res) => {
  try {
    const { model, messages, stream = false, ...otherParams } = req.body;
    
    // Forward the request to vikey.ai API
    const response = await axios.post(`${VIKEY_API_URL}/chat`, {
      model,
      messages,
      stream,
      ...otherParams
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      // For streaming response, pipe the response stream directly
      response.data.pipe(res);
    } else {
      // Just return the vikey response as is since it should already be in OpenAI format
      res.json(response.data);
    }
  } catch (error) {
    console.error('Error proxying to vikey.ai:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to vikey.ai', details: error.message });
  }
});

// 5.2 Completions
app.post('/v1/completions', async (req, res) => {
  try {
    const { model, prompt, stream = false, ...otherParams } = req.body;
    
    // Forward the request to vikey.ai API
    const response = await axios.post(`${VIKEY_API_URL}/completions`, {
      model,
      prompt,
      stream,
      ...otherParams
    }, {
      headers: {
        'Content-Type': 'application/json',
      },
      responseType: stream ? 'stream' : 'json'
    });
    
    if (stream) {
      // For streaming response, pipe the response stream directly
      response.data.pipe(res);
    } else {
      // Just return the vikey response as is since it should already be in OpenAI format
      res.json(response.data);
    }
  } catch (error) {
    console.error('Error proxying to vikey.ai:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to vikey.ai', details: error.message });
  }
});

// 5.3 Models list
app.get('/v1/models', (req, res) => {
  const models = SUPPORTED_MODELS.map(id => ({
    id,
    object: 'model',
    created: Math.floor(Date.now() / 1000),
    owned_by: 'library'
  }));
  
  res.json({ data: models, object: 'list' });
});

// 5.4 Model info
app.get('/v1/models/:model', (req, res) => {
  const { model } = req.params;
  
  if (SUPPORTED_MODELS.includes(model)) {
    res.json({
      id: model,
      object: 'model',
      created: Math.floor(Date.now() / 1000),
      owned_by: 'library'
    });
  } else {
    res.status(404).json({ error: { message: 'Model not found' } });
  }
});

// 5.5 Embeddings
app.post('/v1/embeddings', async (req, res) => {
  try {
    const { model, input, ...otherParams } = req.body;
    
    // Forward the request to vikey.ai API
    const response = await axios.post(`${VIKEY_API_URL}/embeddings`, {
      model,
      input,
      ...otherParams
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    // Just return the vikey response as is since it should already be in OpenAI format
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying to vikey.ai:', error.message);
    res.status(500).json({ error: 'Failed to proxy request to vikey.ai', details: error.message });
  }
});

// Fallback for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not supported' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Ollama proxy server running on http://localhost:${PORT}`);
}); 