import React, { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Volume2, VolumeX, Languages, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import '../types/speech.d.ts';

interface VoiceAssistantProps {
  className?: string;
}

type Language = 'en' | 'te';
type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

interface Message {
  id: string;
  text: string;
  language: Language;
  timestamp: Date;
  type: 'user' | 'assistant';
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ className = '' }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const { toast } = useToast();

  const languageConfig = {
    en: {
      name: 'English',
      flag: '🇺🇸',
      speechLang: 'en-US',
      greetings: [
        'Hello! I\'m your AgroSight assistant. How can I help you with farming today?',
        'Hi there! Ask me about crop yields, market prices, or farming loans.',
        'Welcome to AgroSight! I\'m here to assist with your agricultural questions.'
      ]
    },
    te: {
      name: 'Telugu',
      flag: '🇮🇳',
      speechLang: 'te-IN',
      greetings: [
        'నమస్కారం! నేను మీ అగ్రోసైట్ అసిస్టెంట్. ఈ రోజు వ్యవసాయంలో ఎలా సహాయం చేయగలను?',
        'హలో! పంట దిగుబడులు, మార్కెట్ ధరలు లేదా వ్యవసాయ రుణాల గురించి అడగండి.',
        'అగ్రోసైట్‌కు స్వాగతం! మీ వ్యవసాయ ప్రశ్నలతో సహాయం చేయడానికి నేను ఇక్కడ ఉన్నాను.'
      ]
    }
  };

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      
      if (recognitionRef.current) {
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = languageConfig[currentLanguage].speechLang;
        
        recognitionRef.current.onstart = () => {
          setIsListening(true);
          setConversationState('listening');
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
          if (conversationState === 'listening') {
            setConversationState('idle');
          }
        };
        
        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          handleUserInput(transcript);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          setConversationState('idle');
          toast({
            title: "Speech Recognition Error",
            description: "Could not process your speech. Please try again.",
            variant: "destructive"
          });
        };
      }
    } else {
      toast({
        title: "Speech Recognition Not Supported",
        description: "Your browser doesn't support speech recognition.",
        variant: "destructive"
      });
    }

    // Initialize speech synthesis
    synthRef.current = window.speechSynthesis;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      if (synthRef.current) {
        synthRef.current.cancel();
      }
    };
  }, [currentLanguage]);

  // Update language when changed
  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = languageConfig[currentLanguage].speechLang;
    }
  }, [currentLanguage]);

  const startListening = async () => {
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      if (recognitionRef.current && !isListening) {
        recognitionRef.current.start();
      }
    } catch (error) {
      console.error('Microphone access denied:', error);
      toast({
        title: "Microphone Access Required",
        description: "Please allow microphone access to use voice features.",
        variant: "destructive"
      });
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleUserInput = async (transcript: string) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: transcript,
      language: currentLanguage,
      timestamp: new Date(),
      type: 'user'
    };
    
    setMessages(prev => [...prev, userMessage]);
    setConversationState('processing');
    
    // Process the input and generate response
    const response = await generateResponse(transcript, currentLanguage);
    
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      text: response,
      language: currentLanguage,
      timestamp: new Date(),
      type: 'assistant'
    };
    
    setMessages(prev => [...prev, assistantMessage]);
    
    // Speak the response
    await speakText(response, currentLanguage);
    setConversationState('idle');
  };

  const generateResponse = async (input: string, language: Language): Promise<string> => {
    // Simple rule-based responses for demo
    // In production, this would connect to OpenAI or similar AI service
    const lowerInput = input.toLowerCase();
    
    if (language === 'en') {
      if (lowerInput.includes('yield') || lowerInput.includes('crop')) {
        return "I can help you predict crop yields. Would you like to use our Yield Predictor tool? I can guide you through entering your crop details, soil conditions, and weather data.";
      } else if (lowerInput.includes('price') || lowerInput.includes('market')) {
        return "I can provide market price forecasts for your crops. Our Market Forecast tool analyzes current trends and predicts future prices. What crop are you interested in?";
      } else if (lowerInput.includes('loan') || lowerInput.includes('finance')) {
        return "I can help you calculate agricultural loans. Our Loan Calculator can determine your eligibility and monthly payments. What type of loan are you looking for?";
      } else if (lowerInput.includes('weather')) {
        return "Weather is crucial for farming. I recommend checking our weather integration features that provide detailed forecasts for your location.";
      } else {
        return "I'm here to help with your agricultural needs. You can ask me about crop yields, market prices, loans, or weather forecasts. How can I assist you today?";
      }
    } else {
      // Telugu responses
      if (lowerInput.includes('దిగుబడి') || lowerInput.includes('పంట')) {
        return "నేను పంట దిగుబడులను అంచనా వేయడంలో సహాయం చేయగలను. మా యీల్డ్ ప్రిడిక్టర్ టూల్‌ను ఉపయోగించాలనుకుంటున్నారా? మీ పంట వివరాలు, మట్టి పరిస్థితులు మరియు వాతావరణ డేటాను నమోదు చేయడంలో నేను మిమ్మల్ని మార్గనిర్దేశం చేయగలను.";
      } else if (lowerInput.includes('ధర') || lowerInput.includes('మార్కెట్')) {
        return "నేను మీ పంటలకు మార్కెట్ ధర అంచనాలను అందించగలను. మా మార్కెట్ ఫోర్‌కాస్ట్ టూల్ ప్రస్తుత ట్రెండ్‌లను విశ్లేషిస్తుంది మరియు భవిష్యత్ ధరలను అంచనా వేస్తుంది. మీకు ఏ పంట అవసరం?";
      } else if (lowerInput.includes('రుణం') || lowerInput.includes('ఫైనాన్స్')) {
        return "నేను వ్యవసాయ రుణాలను లెక్కించడంలో సహాయం చేయగలను. మా లోన్ కాలిక్యులేటర్ మీ అర్హత మరియు నెలవారీ చెల్లింపులను నిర్ణయించగలదు. మీకు ఎలాంటి రుణం కావాలి?";
      } else if (lowerInput.includes('వాతావరణం')) {
        return "వ్యవసాయానికి వాతావరణం చాలా ముఖ్యమైనది. మీ ప్రాంతానికి వివరణాత్మక అంచనాలను అందించే మా వాతావరణ ఇంటిగ్రేషన్ ఫీచర్లను తనిఖీ చేయాలని నేను సిఫార్సు చేస్తున్నాను.";
      } else {
        return "నేను మీ వ్యవసాయ అవసరాలతో సహాయం చేయడానికి ఇక్కడ ఉన్నాను. మీరు పంట దిగుబడులు, మార్కెట్ ధరలు, రుణాలు లేదా వాతావరణ అంచనాల గురించి అడగవచ్చు. ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?";
      }
    }
  };

  const speakText = async (text: string, language: Language): Promise<void> => {
    return new Promise((resolve) => {
      if (synthRef.current) {
        setIsSpeaking(true);
        setConversationState('speaking');
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageConfig[language].speechLang;
        utterance.rate = 0.9;
        utterance.pitch = 1;
        
        utterance.onend = () => {
          setIsSpeaking(false);
          setConversationState('idle');
          resolve();
        };
        
        utterance.onerror = () => {
          setIsSpeaking(false);
          setConversationState('idle');
          resolve();
        };
        
        synthRef.current.speak(utterance);
      } else {
        resolve();
      }
    });
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const stopSpeaking = () => {
    if (synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
      setConversationState('idle');
    }
  };

  const startGreeting = async () => {
    const greetings = languageConfig[currentLanguage].greetings;
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    
    const greetingMessage: Message = {
      id: Date.now().toString(),
      text: randomGreeting,
      language: currentLanguage,
      timestamp: new Date(),
      type: 'assistant'
    };
    
    setMessages(prev => [...prev, greetingMessage]);
    await speakText(randomGreeting, currentLanguage);
  };

  const getStateIcon = () => {
    switch (conversationState) {
      case 'listening':
        return <Mic className="h-5 w-5 animate-pulse text-red-500" />;
      case 'processing':
        return <Settings className="h-5 w-5 animate-spin text-blue-500" />;
      case 'speaking':
        return <Volume2 className="h-5 w-5 animate-pulse text-green-500" />;
      default:
        return <MicOff className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <Card className={`w-full max-w-md ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Languages className="h-5 w-5" />
          Voice Assistant
          <Badge variant="secondary" className="ml-auto">
            {languageConfig[currentLanguage].flag} {languageConfig[currentLanguage].name}
          </Badge>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Language Selection */}
        <div className="flex items-center gap-2">
          <Select value={currentLanguage} onValueChange={(value: Language) => setCurrentLanguage(value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">🇺🇸 English</SelectItem>
              <SelectItem value="te">🇮🇳 Telugu</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={toggleListening}
            disabled={conversationState === 'processing' || conversationState === 'speaking'}
            variant={isListening ? "destructive" : "default"}
            className="flex-1"
          >
            {getStateIcon()}
            {isListening ? "Stop" : "Listen"}
          </Button>
          
          <Button
            onClick={stopSpeaking}
            disabled={!isSpeaking}
            variant="outline"
            size="icon"
          >
            <VolumeX className="h-4 w-4" />
          </Button>
          
          <Button
            onClick={startGreeting}
            disabled={conversationState !== 'idle'}
            variant="outline"
            size="icon"
          >
            <Volume2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Display */}
        <div className="text-center">
          <Badge variant={conversationState === 'idle' ? 'secondary' : 'default'}>
            {conversationState === 'idle' && 'Ready to help'}
            {conversationState === 'listening' && 'Listening...'}
            {conversationState === 'processing' && 'Processing...'}
            {conversationState === 'speaking' && 'Speaking...'}
          </Badge>
        </div>

        {/* Recent Messages */}
        {messages.length > 0 && (
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {messages.slice(-3).map((message) => (
              <div
                key={message.id}
                className={`text-sm p-2 rounded ${
                  message.type === 'user'
                    ? 'bg-primary text-primary-foreground ml-4'
                    : 'bg-muted mr-4'
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
        )}

        {/* Setup Notice */}
        {!isConfigured && (
          <div className="text-xs text-muted-foreground text-center">
            Note: For enhanced AI responses, connect to Supabase and configure OpenAI integration.
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default VoiceAssistant;