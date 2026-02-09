import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useAIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // Abort any ongoing requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Safe state setter that checks if component is still mounted
  const safeSetState = useCallback(<T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: React.SetStateAction<T>) => {
    if (isMountedRef.current) {
      setter(value);
    }
  }, []);

  const streamChat = useCallback(async (
    userMessage: string,
    language: 'english' | 'telugu',
    onDelta: (deltaText: string) => void,
    onDone: () => void
  ) => {
    // Validate input
    if (!userMessage?.trim()) {
      onDone();
      return;
    }

    const newMessages = [...messages, { role: 'user' as const, content: userMessage, timestamp: new Date() }];
    safeSetState(setMessages, newMessages);
    safeSetState(setIsLoading, true);
    safeSetState(setError, null);

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      
      if (!supabaseUrl) {
        throw new Error('Supabase configuration missing');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || publishableKey}`,
          },
          body: JSON.stringify({
            messages: newMessages.map(m => ({ role: m.role, content: m.content })),
            language,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      // Handle specific error codes
      if (response.status === 429) {
        const errorMsg = 'Rate limit exceeded. Please wait a moment and try again.';
        safeSetState(setError, errorMsg);
        toast.error(errorMsg);
        onDone();
        return;
      }

      if (response.status === 402) {
        const errorMsg = 'AI credits exhausted. Please add credits to your workspace.';
        safeSetState(setError, errorMsg);
        toast.error(errorMsg);
        onDone();
        return;
      }

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Failed to connect to AI assistant';
        safeSetState(setError, errorMsg);
        toast.error(errorMsg);
        onDone();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let assistantContent = '';

      while (!streamDone && isMountedRef.current) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') {
            streamDone = true;
            break;
          }

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content && isMountedRef.current) {
              assistantContent += content;
              onDelta(content);
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Add complete assistant message
      if (assistantContent && isMountedRef.current) {
        setMessages(prev => [...prev, { 
          role: 'assistant' as const, 
          content: assistantContent, 
          timestamp: new Date() 
        }]);
      }

      onDone();
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Request was intentionally aborted, don't show error
        return;
      }
      
      console.error('AI streaming error:', error);
      const errorMsg = 'Connection error. Please check your network and try again.';
      safeSetState(setError, errorMsg);
      toast.error(errorMsg);
      onDone();
    } finally {
      safeSetState(setIsLoading, false);
    }
  }, [messages, safeSetState]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    safeSetState(setIsLoading, false);
  }, [safeSetState]);

  const clearMessages = useCallback(() => {
    safeSetState(setMessages, []);
    safeSetState(setError, null);
  }, [safeSetState]);

  return {
    messages,
    isLoading,
    error,
    streamChat,
    stopGeneration,
    clearMessages,
  };
};
