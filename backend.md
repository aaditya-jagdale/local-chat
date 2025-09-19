# FastAPI Ollama Chat Backend

A minimal, production-ready FastAPI backend that proxies chat requests to local Ollama models with JWT authentication and file upload capabilities.

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Ollama installed and running locally
- At least one Ollama model downloaded

### Installation

1. **Clone and setup environment:**

```bash
cd localChat
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

2. **Start Ollama (if not running):**

```bash
ollama serve
```

3. **Run the FastAPI server:**

```bash
uvicorn main:app --reload --port 8000
```

The API will be available at `http://127.0.0.1:8000`

## 📋 API Endpoints

### Authentication

#### `POST /login`

Authenticate and get JWT token.

**Request:**

```json
{
  "email": "admin@local",
  "password": "changeme"
}
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
```

**Default Credentials:**

- Email: `admin@local`
- Password: `changeme`

### Models

#### `GET /models`

List all available Ollama models.

**Headers:**

```
Authorization: Bearer <your_jwt_token>
```

**Response:**

```json
{
  "models": [
    {
      "name": "gemma3:4b",
      "model": "gemma3:4b",
      "modified_at": "2025-09-17T14:14:39.894880991+05:30",
      "size": 3338801804,
      "digest": "a2af6cc3eb7fa8be8504abaf9b04e88f17a119ec3f04a3addf55f92841195f5a",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "gemma3",
        "families": ["gemma3"],
        "parameter_size": "4.3B",
        "quantization_level": "Q4_K_M"
      }
    }
  ]
}
```

### Chat

#### `POST /chat`

Stream chat responses from Ollama models.

**Headers:**

```
Authorization: Bearer <your_jwt_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "model": "gemma3:4b",
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "stream": true
}
```

**Response:** Streaming JSON chunks (newline-delimited JSON)

```
{"model":"gemma3:4b","created_at":"2025-09-18T05:21:05.486309Z","message":{"role":"assistant","content":"I"},"done":false}
{"model":"gemma3:4b","created_at":"2025-09-18T05:21:05.517444Z","message":{"role":"assistant","content":"'"},"done":false}
{"model":"gemma3:4b","created_at":"2025-09-18T05:21:05.546689Z","message":{"role":"assistant","content":"m"},"done":false}
...
{"model":"gemma3:4b","created_at":"2025-09-18T05:21:07.66725Z","message":{"role":"assistant","content":""},"done_reason":"stop","done":true,"total_duration":5288880417,"load_duration":2455671084,"prompt_eval_count":15,"prompt_eval_duration":651123166,"eval_count":75,"eval_duration":2181703084}
```

### File Upload

#### `POST /upload`

Upload files (images, PDFs, text files).

**Headers:**

```
Authorization: Bearer <your_jwt_token>
Content-Type: multipart/form-data
```

**Request:** Form data with file field

**Response:**

```json
{
  "filename": "a1b2c3d4e5f6_myfile.pdf",
  "download_path": "/files/a1b2c3d4e5f6_myfile.pdf"
}
```

#### `GET /files/{filename}`

Download uploaded files.

**Headers:**

```
Authorization: Bearer <your_jwt_token>
```

### Health Check

#### `GET /health`

Check API and Ollama connection status.

**Response:**

```json
{
  "status": "ok",
  "ollama_url": "http://localhost:11434"
}
```

## 🔧 Frontend Integration Guide

### 1. Authentication Flow

```javascript
// Login and store token
async function login(email, password) {
  const response = await fetch("http://127.0.0.1:8000/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Login failed");
  }

  const data = await response.json();
  localStorage.setItem("jwt_token", data.access_token);
  return data.access_token;
}

// Get stored token
function getAuthToken() {
  return localStorage.getItem("jwt_token");
}
```

### 2. Fetch Available Models

```javascript
async function fetchModels() {
  const token = getAuthToken();
  const response = await fetch("http://127.0.0.1:8000/models", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch models");
  }

  const data = await response.json();
  return data.models;
}
```

### 3. Streaming Chat Implementation

```javascript
async function streamChat(model, messages, onChunk, onComplete, onError) {
  const token = getAuthToken();

  try {
    const response = await fetch("http://127.0.0.1:8000/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop(); // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.trim()) {
          try {
            const chunk = JSON.parse(line);
            onChunk(chunk);

            if (chunk.done) {
              onComplete(chunk);
              return;
            }
          } catch (e) {
            console.warn("Failed to parse chunk:", line);
          }
        }
      }
    }
  } catch (error) {
    onError(error);
  }
}
```

### 4. Complete Chat Component Example (React)

```jsx
import React, { useState, useEffect, useRef } from "react";

function ChatInterface() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Login function
  const login = async (email, password) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) throw new Error("Login failed");

      const data = await response.json();
      localStorage.setItem("jwt_token", data.access_token);
      setIsAuthenticated(true);
      await loadModels();
    } catch (error) {
      alert("Login failed: " + error.message);
    }
  };

  // Load models
  const loadModels = async () => {
    try {
      const token = localStorage.getItem("jwt_token");
      const response = await fetch("http://127.0.0.1:8000/models", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load models");

      const data = await response.json();
      setModels(data.models);
      if (data.models.length > 0) {
        setSelectedModel(data.models[0].name);
      }
    } catch (error) {
      alert("Failed to load models: " + error.message);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedModel) return;

    const userMessage = { role: "user", content: inputMessage };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage("");
    setIsLoading(true);

    // Add empty assistant message for streaming
    const assistantMessage = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMessage]);

    try {
      await streamChat(
        selectedModel,
        newMessages,
        (chunk) => {
          // Update the last message (assistant's response)
          setMessages((prev) => {
            const updated = [...prev];
            const lastMessage = updated[updated.length - 1];
            lastMessage.content += chunk.message.content;
            return updated;
          });
        },
        (finalChunk) => {
          setIsLoading(false);
          // Final chunk contains metadata like total_duration
          console.log("Chat completed:", finalChunk);
        },
        (error) => {
          setIsLoading(false);
          alert("Chat error: " + error.message);
        }
      );
    } catch (error) {
      setIsLoading(false);
      alert("Failed to send message: " + error.message);
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Check if already authenticated
  useEffect(() => {
    const token = localStorage.getItem("jwt_token");
    if (token) {
      setIsAuthenticated(true);
      loadModels();
    }
  }, []);

  if (!isAuthenticated) {
    return (
      <div style={{ padding: "20px", maxWidth: "400px", margin: "0 auto" }}>
        <h2>Login</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            login(formData.get("email"), formData.get("password"));
          }}
        >
          <div style={{ marginBottom: "10px" }}>
            <input
              type="email"
              name="email"
              placeholder="Email"
              defaultValue="admin@local"
              required
              style={{ width: "100%", padding: "8px" }}
            />
          </div>
          <div style={{ marginBottom: "10px" }}>
            <input
              type="password"
              name="password"
              placeholder="Password"
              defaultValue="changeme"
              required
              style={{ width: "100%", padding: "8px" }}
            />
          </div>
          <button type="submit" style={{ width: "100%", padding: "10px" }}>
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <div style={{ marginBottom: "20px" }}>
        <h2>Chat with Ollama</h2>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          style={{ padding: "8px", marginRight: "10px" }}
        >
          {models.map((model) => (
            <option key={model.name} value={model.name}>
              {model.name} ({model.details?.parameter_size || "Unknown size"})
            </option>
          ))}
        </select>
        <button onClick={() => setIsAuthenticated(false)}>Logout</button>
      </div>

      <div
        style={{
          height: "400px",
          border: "1px solid #ccc",
          overflowY: "auto",
          padding: "10px",
          marginBottom: "10px",
          backgroundColor: "#f9f9f9",
        }}
      >
        {messages.map((message, index) => (
          <div key={index} style={{ marginBottom: "10px" }}>
            <strong>{message.role}:</strong> {message.content}
          </div>
        ))}
        {isLoading && <div>AI is typing...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ display: "flex" }}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Type your message..."
          style={{ flex: 1, padding: "8px", marginRight: "10px" }}
          disabled={isLoading}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputMessage.trim()}
          style={{ padding: "8px 16px" }}
        >
          Send
        </button>
      </div>
    </div>
  );
}

export default ChatInterface;
```

### 5. Error Handling

The API returns specific error responses:

```javascript
// Handle different error types
function handleApiError(error, response) {
  if (response?.status === 401) {
    // Token expired or invalid
    localStorage.removeItem("jwt_token");
    // Redirect to login
    return "Please login again";
  } else if (response?.status === 502) {
    // Ollama connection issue
    return "Ollama service is not available";
  } else if (response?.status === 404) {
    // Model not found
    return "Selected model is not available";
  }
  return error.message || "An error occurred";
}
```

## 🔒 Security Notes

- **JWT tokens expire after 24 hours** by default
- **CORS is configured** for common development origins
- **File uploads are sanitized** with UUID prefixes
- **Path traversal protection** on file downloads

## 🛠️ Configuration

Set these environment variables for customization:

```bash
# Authentication
ADMIN_EMAIL=admin@local
ADMIN_PASSWORD=changeme
SECRET_KEY=your-secret-key-here

# Ollama connection
OLLAMA_URL=http://localhost:11434

# Token expiration (minutes)
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

## 📝 Message Format

### Chat Messages Structure

```json
{
  "role": "user|assistant|system",
  "content": "The actual message content"
}
```

### Streaming Response Chunks

Each chunk contains:

- `model`: Model name
- `created_at`: Timestamp
- `message`: Current message chunk
- `done`: Boolean indicating if streaming is complete
- `done_reason`: Reason for completion ("stop", "length", etc.)
- `total_duration`: Total processing time (when done=true)
- `eval_count`: Number of tokens generated (when done=true)

## 🚨 Important Notes for Frontend Developers

1. **Always handle streaming responses** - The chat endpoint streams data, don't expect a single JSON response
2. **Implement proper error handling** - Network errors, authentication failures, and Ollama connection issues
3. **Store JWT tokens securely** - Use localStorage or secure cookies
4. **Handle token expiration** - Implement automatic re-authentication
5. **Model selection** - Always fetch available models on app start
6. **Loading states** - Show typing indicators during streaming
7. **Message history** - Maintain conversation context in the messages array

## 🧪 Testing the API

Use these curl commands to test:

```bash
# Login
curl -X POST http://127.0.0.1:8000/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@local", "password": "changeme"}'

# Get models (replace TOKEN with actual token)
curl -H "Authorization: Bearer TOKEN" \
  http://127.0.0.1:8000/models

# Chat (replace TOKEN with actual token)
curl -X POST http://127.0.0.1:8000/chat \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"model": "gemma3:4b", "messages": [{"role": "user", "content": "Hello!"}], "stream": true}'
```

This backend is production-ready and handles all the complexity of Ollama integration, authentication, and streaming. The frontend developer just needs to implement the UI and consume these well-defined endpoints.
