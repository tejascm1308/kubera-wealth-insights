import { useState, useRef, useEffect, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Menu, AlertCircle, RefreshCw, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { useAuth } from '@/contexts/AuthContext';
import { useChatWebSocket, ToolStatus } from '@/hooks/useChatWebSocket';
import { chatsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  chart_url?: string;
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

export default function ChatPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // WebSocket hook
  const handleMessageComplete = useCallback((content: string, metadata?: { chart_url?: string }) => {
    if (!activeChat) return;
    
    setChats(prev =>
      prev.map(chat =>
        chat.id === activeChat
          ? {
              ...chat,
              messages: chat.messages.map((msg, idx) =>
                idx === chat.messages.length - 1 && msg.role === 'assistant'
                  ? { ...msg, content, chart_url: metadata?.chart_url }
                  : msg
              ),
              lastMessage: content.slice(0, 50),
            }
          : chat
      )
    );
  }, [activeChat]);

  const handleWSError = useCallback((error: string) => {
    toast({
      title: 'Connection Error',
      description: error,
      variant: 'destructive',
    });
  }, [toast]);

  const {
    isConnected,
    isStreaming,
    streamingContent,
    toolStatus,
    sendMessage: wsSendMessage,
    reconnect,
  } = useChatWebSocket({
    chatId: activeChat,
    onMessageComplete: handleMessageComplete,
    onError: handleWSError,
  });

  // Load chats from API
  useEffect(() => {
    const loadChats = async () => {
      try {
        const response = await chatsApi.getChats();
        
        const formattedChats: Chat[] = response.chats.map((c) => ({
          id: c.chat_id,
          title: c.chat_name,
          lastMessage: c.last_message || '',
          timestamp: new Date(c.updated_at),
          messages: [],
        }));
        
        setChats(formattedChats);
        
        if (formattedChats.length > 0 && !activeChat) {
          setActiveChat(formattedChats[0].id);
        }
      } catch (error) {
        console.error('Failed to load chats:', error);
        toast({
          title: 'Failed to load chats',
          description: 'Please try refreshing the page.',
          variant: 'destructive',
        });
      } finally {
        setIsLoadingChats(false);
      }
    };

    if (isAuthenticated) {
      loadChats();
    }
  }, [isAuthenticated, toast]);

  // Load chat messages when active chat changes
  useEffect(() => {
    const loadChatMessages = async () => {
      if (!activeChat) return;
      
      const chat = chats.find(c => c.id === activeChat);
      if (chat && chat.messages.length > 0) return;
      
      try {
        const response = await chatsApi.getChat(activeChat);
        
        setChats(prev =>
          prev.map(c =>
            c.id === activeChat
              ? {
                  ...c,
                  messages: response.messages.map((m) => ({
                    id: m.message_id,
                    role: m.role,
                    content: m.content,
                    chart_url: m.metadata?.chart_url,
                  })),
                }
              : c
          )
        );
      } catch (error) {
        console.error('Failed to load chat messages:', error);
      }
    };

    loadChatMessages();
  }, [activeChat, chats]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChat, streamingContent]);

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const currentChat = chats.find((c) => c.id === activeChat);

  const handleNewChat = async () => {
    try {
      const response = await chatsApi.createChat('New Chat');
      
      const newChat: Chat = {
        id: response.chat_id,
        title: response.chat_name,
        lastMessage: '',
        timestamp: new Date(),
        messages: [],
      };
      
      setChats(prev => [newChat, ...prev]);
      setActiveChat(newChat.id);
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast({
        title: 'Failed to create chat',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!activeChat || isStreaming) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };

    setChats(prev =>
      prev.map(chat =>
        chat.id === activeChat
          ? {
              ...chat,
              messages: [...chat.messages, userMessage],
              lastMessage: content.slice(0, 50),
              title: chat.messages.length === 0 ? content.slice(0, 30) : chat.title,
            }
          : chat
      )
    );

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setChats(prev =>
      prev.map(chat =>
        chat.id === activeChat
          ? { ...chat, messages: [...chat.messages, assistantMessage] }
          : chat
      )
    );

    const sent = wsSendMessage(activeChat, content);
    if (!sent) {
      toast({
        title: 'Failed to send message',
        description: 'Not connected. Trying to reconnect...',
        variant: 'destructive',
      });
      reconnect();
    }
  };

  useEffect(() => {
    if (!activeChat || !streamingContent) return;

    setChats(prev =>
      prev.map(chat =>
        chat.id === activeChat
          ? {
              ...chat,
              messages: chat.messages.map((msg, idx) =>
                idx === chat.messages.length - 1 && msg.role === 'assistant'
                  ? { ...msg, content: streamingContent }
                  : msg
              ),
            }
          : chat
      )
    );
  }, [streamingContent, activeChat]);

  const handleRenameChat = async (id: string) => {
    const newTitle = prompt('Enter new chat title:');
    if (!newTitle) return;
    
    try {
      await chatsApi.updateChat(id, { chat_name: newTitle });
      setChats(prev =>
        prev.map(chat =>
          chat.id === id ? { ...chat, title: newTitle } : chat
        )
      );
    } catch (error) {
      console.error('Failed to rename chat:', error);
      toast({
        title: 'Failed to rename chat',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteChat = async (id: string) => {
    if (!confirm('Are you sure you want to delete this chat?')) return;
    
    try {
      await chatsApi.deleteChat(id);
      setChats(prev => prev.filter(chat => chat.id !== id));
      
      if (activeChat === id) {
        const remaining = chats.filter(c => c.id !== id);
        setActiveChat(remaining[0]?.id || null);
      }
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast({
        title: 'Failed to delete chat',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      <div className={cn('transition-all duration-300', sidebarOpen ? 'w-64' : 'w-0')}>
        {sidebarOpen && (
          <ChatSidebar
            chats={chats}
            activeChat={activeChat}
            onSelectChat={setActiveChat}
            onNewChat={handleNewChat}
            onRenameChat={handleRenameChat}
            onDeleteChat={handleDeleteChat}
          />
        )}
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 px-4 border-b border-border flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="font-medium truncate flex-1">{currentChat?.title || 'New Chat'}</h2>
          
          {!isConnected && activeChat && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-warning" />
              <span>Reconnecting...</span>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={reconnect}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Tool Status */}
        {toolStatus.length > 0 && (
          <div className="px-4 py-2 border-b border-border bg-secondary/50">
            {toolStatus.map((tool) => (
              <div key={tool.tool_id} className="flex items-center gap-2 text-sm text-muted-foreground">
                <Wrench className="h-3 w-3 animate-spin" />
                <span>{tool.tool_name.replace(/_/g, ' ')}...</span>
              </div>
            ))}
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
            {isLoadingChats ? (
              <div className="text-center py-20">
                <div className="animate-pulse text-muted-foreground">Loading chats...</div>
              </div>
            ) : currentChat?.messages.length === 0 ? (
              <div className="text-center py-20">
                <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                <p className="text-muted-foreground text-sm">Ask about any Indian stock for detailed analysis</p>
              </div>
            ) : (
              currentChat?.messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  chartUrl={message.chart_url}
                  isStreaming={isStreaming && index === currentChat.messages.length - 1 && message.role === 'assistant'}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        <ChatInput onSend={handleSendMessage} disabled={isStreaming || !isConnected} />
      </div>
    </div>
  );
}
