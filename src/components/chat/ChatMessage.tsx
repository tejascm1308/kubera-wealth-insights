import { cn } from '@/lib/utils';

interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  chartUrl?: string;
  isStreaming?: boolean;
}

export function ChatMessage({ role, content, chartUrl, isStreaming }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div className={cn('flex w-full animate-fade-in', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] px-4 py-3 rounded-lg font-raleway chat-message',
          isUser ? 'bg-user-bubble text-user-bubble-foreground' : 'bg-bot-bubble text-bot-bubble-foreground'
        )}
      >
        <p className="text-sm leading-relaxed whitespace-pre-wrap">
          {content}
          {isStreaming && (
            <span className="inline-flex ml-1">
              <span className="w-1 h-1 rounded-full bg-current animate-typing" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-typing ml-0.5" style={{ animationDelay: '200ms' }} />
              <span className="w-1 h-1 rounded-full bg-current animate-typing ml-0.5" style={{ animationDelay: '400ms' }} />
            </span>
          )}
        </p>
        
        {/* Chart Embed */}
        {chartUrl && (
          <div className="mt-3">
            <iframe
              src={chartUrl}
              width="100%"
              height="400"
              frameBorder="0"
              className="rounded-md border border-border"
              title="Stock Chart"
            />
          </div>
        )}
      </div>
    </div>
  );
}
