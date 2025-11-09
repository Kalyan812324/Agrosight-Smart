import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export const useAIAssistant = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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

      if (!response.ok || !response.body) {
        throw new Error('Failed to start AI stream');
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
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: assistantContent, 
        timestamp: new Date() 
      }]);

      onDone();
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('AI streaming error:', error);
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
  };

  return {
    messages,
    isLoading,
    streamChat,
    stopGeneration,
    clearMessages,
  };
};
