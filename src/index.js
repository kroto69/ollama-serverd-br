const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { PORT } = require('./config/config');

// Import controllers
const ollamaController = require('./controllers/ollamaController');
const openaiController = require('./controllers/openaiController');

// Create Express app
const app = express();

// CORS middleware
app.use(cors());

// Raw body middleware for requests with no content-type
app.use((req, res, next) => {
  if (!req.headers['content-type']) {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', chunk => {
      data += chunk;
    });
    req.on('end', () => {
      // console.log('Raw data with no content-type:', data);
      try {
        req.body = JSON.parse(data);
        // console.log('Successfully parsed as JSON:', req.body);
      } catch (e) {
        req.body = data;
        // console.log('Could not parse as JSON, treating as plain text');
      }
      next();
    });
  } else {
    next();
  }
});

// Parse various content types
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.text({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Request logging middleware
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
      console.log('────────────────────────────────────');
      console.log(`${req.method} ${req.url}`);
      console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
      // Don't log large bodies like embeddings
      if (req.url.includes('embed')) {
        console.log('Body: [embedding request - body not logged]');
      } else {
        // Try to stringify the body
        try {
          console.log('Body:', JSON.stringify(req.body, null, 2));
        } catch (e) {
          console.log('Body: [unable to stringify]');
          console.log('Body type:', typeof req.body);
        }
      }

      next();
  });
}

// Removed legacy LLAMAEDGE gaia routes to simplify codebase
// Ollama API routes
app.get('/api/tags', ollamaController.getModels);
app.post('/api/chat', ollamaController.chat);
app.post('/api/generate', ollamaController.generate);
app.post('/api/embeddings', ollamaController.embeddings);
app.post('/api/embed', ollamaController.embed);

// OpenAI compatibility routes
app.post('/v1/chat/completions', openaiController.chatCompletions);
app.post('/v1/completions', openaiController.completions);
app.get('/v1/models', openaiController.listModels);
app.get('/v1/models/:model', openaiController.getModel);
app.post('/v1/embeddings', openaiController.embeddings);
app.post('/v1/embed', openaiController.embed);

// Version endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: '0.1.0' });
});

// Fallback for unhandled routes
app.use((req, res) => {
  console.log('Endpoint not supported', req.url);
  res.status(404).json({ error: 'Endpoint not supported' });
});

// Start server on PORT
app.listen(PORT, () => {
  console.log(`Ollama proxy server running on http://localhost:${PORT}`);
});