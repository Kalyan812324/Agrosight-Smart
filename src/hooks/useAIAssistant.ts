import { useState, useRef } from 'react';
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

  const streamChat = async (
    userMessage: string,
    language: 'english' | 'telugu',
    onDelta: (deltaText: string) => void,
    onDone: () => void
  ) => {
    const newMessages = [...messages, { role: 'user' as const, content: userMessage, timestamp: new Date() }];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    abortControllerRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
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
        setError(errorMsg);
        toast.error(errorMsg);
        onDone();
        return;
      }

      if (response.status === 402) {
        const errorMsg = 'AI credits exhausted. Please add credits to your workspace.';
        setError(errorMsg);
        toast.error(errorMsg);
        onDone();
        return;
      }

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error || 'Failed to connect to AI assistant';
        setError(errorMsg);
        toast.error(errorMsg);
        onDone();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;
      let assistantContent = '';

      while (!streamDone) {
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
            if (content) {
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
      if (assistantContent) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: assistantContent, 
          timestamp: new Date() 
        }]);
      }

      onDone();
    } catch (error: unknown) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('AI streaming error:', error);
        const errorMsg = 'Connection error. Please check your network and try again.';
        setError(errorMsg);
        toast.error(errorMsg);
        onDone();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopGeneration = () => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  };

  const clearMessages = () => {
    setMessages([]);
    setError(null);
  };

  return {
    messages,
    isLoading,
    error,
    streamChat,
    stopGeneration,
    clearMessages,
  };
};
