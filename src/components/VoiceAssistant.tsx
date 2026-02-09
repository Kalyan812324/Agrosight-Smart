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
  const [speechRate, setSpeechRate] = useState(0.82);
  const [speechPitch, setSpeechPitch] = useState(1.25); // Cute, sweet feminine pitch
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

  // FREE GOOGLE TTS - Perfect Telugu pronunciation with natural female voice
  const speakWithGoogleTTS = async (text: string, language: Language) => {
    try {
      setIsSpeaking(true);
      setConversationState(ConversationState.SPEAKING);

      console.log(`Using Google TTS for ${language}: "${text.slice(0, 50)}..."`);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-tts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text, language }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Google TTS failed:', response.status, errorText);
        throw new Error(`Google TTS failed: ${response.status}`);
      }

      const audioBlob = await response.blob();
      
      if (audioBlob.size === 0) {
        throw new Error('Empty audio response');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      // Slightly faster playback for natural flow
      audio.playbackRate = language === 'telugu' ? 1.0 : 1.05;
      
      audio.onended = () => {
        setIsSpeaking(false);
        setConversationState(ConversationState.IDLE);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = (e) => {
        console.error('Audio playback error:', e);
        setIsSpeaking(false);
        setConversationState(ConversationState.IDLE);
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
      console.log('Google TTS audio playing successfully');
    } catch (error) {
      console.error('Google TTS error, falling back to browser TTS:', error);
      // Fallback to browser TTS if Google fails - text is already sanitized in speakText
      speakWithBrowser(text, language);
    }
  };

  // ULTIMATE FEMALE VOICE SELECTION - Beautiful cute 20-year-old South Indian goddess voice
  const pickFemaleVoice = (language: Language): SpeechSynthesisVoice | null => {
    const allVoices = voicesRef.current;
    
    // Console log available voices for debugging
    console.log('Available voices:', allVoices.map(v => `${v.name} (${v.lang})`));
    
    // ABSOLUTE MALE VOICE BLACKLIST - Block every possible male voice name
    const malePatterns = [
      // Common English male names
      'david', 'james', 'daniel', 'mark', 'alex', 'fred', 'thomas', 'guy', 'rishi',
      'aaron', 'albert', 'bruce', 'charles', 'gordon', 'jacques', 'jorge', 'lee',
      'luca', 'oliver', 'reed', 'rocko', 'sandy', 'shelley', 'tom', 'grandpa',
      'eddy', 'ralph', 'junior', 'evan', 'neel', 'ravi', 'kumar', 'martin', 'arthur',
      // Gender indicators
      'male', 'masculine', 'man', 'boy', 'sir', 'mr', 'gentleman', 'guy', 'dude',
      // Extended male names A-Z
      'adam', 'adrian', 'andrew', 'anthony', 'benjamin', 'brian', 'caleb', 'carl',
      'chris', 'christopher', 'craig', 'darren', 'derek', 'dmitri', 'dominic',
      'donald', 'douglas', 'edward', 'elliott', 'eric', 'eugene', 'felipe', 'frank',
      'gabriel', 'george', 'gerald', 'grant', 'gregory', 'hans', 'harry', 'henry',
      'hugo', 'ian', 'ivan', 'jack', 'jason', 'jeff', 'jerome', 'joel', 'john',
      'jonathan', 'joseph', 'juan', 'keith', 'kenneth', 'kevin', 'larry', 'leonard',
      'logan', 'louis', 'lucas', 'luis', 'marcus', 'mario', 'matthew', 'michael',
      'nathan', 'neil', 'nicholas', 'oscar', 'patrick', 'paul', 'peter', 'philip',
      'rafael', 'raymond', 'richard', 'robert', 'roger', 'ronald', 'ryan', 'samuel',
      'scott', 'sean', 'simon', 'stephen', 'steven', 'stuart', 'theodore', 'timothy',
      'tony', 'trevor', 'tyler', 'victor', 'vincent', 'walter', 'wayne', 'william',
      'zachary', 'albert', 'rocko', 'reed', 'bad news', 'good news', 'zarvox',
      // Indian male names
      'suresh', 'mahesh', 'ganesh', 'ramesh', 'naresh', 'rajesh', 'dinesh', 'mukesh',
      'rakesh', 'anil', 'sunil', 'vijay', 'ajay', 'sanjay', 'vinay', 'akash', 'vikram',
      'deepak', 'prakash', 'mohan', 'sohan', 'rohan', 'kiran', 'arun', 'varun', 'tarun',
      'naveen', 'praveen', 'sravan', 'krishna', 'venkat', 'srini', 'raju', 'babu',
      // System/novelty voices to block
      'trinoids', 'organ', 'superstar', 'zarvox', 'bahh', 'boing', 'bubbles', 'cellos',
      'whisper', 'wobble', 'bells', 'deranged', 'hysterical', 'grandma', 'grandpa'
    ];
    
    // BEAUTIFUL FEMALE VOICE WHITELIST - Prefer these gorgeous voices
    const femaleGoddessVoices = [
      // Premium Indian female voices (South Indian goddess quality)
      'priya', 'anjali', 'neerja', 'riya', 'meera', 'heera', 'kalpana', 'veena',
      'kavya', 'divya', 'shreya', 'tanvi', 'pooja', 'neha', 'swati', 'rani', 'devi',
      'lakshmi', 'saraswati', 'gayatri', 'ananya', 'aditi', 'isha', 'aishwarya',
      // Premium English female voices
      'samantha', 'karen', 'allison', 'zira', 'victoria', 'fiona', 'moira', 'tessa',
      'kate', 'catherine', 'emma', 'emily', 'susan', 'linda', 'sarah', 'alice',
      'anna', 'joana', 'ioana', 'paulina', 'helena', 'sara', 'laura', 'ellen',
      'monica', 'lucia', 'siri', 'cortana', 'alexa',
      // Gender indicators for female
      'female', 'woman', 'girl', 'lady', 'feminine', 'miss', 'ms'
    ];
    
    // Check if voice name contains ANY male pattern
    const isMaleVoice = (voice: SpeechSynthesisVoice): boolean => {
      const nameLower = voice.name.toLowerCase();
      return malePatterns.some(pattern => nameLower.includes(pattern));
    };
    
    // Check if voice is a beautiful female voice
    const isFemaleGoddess = (voice: SpeechSynthesisVoice): boolean => {
      const nameLower = voice.name.toLowerCase();
      return femaleGoddessVoices.some(pattern => nameLower.includes(pattern));
    };
    
    // STRICT FILTER: Only allow voices that are NOT male
    const safeVoices = allVoices.filter(v => !isMaleVoice(v));
    console.log('Safe (non-male) voices:', safeVoices.map(v => `${v.name} (${v.lang})`));
    
    if (language === 'telugu') {
      // PRIORITY 1: Telugu female goddess voices
      const teluguGoddess = safeVoices.find(v => 
        (v.lang.toLowerCase().includes('te') || v.lang === 'te-IN') && isFemaleGoddess(v)
      );
      if (teluguGoddess) {
        console.log('Selected Telugu goddess voice:', teluguGoddess.name);
        return teluguGoddess;
      }
      
      // PRIORITY 2: Any Telugu female voice (non-male)
      const teluguFemale = safeVoices.find(v => 
        v.lang.toLowerCase().includes('te') || v.lang === 'te-IN'
      );
      if (teluguFemale) {
        console.log('Selected Telugu female voice:', teluguFemale.name);
        return teluguFemale;
      }
      
      // PRIORITY 3: Hindi/Indian female goddess voice (for natural desi pronunciation)
      const hindiGoddess = safeVoices.find(v => 
        (v.lang.includes('hi') || v.lang.includes('IN')) && isFemaleGoddess(v)
      );
      if (hindiGoddess) {
        console.log('Selected Hindi goddess voice:', hindiGoddess.name);
        return hindiGoddess;
      }
      
      // PRIORITY 4: Any Indian female voice
      const indianFemale = safeVoices.find(v => 
        (v.lang.includes('hi') || v.lang.includes('IN') || v.lang.includes('ta') || v.lang.includes('kn'))
      );
      if (indianFemale) {
        console.log('Selected Indian female voice:', indianFemale.name);
        return indianFemale;
      }
      
      // PRIORITY 5: Any English female goddess for fallback (still sounds cute)
      const englishGoddess = safeVoices.find(v => 
        v.lang.startsWith('en') && isFemaleGoddess(v)
      );
      if (englishGoddess) {
        console.log('Selected English goddess fallback:', englishGoddess.name);
        return englishGoddess;
      }
      
      // LAST RESORT: First safe voice available
      console.log('Using first safe voice as fallback:', safeVoices[0]?.name);
      return safeVoices[0] || null;
    } else {
      // English mode
      // PRIORITY 1: English female goddess voices
      const englishGoddess = safeVoices.find(v => 
        v.lang.startsWith('en') && isFemaleGoddess(v)
      );
      if (englishGoddess) {
        console.log('Selected English goddess voice:', englishGoddess.name);
        return englishGoddess;
      }
      
      // PRIORITY 2: Any English non-male voice
      const englishFemale = safeVoices.find(v => v.lang.startsWith('en'));
      if (englishFemale) {
        console.log('Selected English female voice:', englishFemale.name);
        return englishFemale;
      }
      
      // LAST RESORT: First safe voice
      console.log('Using first safe voice as English fallback:', safeVoices[0]?.name);
      return safeVoices[0] || null;
    }
  };

  const speakWithBrowser = (text: string, language: Language) => {
    if (!synthRef.current) return;
    synthRef.current.cancel();
    
    setIsSpeaking(true);
    setConversationState(ConversationState.SPEAKING);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = languageConfig[language].speechLang;
    
    // Optimize for cute, young, sweet female voice
    if (language === 'telugu') {
      // Telugu: Slower for clarity, higher pitch for cute goddess voice
      utterance.rate = 0.75;
      utterance.pitch = 1.35;
    } else {
      // English: Natural but still sweet and feminine
      utterance.rate = speechRate;
      utterance.pitch = speechPitch;
    }

    const femaleVoice = pickFemaleVoice(language);
    if (femaleVoice) {
      utterance.voice = femaleVoice;
      console.log(`Speaking with voice: ${femaleVoice.name} (${femaleVoice.lang})`);
    } else {
      console.warn('No suitable female voice found, using default');
    }

    utterance.onend = () => { 
      setIsSpeaking(false); 
      setConversationState(ConversationState.IDLE); 
    };
    utterance.onerror = (e) => { 
      console.error('Speech synthesis error:', e);
      setIsSpeaking(false); 
      setConversationState(ConversationState.IDLE); 
    };
    
    synthRef.current.speak(utterance);
  };

  // Sanitize text for TTS - remove ALL special characters that sound uncomfortable
  const sanitizeTextForSpeech = (text: string): string => {
    return text
      // Remove markdown bold/italic markers (** and *)
      .replace(/\*{1,}/g, '')
      // Remove hash/heading markers
      .replace(/#{1,}/g, '')
      // Remove parentheses and brackets completely
      .replace(/[()[\]{}]/g, '')
      // Remove angle brackets
      .replace(/[<>]/g, '')
      // Remove pipes, backslashes, tildes, backticks, carets
      .replace(/[|\\~`^]/g, '')
      // Remove @ and & symbols
      .replace(/[@&]/g, '')
      // Remove quotes that might be read as "quote"
      .replace(/["']/g, '')
      // Remove colons except in time formats (keep 10:30 but remove others)
      .replace(/:\s/g, '. ')
      // Remove semicolons
      .replace(/;/g, ',')
      // Remove multiple dashes/underscores (keep single dash for hyphenated words)
      .replace(/[-_]{2,}/g, ' ')
      // Remove standalone dashes
      .replace(/\s-\s/g, ' ')
      // Remove bullet points and list markers at start of lines
      .replace(/^[\s]*[-•●○◦▪▸►]\s*/gm, '')
      // Remove numbered list markers like "1." or "1)"
      .replace(/^\s*\d+[.)]\s*/gm, '')
      // Remove emoji-like patterns
      .replace(/[:;][-']?[()DPp]/g, '')
      // Remove URLs
      .replace(/https?:\/\/[^\s]+/g, '')
      // Remove email patterns
      .replace(/\S+@\S+\.\S+/g, '')
      // Clean up multiple spaces
      .replace(/\s{2,}/g, ' ')
      // Clean up multiple periods
      .replace(/\.{2,}/g, '.')
      // Clean up leading/trailing whitespace
      .trim();
  };

  const speakText = async (text: string, language: Language) => {
    if (isMuted) return;
    // Sanitize text to remove uncomfortable characters before speaking
    const cleanText = sanitizeTextForSpeech(text);
    console.log('Sanitized text for TTS:', cleanText.substring(0, 100));
    // Use FREE Google TTS for perfect Telugu pronunciation
    // Falls back to browser TTS if Google TTS fails (with same sanitized text)
    await speakWithGoogleTTS(cleanText, language);
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
