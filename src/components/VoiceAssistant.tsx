import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Globe, MessageSquare, Loader2, Send, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAIAssistant } from '@/hooks/useAIAssistant';
import { cn } from '@/lib/utils';

interface VoiceAssistantProps {
  className?: string;
}

type Language = 'english' | 'telugu';

enum ConversationState {
  IDLE = 'idle',
  LISTENING = 'listening',
  PROCESSING = 'processing',
  SPEAKING = 'speaking'
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ className }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('english');
  const [conversationState, setConversationState] = useState<ConversationState>(ConversationState.IDLE);
  const [speechRate, setSpeechRate] = useState(1.0);
  const [speechPitch, setSpeechPitch] = useState(1.4); // Higher default pitch for feminine voice
  const [inputText, setInputText] = useState('');
  const [streamingText, setStreamingText] = useState('');
  
  const { messages, isLoading, error, streamChat, stopGeneration, clearMessages } = useAIAssistant();
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const languageConfig = {
    english: {
      name: 'English',
      flag: '🇺🇸',
      speechLang: 'en-US',
      greeting: 'Hello! I am AgroSight Ultra AI - your smart farming assistant. Ask me about weather forecasts, crop yields, market prices, loan calculations, or farm expense analysis. I have access to your data for personalized insights!'
    },
    telugu: {
      name: 'తెలుగు',
      flag: '🇮🇳',
      speechLang: 'te-IN',
      greeting: 'నమస్కారం! నేను AgroSight Ultra AI - మీ స్మార్ట్ వ్యవసాయ సహాయకుడు. వాతావరణ అంచనాలు, పంట దిగుబడులు, మార్కెట్ ధరలు, రుణ లెక్కింపులు లేదా వ్యయ విశ్లేషణ గురించి అడగండి. వ్యక్తిగత సూచనల కోసం నాకు మీ డేటా యాక్సెస్ ఉంది!'
    }
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Initialize speech recognition and synthesis
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = languageConfig[currentLanguage].speechLang;
        
        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          handleUserInput(transcript);
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setConversationState(ConversationState.IDLE);
          toast.error('Voice recognition error. Please try again.');
        };
        
        recognition.onend = () => {
          setIsListening(false);
        };
        
        recognitionRef.current = recognition;
      }

      if ('speechSynthesis' in window) {
        synthRef.current = window.speechSynthesis;
        const loadVoices = () => {
          voicesRef.current = synthRef.current?.getVoices() || [];
        };
        loadVoices();
        if (synthRef.current) {
          synthRef.current.onvoiceschanged = loadVoices;
        }
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [currentLanguage]);

  const startListening = async () => {
    try {
      if (recognitionRef.current && !isListening) {
        recognitionRef.current.lang = languageConfig[currentLanguage].speechLang;
        recognitionRef.current.start();
        setIsListening(true);
        setConversationState(ConversationState.LISTENING);
      }
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      toast.error('Failed to start listening');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setConversationState(ConversationState.IDLE);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleUserInput = async (input: string) => {
    if (!input.trim()) return;
    
    setConversationState(ConversationState.PROCESSING);
    setStreamingText('');
    
    try {
      let fullResponse = '';
      
      await streamChat(
        input,
        currentLanguage,
        (deltaText) => {
          fullResponse += deltaText;
          setStreamingText(prev => prev + deltaText);
        },
        () => {
          setConversationState(ConversationState.IDLE);
          if (!isMuted && fullResponse) {
            speakText(fullResponse, currentLanguage);
          }
          setStreamingText('');
        }
      );
    } catch (error) {
      console.error('Error generating response:', error);
      setConversationState(ConversationState.IDLE);
      toast.error('Failed to process your request');
      setStreamingText('');
    }
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      handleUserInput(inputText);
      setInputText('');
    }
  };

  const speakText = async (text: string, language: Language) => {
    if (!synthRef.current || isMuted) return;

    // Cancel any ongoing speech
    synthRef.current.cancel();
    
    setIsSpeaking(true);
    setConversationState(ConversationState.SPEAKING);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageConfig[language].speechLang;
    utterance.rate = speechRate;
    // Use higher pitch for feminine/cute voice (minimum 1.3)
    utterance.pitch = Math.max(speechPitch, 1.3);

    // Get all available voices for the language
    const langCode = languageConfig[language].speechLang;
    const langPrefix = langCode.split('-')[0];
    
    const allVoices = voicesRef.current;
    const langVoices = allVoices.filter(
      voice => voice.lang.startsWith(langPrefix) || voice.lang === langCode
    );
    
    // Female voice name patterns (comprehensive list for different browsers/OS)
    const femalePatterns = [
      'female', 'woman', 'girl',
      // English female voices
      'samantha', 'victoria', 'karen', 'zira', 'hazel', 'susan', 'fiona',
      'moira', 'tessa', 'veena', 'kate', 'catherine', 'allison', 'ava',
      'nicky', 'siri female', 'cortana',
      // Indian/Telugu female voices  
      'heera', 'priya', 'shruti', 'lekha', 'swara', 'aditi', 'raveena',
      // Google voices
      'google uk english female', 'google us english female',
      // Microsoft voices
      'microsoft zira', 'microsoft hazel', 'microsoft susan', 'microsoft heera'
    ];

    // Find a female voice
    let selectedVoice = langVoices.find(voice => {
      const name = voice.name.toLowerCase();
      return femalePatterns.some(pattern => name.includes(pattern));
    });

    // If no female voice found in language-specific voices, try all voices
    if (!selectedVoice) {
      selectedVoice = allVoices.find(voice => {
        const name = voice.name.toLowerCase();
        return femalePatterns.some(pattern => name.includes(pattern));
      });
    }

    // Fallback to language voice with high pitch
    if (!selectedVoice && langVoices.length > 0) {
      selectedVoice = langVoices[0];
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log('Selected voice:', selectedVoice.name, 'Lang:', selectedVoice.lang);
    }

    utterance.onend = () => {
      setIsSpeaking(false);
      setConversationState(ConversationState.IDLE);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setConversationState(ConversationState.IDLE);
    };

    synthRef.current.speak(utterance);
  };

  const getStateIcon = () => {
    switch (conversationState) {
      case ConversationState.LISTENING:
        return <Mic className="h-4 w-4 animate-pulse text-primary" />;
      case ConversationState.PROCESSING:
        return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
      case ConversationState.SPEAKING:
        return <Volume2 className="h-4 w-4 animate-pulse text-primary" />;
      default:
        return null;
    }
  };

  return (
    <Card className={cn("w-full max-w-2xl flex flex-col", className)} style={{ height: '600px' }}>
      <CardHeader className="border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            AgroSight Ultra AI Assistant
          </div>
          {messages.length > 0 && (
            <Button
              onClick={clearMessages}
              variant="ghost"
              size="sm"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
        
        {/* Language Selection */}
        <div className="flex items-center gap-2 mt-2">
          <Globe className="h-4 w-4" />
          <Select value={currentLanguage} onValueChange={(value) => setCurrentLanguage(value as Language)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(languageConfig).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  <span className="flex items-center gap-2">
                    <span>{config.flag}</span>
                    <span>{config.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {/* Error Display */}
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-2 text-sm border-b border-destructive/20">
            {error}
          </div>
        )}

        {/* Messages Area */}
        <ScrollArea className="flex-1 p-4">
          <div className="space-y-4">
            {messages.length === 0 && !streamingText && (
              <div className="text-center text-muted-foreground p-8">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">{languageConfig[currentLanguage].greeting}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <button
                    onClick={() => handleUserInput("What's the weather forecast for my region?")}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    🌤️ Weather Forecast
                  </button>
                  <button
                    onClick={() => handleUserInput("What are current mandi prices for rice?")}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    💰 Market Prices
                  </button>
                  <button
                    onClick={() => handleUserInput("Analyze my crop yield predictions")}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    🌾 Yield Analysis
                  </button>
                  <button
                    onClick={() => handleUserInput("Calculate EMI for ₹5 lakh farm loan at 7% for 5 years")}
                    className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                  >
                    🏦 Loan Calculator
                  </button>
                </div>
              </div>
            )}
            
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-2",
                  msg.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-xs opacity-70 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
            
            {streamingText && (
              <div className="flex gap-2 justify-start">
                <div className="max-w-[80%] rounded-lg p-3 bg-muted">
                  <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
                  <Loader2 className="h-3 w-3 animate-spin mt-1" />
                </div>
              </div>
            )}
            
            {isLoading && !streamingText && (
              <div className="flex gap-2 justify-start">
                <div className="rounded-lg p-3 bg-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Input Area */}
        <div className="border-t p-4 space-y-3">
          {/* Voice and Audio Controls */}
          <div className="flex gap-2">
            <Button
              onClick={toggleListening}
              variant={isListening ? "destructive" : "outline"}
              size="sm"
            >
              {isListening ? (
                <>
                  <MicOff className="h-4 w-4 mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4 mr-2" />
                  Voice
                </>
              )}
            </Button>
            
            <Button
              onClick={() => setIsMuted(!isMuted)}
              variant={isMuted ? "outline" : "secondary"}
              size="sm"
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>

            {conversationState !== ConversationState.IDLE && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-2">
                {getStateIcon()}
                <span className="capitalize">{conversationState}</span>
              </div>
            )}
          </div>

          {/* Text Input */}
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder={currentLanguage === 'telugu' ? 'ఇక్కడ టైప్ చేయండి...' : 'Type your message...'}
              disabled={isLoading}
              className="flex-1"
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputText.trim() || isLoading}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          {/* Speech Controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Rate</span>
                <span>{speechRate.toFixed(1)}x</span>
              </div>
              <Slider
                value={[speechRate]}
                onValueChange={([value]) => setSpeechRate(value)}
                min={0.5}
                max={2}
                step={0.1}
              />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span>Pitch</span>
                <span>{speechPitch.toFixed(1)}</span>
              </div>
              <Slider
                value={[speechPitch]}
                onValueChange={([value]) => setSpeechPitch(value)}
                min={0.5}
                max={2}
                step={0.1}
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceAssistant;
