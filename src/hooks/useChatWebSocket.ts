import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl, getToken } from '@/lib/api';

export interface WSMessage {
  type: string;
  [key: string]: any;
}

export interface ChatWebSocketState {
  isConnected: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
}

interface UseChatWebSocketOptions {
  chatId: string | null;
  onMessageComplete?: (content: string) => void;
  onError?: (error: string) => void;
}

export function useChatWebSocket({ chatId, onMessageComplete, onError }: UseChatWebSocketOptions) {
  const [state, setState] = useState<ChatWebSocketState>({
    isConnected: false,
    isStreaming: false,
    streamingContent: '',
    error: null,
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const streamingContentRef = useRef<string>('');
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!chatId || !getToken()) return;

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const url = getWebSocketUrl(chatId);
    console.log('[WS] Connecting to:', url);
    
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS] Connected');
      reconnectAttemptsRef.current = 0;
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    };

    ws.onmessage = (event) => {
      try {
        const data: WSMessage = JSON.parse(event.data);
        console.log('[WS] Message:', data.type, data);

        switch (data.type) {
          case 'connection':
            console.log('[WS] Connection confirmed:', data.user_id);
            break;

          case 'rate_limit_info':
            console.log('[WS] Rate limits:', data.current_usage, '/', data.limits);
            break;

          case 'message_received':
            console.log('[WS] Message acknowledged');
            break;

          case 'text_chunk':
            streamingContentRef.current += data.content;
            setState(prev => ({
              ...prev,
              isStreaming: true,
              streamingContent: streamingContentRef.current,
            }));
            break;

          case 'tool_executing':
            console.log('[WS] Tool executing:', data.tool_name);
            break;

          case 'tool_complete':
            console.log('[WS] Tool complete:', data.tool_name);
            break;

          case 'tool_error':
            console.error('[WS] Tool error:', data.error);
            break;

          case 'message_complete':
            const finalContent = streamingContentRef.current;
            streamingContentRef.current = '';
            setState(prev => ({
              ...prev,
              isStreaming: false,
              streamingContent: '',
            }));
            onMessageComplete?.(finalContent);
            break;

          case 'rate_limit_exceeded':
            const errorMsg = data.message || 'Rate limit exceeded. Please wait.';
            setState(prev => ({ ...prev, error: errorMsg, isStreaming: false }));
            onError?.(errorMsg);
            break;

          case 'error':
            const errMessage = data.message || 'An error occurred';
            setState(prev => ({ ...prev, error: errMessage, isStreaming: false }));
            onError?.(errMessage);
            break;

          case 'pong':
            // Heartbeat response
            break;
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
      setState(prev => ({ ...prev, isConnected: false }));

      // Attempt reconnection if not intentionally closed
      if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
        reconnectAttemptsRef.current++;
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 30000);
        console.log(`[WS] Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current})`);
        
        reconnectTimeoutRef.current = setTimeout(connect, delay);
      }
    };
  }, [chatId, onMessageComplete, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnect');
      wsRef.current = null;
    }
    setState({
      isConnected: false,
      isStreaming: false,
      streamingContent: '',
      error: null,
    });
  }, []);

  const sendMessage = useCallback((message: string) => {
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
    setState(prev => ({ ...prev, isStreaming: true, streamingContent: '', error: null }));
    
    return true;
  }, [chatId]);

  const sendPing = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'ping' }));
    }
  }, []);

  // Connect when chatId changes
  useEffect(() => {
    if (chatId) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [chatId, connect, disconnect]);

  // Heartbeat
  useEffect(() => {
    if (!state.isConnected) return;

    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [state.isConnected, sendPing]);

  return {
    ...state,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}
