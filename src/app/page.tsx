'use client';

import { useEffect, useState, useRef } from 'react';
import { Send, LogOut, MessageSquare, Sparkles, Bot, User, ChevronDown, AlertCircle } from 'lucide-react';

// Shadcn/ui components
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
  details: {
    parent_model: string;
    format: string;
    family: string;
    families: string[];
    parameter_size: string;
    quantization_level: string;
  };
}

interface ModelsResponse {
  models: OllamaModel[];
}

export default function ModernChatInterface() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // API Configuration
  const API_BASE_URL = 'http://127.0.0.1:8000';

  // Authentication functions
  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const token = data.access_token;
      setJwtToken(token);
      localStorage.setItem('jwt_token', token);
      setIsAuthenticated(true);
      setError(null);
      await fetchModels(token);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const getAuthToken = () => {
    return jwtToken || localStorage.getItem('jwt_token');
  };

  // Fetch available models
  const fetchModels = async (token?: string) => {
    try {
      const authToken = token || getAuthToken();
      if (!authToken) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`${API_BASE_URL}/models`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('jwt_token');
          setJwtToken(null);
          setIsAuthenticated(false);
          throw new Error('Authentication expired. Please login again.');
        }
        throw new Error('Failed to fetch models');
      }

      const data: ModelsResponse = await response.json();
      setModels(data.models);
      
      // Auto-select first model if none selected
      if (data.models.length > 0 && !selectedModel) {
        setSelectedModel(data.models[0].name);
      }
      
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to fetch models');
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputMessage]);

  // Initialize authentication and fetch models
  useEffect(() => {
    const initializeApp = async () => {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        setJwtToken(token);
        setIsAuthenticated(true);
        await fetchModels(token);
      }
      setIsLoading(false);
    };

    initializeApp();
  }, []);

  // Streaming chat implementation
  const streamChat = async (model: string, messages: Message[], onChunk: (chunk: any) => void, onComplete: (finalChunk: any) => void, onError: (error: Error) => void) => {
    const token = getAuthToken();
    if (!token) {
      onError(new Error('No authentication token'));
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: messages.map(msg => ({ role: msg.role, content: msg.content })),
          stream: true,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem('jwt_token');
          setJwtToken(null);
          setIsAuthenticated(false);
          onError(new Error('Authentication expired. Please login again.'));
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
              console.warn('Failed to parse chunk:', line, e);
            }
          }
        }
      }
    } catch (error) {
      onError(error instanceof Error ? error : new Error('Unknown error'));
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedModel || isSending) return;

    // Clear any existing errors
    setError(null);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputMessage('');
    setIsSending(true);

    // Add empty assistant message for streaming
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
    };
    setMessages(prev => [...prev, assistantMessage]);

    try {
      await streamChat(
        selectedModel,
        newMessages,
        (chunk) => {
          // Only process chunks that have content and are not done
          if (chunk.message?.content && !chunk.done) {
            // Update the assistant message by appending the new content
            setMessages((prev) => {
              const updated = [...prev];
              const assistantMessageIndex = updated.findIndex(msg => msg.id === assistantMessageId);
              
              if (assistantMessageIndex !== -1) {
                updated[assistantMessageIndex] = {
                  ...updated[assistantMessageIndex],
                  content: updated[assistantMessageIndex].content + chunk.message.content
                };
              }
              
              return updated;
            });
          }
        },
        (finalChunk) => {
          setIsSending(false);
          console.log('Chat completed:', finalChunk);
        },
        (error) => {
          setIsSending(false);
          setError(error.message);
          // Remove the empty assistant message on error
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
        }
      );
    } catch (error) {
      setIsSending(false);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('jwt_token');
    setJwtToken(null);
    setIsAuthenticated(false);
    setModels([]);
    setSelectedModel('');
    setError(null);
  };

  const getSelectedModelDisplay = () => {
    const model = models.find(m => m.name === selectedModel);
    if (model) {
      return `${model.name} (${model.details?.parameter_size || 'Unknown size'})`;
    }
    return selectedModel || 'No model selected';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex items-center space-x-3 text-slate-600">
          <div className="animate-spin w-6 h-6 border-2 border-slate-300 border-t-slate-600 rounded-full"></div>
          <span className="text-lg font-medium">Loading your workspace...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="p-8">
            <div className="text-center space-y-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800">Welcome to Ollama Chat</h2>
                <p className="text-slate-600 mt-2">Sign in to start chatting with your local AI models</p>
              </div>
              
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}
              
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target as HTMLFormElement);
                  const email = formData.get('email') as string;
                  const password = formData.get('password') as string;
                  login(email, password);
                }}
                className="space-y-4"
              >
                <div>
                  <Input
                    type="email"
                    name="email"
                    placeholder="Email"
                    defaultValue="admin@local"
                    required
                    className="w-full"
                  />
                </div>
                <div>
                  <Input
                    type="password"
                    name="password"
                    placeholder="Password"
                    defaultValue="changeme"
                    required
                    className="w-full"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>
              
              <p className="text-xs text-slate-500">
                Default credentials: admin@local / changeme
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-100 flex">
      {/* Sidebar */}
      <div className="w-72 bg-white/80 backdrop-blur-sm border-r border-slate-200/60 flex flex-col shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/60">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Ollama Chat
              </h1>
              <p className="text-xs text-slate-500 font-medium">Local AI Models</p>
            </div>
          </div>
        </div>
        
        {/* Model Selection */}
        <div className="p-6 border-b border-slate-200/60">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
              <Bot className="w-4 h-4" />
              <span>Active Model</span>
            </label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full justify-between hover:bg-slate-50 border-slate-200"
                >
                  <span className="font-medium">{getSelectedModelDisplay()}</span>
                  <ChevronDown className="w-4 h-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-64" align="start">
                {models.length === 0 ? (
                  <DropdownMenuItem disabled>
                    <span className="text-slate-500">No models available</span>
                  </DropdownMenuItem>
                ) : (
                  models.map((model) => (
                    <DropdownMenuItem 
                      key={model.name}
                      onClick={() => setSelectedModel(model.name)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center justify-between w-full">
                        <div className="flex flex-col items-start">
                          <span className="font-medium">{model.name}</span>
                          <span className="text-xs text-slate-500">
                            {model.details?.parameter_size || 'Unknown size'}
                          </span>
                        </div>
                        {model.name === selectedModel && (
                          <Badge variant="secondary" className="text-xs">Active</Badge>
                        )}
                      </div>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Chat History */}
        <div className="flex-1 p-6">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center space-x-2">
              <MessageSquare className="w-4 h-4" />
              <span>Recent Chats</span>
            </h3>
            <div className="space-y-2">
              <Card className="cursor-pointer hover:bg-slate-50/80 transition-colors border-slate-200/60">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-slate-700 truncate">Previous conversation</p>
                  <p className="text-xs text-slate-500 mt-1">2 hours ago</p>
                </CardContent>
              </Card>
              <Card className="cursor-pointer hover:bg-slate-50/80 transition-colors border-slate-200/60">
                <CardContent className="p-3">
                  <p className="text-sm font-medium text-slate-700 truncate">Code review discussion</p>
                  <p className="text-xs text-slate-500 mt-1">Yesterday</p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
        
        {/* Logout */}
        <div className="p-6 border-t border-slate-200/60">
          <Button 
            variant="ghost" 
            onClick={handleLogout}
            className="w-full justify-start text-slate-600 hover:text-slate-800 hover:bg-slate-100/80"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 w-4xl mx-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500" />
              <div>
                <p className="text-red-700 font-medium">Connection Error</p>
                <p className="text-red-600 text-sm">{error}</p>
              </div>
            </div>
          )}
          
          {messages.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4 max-w-md">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800">Start a conversation</h2>
                <p className="text-slate-600">Ask me anything, and I'll help you with information, analysis, or creative tasks.</p>
              </div>
            </div>
          ) : (
            messages.map((message, index) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in py-4 slide-in-from-bottom-4 duration-500`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className={`flex justify-start`}>
                  {/* Message */}
                  <div className={`rounded-lg px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap max-w-3xl ${
                    message.role === 'user' 
                      ? 'bg-gray-200 text-gray-900' 
                      : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                  }`}>
                    {message.content}
                    {message.role === 'assistant' && message.content === '' && isSending && (
                      <span className="text-gray-400 italic">Generating response...</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-gray-200">
          <div className="max-w-4xl mx-auto">
            <div className="bg-gray-100 rounded-lg px-4 py-3">
              <div className="flex items-center space-x-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything"
                    className="w-full resize-none border-0 bg-transparent placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-0 text-sm leading-relaxed py-1 px-0 min-h-[20px] max-h-[120px]"
                    rows={1}
                    disabled={isSending}
                  />
                </div>
                
                <Button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isSending}
                  size="sm"
                  className="bg-gray-600 hover:bg-gray-700 text-white h-8 w-8 p-0 rounded-full"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
            
            <p className="text-xs text-gray-500 text-center mt-2">
              Press Enter to send, Shift + Enter for new line • {models.length > 0 ? `Connected to ${getSelectedModelDisplay()}` : 'No models available'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}