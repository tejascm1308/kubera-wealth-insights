import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl, getToken } from '@/lib/api';

// ==================== TYPES ====================

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface ToolStatus {
  tool_name: string;
  tool_id: string;
  status: 'executing' | 'complete' | 'error';
  timestamp: string;
}

export interface RateLimits {
  current: {
    burst: number;
    per_chat: number;
    hourly: number;
    daily: number;
  };
  limits: {
    burst: number;
    per_chat: number;
    hourly: number;
    daily: number;
  };
}

export interface ChartData {
  chart_url: string;
  chart_symbol: string;
  chart_available: boolean;
}

export interface ChatWebSocketState {
  isConnected: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
  toolStatus: ToolStatus[];
  rateLimits: RateLimits | null;
  rateLimitExceeded: boolean;
  chartData: ChartData | null;
}

interface UseChatWebSocketOptions {
  chatId: string | null;
  onMessageComplete?: (content: string, metadata?: { tokens_used?: number; tools_used?: string[]; chart_url?: string }) => void;
  onError?: (error: string) => void;
  onChartGenerated?: (chartData: ChartData) => void;
  onRateLimitExceeded?: (message: string) => void;
}

// ==================== HOOK ====================

export function useChatWebSocket({
  chatId,
  onMessageComplete,
  onError,
  onChartGenerated,
  onRateLimitExceeded,
}: UseChatWebSocketOptions) {
  const [state, setState] = useState<ChatWebSocketState>({
    isConnected: false,
    isStreaming: false,
    streamingContent: '',
    error: null,
    toolStatus: [],
    rateLimits: null,
    rateLimitExceeded: false,
    chartData: null,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const reconnectAttemptsRef = useRef(0);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastMessageMetadataRef = useRef<{ tokens_used?: number; tools_used?: string[]; chart_url?: string }>({});
  
  const maxReconnectAttempts = 5;
  const reconnectBaseDelay = 3000;

  // ==================== CONNECTION ====================

  const connect = useCallback(() => {
    if (!getToken()) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const url = getWebSocketUrl();
    console.log('[WS] Connecting to:', url);
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      reconnectAttemptsRef.current = 0;
      setState(prev => ({ ...prev, isConnected: true, error: null }));
      
      // Start heartbeat
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        console.log('[WS] Message:', data.type, data);

        switch (data.type) {
          // Connection confirmation
          case 'connection':
            console.log('[WS] Connection confirmed, user:', data.user_id);
            break;

          // Rate limit info
          case 'rate_limit_info':
            setState(prev => ({
              ...prev,
              rateLimits: {
                current: data.current_usage,
                limits: data.limits,
              },
            }));
            break;

          // Message acknowledged by server
          case 'message_received':
            console.log('[WS] Message acknowledged:', data.message_id);
            break;

          // Tool execution started
          case 'tool_executing':
            setState(prev => ({
              ...prev,
              toolStatus: [
                ...prev.toolStatus,
                {
                  tool_name: data.tool_name,
                  tool_id: data.tool_id,
                  status: 'executing',
                  timestamp: data.timestamp,
                },
              ],
            }));
            lastMessageMetadataRef.current.tools_used = [
              ...(lastMessageMetadataRef.current.tools_used || []),
              data.tool_name,
            ];
            break;

          // Tool execution complete
          case 'tool_complete':
            setState(prev => ({
              ...prev,
              toolStatus: prev.toolStatus.map(t =>
                t.tool_name === data.tool_name
                  ? { ...t, status: 'complete' }
                  : t
              ),
            }));
            // Auto-dismiss after 2 seconds
            setTimeout(() => {
              setState(prev => ({
                ...prev,
                toolStatus: prev.toolStatus.filter(t => t.tool_name !== data.tool_name),
              }));
            }, 2000);
            break;

          // Tool error
          case 'tool_error':
            console.error('[WS] Tool error:', data.error);
            setState(prev => ({
              ...prev,
              toolStatus: prev.toolStatus.map(t =>
                t.tool_name === data.tool_name
                  ? { ...t, status: 'error' }
                  : t
              ),
            }));
            break;

          // Streaming text chunk
          case 'text_chunk':
            streamingContentRef.current += data.content;
            setState(prev => ({
              ...prev,
              isStreaming: true,
              streamingContent: streamingContentRef.current,
            }));
            break;

          // Chart generated
          case 'chart_generated':
            if (data.chart_available && data.chart_url) {
              const chartData: ChartData = {
                chart_url: data.chart_url,
                chart_symbol: data.stock_symbol,
                chart_available: true,
              };
              setState(prev => ({ ...prev, chartData }));
              lastMessageMetadataRef.current.chart_url = data.chart_url;
              onChartGenerated?.(chartData);
            }
            break;

          // Message complete
          case 'message_complete':
            const finalContent = streamingContentRef.current;
            const metadata = {
              tokens_used: data.tokens_used,
              tools_used: data.tools_used || lastMessageMetadataRef.current.tools_used,
              chart_url: lastMessageMetadataRef.current.chart_url,
            };
            
            streamingContentRef.current = '';
            lastMessageMetadataRef.current = {};
            
            setState(prev => ({
              ...prev,
              isStreaming: false,
              streamingContent: '',
              toolStatus: [],
              chartData: null,
            }));
            
            onMessageComplete?.(finalContent, metadata);
            break;

          // Rate limit exceeded
          case 'rate_limit_exceeded':
            const errorMsg = data.message || 'Rate limit exceeded. Please wait.';
            setState(prev => ({
              ...prev,
              error: errorMsg,
              isStreaming: false,
              rateLimitExceeded: true,
            }));
            onRateLimitExceeded?.(errorMsg);
            onError?.(errorMsg);
            break;

          // Error
          case 'error':
            const errMessage = data.message || 'An error occurred';
            setState(prev => ({
              ...prev,
              error: errMessage,
              isStreaming: false,
            }));
            onError?.(errMessage);
            break;

          // Pong (heartbeat response)
          case 'pong':
            // Heartbeat acknowledged
            break;

          default:
            console.warn('[WS] Unknown message type:', data.type);
        }
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    };

    ws.onerror = (error) => {
      console.error('[WS] Error:', error);
      setState(prev => ({ ...prev, error: 'Connection error' }));
    };

    ws.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason);
      
      // Clear ping interval
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
      
      setState(prev => ({ ...prev, isConnected: false }));

      // Don't reconnect on intentional close (1000) or if not authenticated
      if (event.code === 1000 || event.code === 4001 || event.code === 4003) {
        return;
      }

      // Attempt reconnection with exponential backoff
      if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(
          reconnectBaseDelay * Math.pow(2, reconnectAttemptsRef.current - 1),
          30000
        );
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
        
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      } else {
        setState(prev => ({
          ...prev,
          error: 'Failed to reconnect. Please refresh the page.',
        }));
        onError?.('Failed to reconnect. Please refresh the page.');
      }
    };
  }, [onMessageComplete, onError, onChartGenerated, onRateLimitExceeded]);

  // ==================== DISCONNECT ====================

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    streamingContentRef.current = '';
    lastMessageMetadataRef.current = {};
    setState({
      isConnected: false,
      isStreaming: false,
      streamingContent: '',
      error: null,
      toolStatus: [],
      rateLimits: null,
      rateLimitExceeded: false,
      chartData: null,
    });
  }, []);

  // ==================== SEND MESSAGE ====================

  const sendMessage = useCallback((chatId: string, message: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('[WS] Cannot send: not connected');
      return false;
    }

    if (!chatId) {
      console.error('[WS] Cannot send: no chat ID');
      return false;
    }

    const payload = {
      type: 'message',
      chat_id: chatId,
      message: message,
    };

    console.log('[WS] Sending:', payload);
    wsRef.current.send(JSON.stringify(payload));
    
    // Reset streaming state
    streamingContentRef.current = '';
    lastMessageMetadataRef.current = {};
    setState(prev => ({
      ...prev,
      isStreaming: true,
      streamingContent: '',
      error: null,
      toolStatus: [],
      chartData: null,
      rateLimitExceeded: false,
    }));
    
    return true;
  }, []);

  // ==================== EFFECTS ====================

  // Connect on mount
  useEffect(() => {
    if (getToken()) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Reconnect when chatId changes (if not connected)
  useEffect(() => {
    if (chatId && !state.isConnected && getToken()) {
      connect();
    }
  }, [chatId, state.isConnected, connect]);

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
