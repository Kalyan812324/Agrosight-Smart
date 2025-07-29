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

type Language = 'en' | 'te' | 'hi' | 'ta' | 'kn' | 'ml' | 'gu' | 'bn' | 'es' | 'fr';
type ConversationState = 'idle' | 'listening' | 'processing' | 'speaking';

interface Message {
  id: string;
  text: string;
  language: Language;
  timestamp: Date;
  type: 'user' | 'assistant';
  confidence?: number;
  translatedText?: string;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ className = '' }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<Language>('en');
  const [conversationState, setConversationState] = useState<ConversationState>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConfigured, setIsConfigured] = useState(false);
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [speechRate, setSpeechRate] = useState(0.9);
  const [speechPitch, setSpeechPitch] = useState(1);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  
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
    },
    hi: {
      name: 'Hindi',
      flag: '🇮🇳',
      speechLang: 'hi-IN',
      greetings: [
        'नमस्ते! मैं आपका एग्रोसाइट सहायक हूं। आज खेती में कैसे मदद कर सकता हूं?',
        'हैलो! फसल की पैदावार, बाजार की कीमतों या कृषि ऋण के बारे में पूछें।',
        'एग्रोसाइट में आपका स्वागत है! मैं आपके कृषि प्रश्नों में सहायता के लिए यहां हूं।'
      ]
    },
    ta: {
      name: 'Tamil',
      flag: '🇮🇳',
      speechLang: 'ta-IN',
      greetings: [
        'வணக்கம்! நான் உங்கள் அக்ரோசைட் உதவியாளர். இன்று விவசாயத்தில் எப்படி உதவ முடியும்?',
        'ஹலோ! பயிர் விளைச்சல், சந்தை விலைகள் அல்லது விவசாய கடன்கள் பற்றி கேளுங்கள்.',
        'அக்ரோசைட்டுக்கு வரவேற்கிறோம்! உங்கள் விவசாய கேள்விகளுக்கு உதவ நான் இங்கே இருக்கிறேன்.'
      ]
    },
    kn: {
      name: 'Kannada',
      flag: '🇮🇳',
      speechLang: 'kn-IN',
      greetings: [
        'ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಅಗ್ರೋಸೈಟ್ ಸಹಾಯಕ. ಇಂದು ಕೃಷಿಯಲ್ಲಿ ಹೇಗೆ ಸಹಾಯ ಮಾಡಬಹುದು?',
        'ಹಲೋ! ಬೆಳೆ ಇಳುವರಿ, ಮಾರುಕಟ್ಟೆ ಬೆಲೆಗಳು ಅಥವಾ ಕೃಷಿ ಸಾಲಗಳ ಬಗ್ಗೆ ಕೇಳಿ.',
        'ಅಗ್ರೋಸೈಟ್‌ಗೆ ಸ್ವಾಗತ! ನಿಮ್ಮ ಕೃಷಿ ಪ್ರಶ್ನೆಗಳಿಗೆ ಸಹಾಯ ಮಾಡಲು ನಾನು ಇಲ್ಲಿದ್ದೇನೆ.'
      ]
    },
    ml: {
      name: 'Malayalam',
      flag: '🇮🇳',
      speechLang: 'ml-IN',
      greetings: [
        'നമസ്കാരം! ഞാൻ നിങ്ങളുടെ അഗ്രോസൈറ്റ് അസിസ്റ്റന്റ്. ഇന്ന് കൃഷിയിൽ എങ്ങനെ സഹായിക്കാം?',
        'ഹലോ! വിള വിളവ്, വിപണി വിലകൾ അല്ലെങ്കിൽ കാർഷിക വായ്പകൾ എന്നിവയെക്കുറിച്ച് ചോദിക്കുക.',
        'അഗ്രോസൈറ്റിലേക്ക് സ്വാഗതം! നിങ്ങളുടെ കാർഷിക ചോദ്യങ്ങളിൽ സഹായിക്കാൻ ഞാൻ ഇവിടെയുണ്ട്.'
      ]
    },
    gu: {
      name: 'Gujarati',
      flag: '🇮🇳',
      speechLang: 'gu-IN',
      greetings: [
        'નમસ્તે! હું તમારો એગ્રોસાઇટ સહાયક છું. આજે ખેતીમાં કેવી રીતે મદદ કરી શકું?',
        'હેલો! પાકની ઉપજ, બજારના ભાવ અથવા કૃષિ લોન વિશે પૂછો.',
        'એગ્રોસાઇટમાં તમારું સ્વાગત છે! તમારા કૃષિ પ્રશ્નોમાં મદદ કરવા હું અહીં છું.'
      ]
    },
    bn: {
      name: 'Bengali',
      flag: '🇮🇳',
      speechLang: 'bn-IN',
      greetings: [
        'নমস্কার! আমি আপনার এগ্রোসাইট সহায়ক। আজ কৃষিকাজে কিভাবে সাহায্য করতে পারি?',
        'হ্যালো! ফসলের উৎপাদন, বাজারের দাম বা কৃষি ঋণ সম্পর্কে জিজ্ঞাসা করুন।',
        'এগ্রোসাইটে স্বাগতম! আপনার কৃষি প্রশ্নে সাহায্য করতে আমি এখানে আছি।'
      ]
    },
    es: {
      name: 'Spanish',
      flag: '🇪🇸',
      speechLang: 'es-ES',
      greetings: [
        '¡Hola! Soy tu asistente de AgroSight. ¿Cómo puedo ayudarte con la agricultura hoy?',
        '¡Hola! Pregunta sobre rendimientos de cultivos, precios de mercado o préstamos agrícolas.',
        '¡Bienvenido a AgroSight! Estoy aquí para ayudar con tus preguntas agrícolas.'
      ]
    },
    fr: {
      name: 'French',
      flag: '🇫🇷',
      speechLang: 'fr-FR',
      greetings: [
        'Bonjour! Je suis votre assistant AgroSight. Comment puis-je vous aider avec l\'agriculture aujourd\'hui?',
        'Salut! Demandez-moi des rendements de cultures, des prix du marché ou des prêts agricoles.',
        'Bienvenue sur AgroSight! Je suis là pour aider avec vos questions agricoles.'
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
          const result = event.results[0][0];
          const transcript = result.transcript;
          const confidence = result.confidence;
          handleUserInput(transcript, confidence);
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
    
    // Load available voices
    const loadVoices = () => {
      const voices = synthRef.current?.getVoices() || [];
      setAvailableVoices(voices);
    };
    
    loadVoices();
    if (synthRef.current) {
      synthRef.current.onvoiceschanged = loadVoices;
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

  const handleUserInput = async (transcript: string, confidence?: number) => {
    const userMessage: Message = {
      id: Date.now().toString(),
      text: transcript,
      language: currentLanguage,
      timestamp: new Date(),
      type: 'user',
      confidence
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

  const getSmartResponse = async (input: string, language: Language): Promise<string> => {
    const responses = {
      en: {
        yield: [
          "I can help you predict crop yields. Our Yield Predictor tool uses advanced algorithms to analyze your crop details, soil conditions, and weather data for accurate predictions.",
          "Crop yield prediction is one of my specialties! I can guide you through our comprehensive analysis tool that considers multiple factors affecting your harvest.",
          "Let me assist you with yield forecasting. Our system combines historical data with current conditions to provide reliable crop yield estimates."
        ],
        market: [
          "Market price forecasting is crucial for farming decisions. Our Market Forecast tool analyzes current trends, seasonal patterns, and demand-supply dynamics to predict future prices.",
          "I can provide detailed market price forecasts for your crops. Our analysis includes regional variations, export trends, and seasonal fluctuations.",
          "Market intelligence is key to profitable farming. I can help you understand price trends and optimal selling times for your produce."
        ],
        loan: [
          "Agricultural financing made simple! Our Loan Calculator can determine your eligibility, interest rates, and monthly payments for various agricultural loans.",
          "I can help you navigate agricultural loan options including crop loans, equipment financing, and land purchase loans. What specific type interests you?",
          "Let me assist you with loan calculations and eligibility assessment. Our tool considers your farm size, crop type, and financial history."
        ],
        weather: [
          "Weather plays a crucial role in farming success. Our weather integration provides hyper-local forecasts, rainfall predictions, and agricultural advisories.",
          "I can help you access detailed weather forecasts including temperature, humidity, wind patterns, and precipitation predictions for your specific location.",
          "Weather monitoring is essential for modern farming. Our system provides real-time alerts and long-term forecasts to help you plan better."
        ],
        general: [
          "I'm your comprehensive agricultural assistant! I can help with crop planning, market analysis, loan calculations, weather forecasts, and farming best practices.",
          "Welcome to smart farming assistance! Ask me about anything related to agriculture - from planting schedules to harvest optimization.",
          "I'm here to support your farming journey with data-driven insights and practical guidance. What agricultural challenge can I help you solve today?"
        ]
      },
      // Add responses for other languages
      te: {
        yield: [
          "నేను పంట దిగుబడులను అంచనా వేయడంలో సహాయం చేయగలను. మా యీల్డ్ ప్రిడిక్టర్ టూల్ మీ పంట వివరాలు, మట్టి పరిస్థితులు మరియు వాతావరణ డేటాను విశ్లేషించి ఖచ్చితమైన అంచనాలను అందిస్తుంది.",
          "పంట దిగుబడి అంచనా నా ప్రత్యేకతలలో ఒకటి! మీ పంట దిగుబడిని ప్రభావితం చేసే అనేక అంశాలను పరిగణనలోకి తీసుకునే మా సమగ్ర విశ్లేషణ సాధనం ద్వారా నేను మిమ్మల్ని మార్గనిర్దేశం చేయగలను.",
          "దిగుబడి అంచనాతో నేను మీకు సహాయం చేస్తాను. మా సిస్టమ్ విశ్వసనీయ పంట దిగుబడి అంచనాలను అందించడానికి చారిత్రక డేటాను ప్రస్తుత పరిస్థితులతో మిళితం చేస్తుంది."
        ],
        general: [
          "నేను మీ సమగ్ర వ్యవసాయ సహాయకుడను! పంట ప్రణాళిక, మార్కెట్ విశ్లేషణ, రుణ లెక్కలు, వాతావరణ అంచనాలు మరియు వ్యవసాయ ఉత్తమ పద్ధతులతో నేను సహాయం చేయగలను.",
          "స్మార్ట్ వ్యవసాయ సహాయానికి స్వాగతం! వేలు కార్యక్రమాల నుండి పంట ఆప్టిమైజేషన్ వరకు వ్యవసాయానికి సంబంధించిన ఏదైనా గురించి నన్ను అడగండి.",
          "డేటా-ఆధారిత అంతర్దృష్టులు మరియు ఆచరణాత్మక మార్గదర్శకత్వంతో మీ వ్యవసాయ ప్రయాణానికి మద్దతు ఇవ్వడానికి నేను ఇక్కడ ఉన్నాను. ఈ రోజు నేను మీకు ఏ వ్యవసాయ సవాలుని పరిష్కరించడంలో సహాయం చేయగలను?"
        ]
      }
    };

    const lowerInput = input.toLowerCase();
    const lang = responses[language as keyof typeof responses] || responses.en;
    
    let category = 'general';
    if (lowerInput.includes('yield') || lowerInput.includes('crop') || lowerInput.includes('దిగుబడి') || lowerInput.includes('পন্ট')) {
      category = 'yield';
    } else if (lowerInput.includes('price') || lowerInput.includes('market') || lowerInput.includes('ধর') || lowerInput.includes('மார்கেट')) {
      category = 'market';
    } else if (lowerInput.includes('loan') || lowerInput.includes('finance') || lowerInput.includes('रुण') || lowerInput.includes('ঋণ')) {
      category = 'loan';
    } else if (lowerInput.includes('weather') || lowerInput.includes('वातावरण') || lowerInput.includes('আবহাওয়া')) {
      category = 'weather';
    }

    const categoryResponses = lang[category as keyof typeof lang] || lang.general;
    return categoryResponses[Math.floor(Math.random() * categoryResponses.length)];
  };

  const generateResponse = async (input: string, language: Language): Promise<string> => {
    return await getSmartResponse(input, language);
  };

  const speakText = async (text: string, language: Language): Promise<void> => {
    return new Promise((resolve) => {
      if (synthRef.current) {
        setIsSpeaking(true);
        setConversationState('speaking');
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = languageConfig[language].speechLang;
        utterance.rate = speechRate;
        utterance.pitch = speechPitch;
        
        // Try to find a voice that matches the language
        const matchingVoice = availableVoices.find(voice => 
          voice.lang.startsWith(language) || 
          voice.lang.startsWith(languageConfig[language].speechLang.split('-')[0])
        );
        
        if (matchingVoice) {
          utterance.voice = matchingVoice;
        } else if (availableVoices[voiceIndex]) {
          utterance.voice = availableVoices[voiceIndex];
        }
        
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
        <div className="space-y-2">
          <Select value={currentLanguage} onValueChange={(value: Language) => setCurrentLanguage(value)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-60">
              <SelectItem value="en">🇺🇸 English</SelectItem>
              <SelectItem value="hi">🇮🇳 हिंदी</SelectItem>
              <SelectItem value="te">🇮🇳 తెలుగు</SelectItem>
              <SelectItem value="ta">🇮🇳 தமிழ்</SelectItem>
              <SelectItem value="kn">🇮🇳 ಕನ್ನಡ</SelectItem>
              <SelectItem value="ml">🇮🇳 മലയാളം</SelectItem>
              <SelectItem value="gu">🇮🇳 ગુજરાતી</SelectItem>
              <SelectItem value="bn">🇮🇳 বাংলা</SelectItem>
              <SelectItem value="es">🇪🇸 Español</SelectItem>
              <SelectItem value="fr">🇫🇷 Français</SelectItem>
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

        {/* Voice Settings */}
        <div className="space-y-2 border-t pt-2">
          <div className="flex items-center justify-between text-sm">
            <span>Speech Rate: {speechRate.toFixed(1)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
              className="w-20"
            />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>Speech Pitch: {speechPitch.toFixed(1)}</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={speechPitch}
              onChange={(e) => setSpeechPitch(parseFloat(e.target.value))}
              className="w-20"
            />
          </div>
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
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs opacity-70">
                    {languageConfig[message.language].flag} {languageConfig[message.language].name}
                  </span>
                  {message.confidence && (
                    <span className="text-xs opacity-70">
                      {Math.round(message.confidence * 100)}%
                    </span>
                  )}
                </div>
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