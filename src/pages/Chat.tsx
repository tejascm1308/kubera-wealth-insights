import { useState, useRef, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChatSidebar } from '@/components/chat/ChatSidebar';
import { ChatMessage } from '@/components/chat/ChatMessage';
import { ChatInput } from '@/components/chat/ChatInput';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface Chat {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  messages: Message[];
}

export default function ChatPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [chats, setChats] = useState<Chat[]>([
    {
      id: '1',
      title: 'INFY Stock Analysis',
      lastMessage: 'Based on the fundamentals...',
      timestamp: new Date(),
      messages: [
        { id: '1', role: 'user', content: 'Analyze INFY stock for long-term investment' },
        { id: '2', role: 'assistant', content: 'Based on the fundamentals of Infosys (INFY), here\'s my analysis for long-term investment:\n\n**Strengths:**\n• Strong market position in IT services\n• Consistent dividend payer\n• Robust cash flow generation\n• Digital transformation expertise\n\n**Considerations:**\n• Currency fluctuation exposure\n• Attrition rates\n• Global economic slowdown impact\n\nFor a long-term horizon of 3-5 years, INFY appears to be a solid addition to a diversified portfolio, particularly for investors seeking stable returns with moderate growth.' },
      ],
    },
  ]);
  const [activeChat, setActiveChat] = useState<string | null>('1');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chats, activeChat]);

  if (isLoading) {
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

  const handleNewChat = () => {
    const newChat: Chat = {
      id: Date.now().toString(),
      title: 'New Chat',
      lastMessage: '',
      timestamp: new Date(),
      messages: [],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChat(newChat.id);
  };

  const handleSendMessage = async (content: string) => {
    if (!activeChat) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
    };

    setChats((prev) =>
      prev.map((chat) =>
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

    // Simulate streaming response
    setIsStreaming(true);
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '',
    };

    setChats((prev) =>
      prev.map((chat) =>
        chat.id === activeChat
          ? { ...chat, messages: [...chat.messages, assistantMessage] }
          : chat
      )
    );

    // Simulate streaming text
    const response = `Thank you for your question about "${content.slice(0, 30)}..."\n\nI'm analyzing the relevant market data and fundamentals. Here's what I found:\n\n**Key Insights:**\n• Market sentiment appears positive\n• Technical indicators suggest...\n• Based on your portfolio context...\n\nWould you like me to provide more detailed analysis on any specific aspect?`;
    
    let currentContent = '';
    for (const char of response) {
      await new Promise((resolve) => setTimeout(resolve, 15));
      currentContent += char;
      
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === activeChat
            ? {
                ...chat,
                messages: chat.messages.map((msg) =>
                  msg.id === assistantMessage.id
                    ? { ...msg, content: currentContent }
                    : msg
                ),
              }
            : chat
        )
      );
    }

    setIsStreaming(false);
  };

  const handleRenameChat = (id: string) => {
    const newTitle = prompt('Enter new chat title:');
    if (newTitle) {
      setChats((prev) =>
        prev.map((chat) =>
          chat.id === id ? { ...chat, title: newTitle } : chat
        )
      );
    }
  };

  const handleDeleteChat = (id: string) => {
    if (confirm('Are you sure you want to delete this chat?')) {
      setChats((prev) => prev.filter((chat) => chat.id !== id));
      if (activeChat === id) {
        setActiveChat(chats[0]?.id || null);
      }
    }
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] flex">
      {/* Sidebar */}
      <div
        className={cn(
          'transition-all duration-300',
          sidebarOpen ? 'w-64' : 'w-0'
        )}
      >
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

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat header */}
        <div className="h-12 px-4 border-b border-border flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-4 w-4" />
          </Button>
          <h2 className="font-medium truncate">
            {currentChat?.title || 'New Chat'}
          </h2>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1">
          <div className="max-w-4xl mx-auto px-4 py-6 space-y-4">
            {currentChat?.messages.length === 0 ? (
              <div className="text-center py-20">
                <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
                <p className="text-muted-foreground text-sm">
                  Ask about any Indian stock for detailed analysis
                </p>
              </div>
            ) : (
              currentChat?.messages.map((message, index) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  isStreaming={
                    isStreaming &&
                    index === currentChat.messages.length - 1 &&
                    message.role === 'assistant'
                  }
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input */}
        <ChatInput onSend={handleSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
