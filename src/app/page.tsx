'use client';

import { useEffect, useState, useRef } from 'react';
import { Send, LogOut, MessageSquare, Sparkles, Bot, User, ChevronDown } from 'lucide-react';

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

export default function ModernChatInterface() {
  const [isAuthenticated, setIsAuthenticated] = useState(true); // Set to true for demo
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hello! I\'m your AI assistant. How can I help you today?'
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState('llama2:7b');
  const [models] = useState([
    { name: 'llama2:7b', displayName: 'Llama 2 7B' },
    { name: 'codellama:13b', displayName: 'Code Llama 13B' },
    { name: 'mistral:7b', displayName: 'Mistral 7B' },
    { name: 'phi:2.7b', displayName: 'Phi 2.7B' }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const sendMessage = async () => {
    if (!inputMessage.trim() || !selectedModel || isSending) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsSending(true);

    // Simulate AI response for demo
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you're asking about: "${userMessage.content}". This is a demo response from ${selectedModel}. The interface looks much better now with Shadcn/ui components and smooth animations!`
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsSending(false);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    // router.push('/login');
  };

  const getSelectedModelDisplay = () => {
    const model = models.find(m => m.name === selectedModel);
    return model?.displayName || selectedModel;
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
    return null; // Would redirect to login
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
                {models.map((model) => (
                  <DropdownMenuItem 
                    key={model.name}
                    onClick={() => setSelectedModel(model.name)}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center justify-between w-full">
                      <span>{model.displayName}</span>
                      {model.name === selectedModel && (
                        <Badge variant="secondary" className="text-xs">Active</Badge>
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
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
        <div className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto">
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
                  <div className={`rounded-lg px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                    message.role === 'user' 
                      ? 'bg-gray-200 text-gray-900' 
                      // : 'bg-white border border-gray-200 text-gray-900 shadow-sm'
                      : ''
                  }`}>
                    {message.content}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {/* Minimal Typing Indicator */}
          {isSending && (
            <div className="flex justify-start animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
              </div>
            </div>
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
              Press Enter to send, Shift + Enter for new line • Connected to {getSelectedModelDisplay()}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}