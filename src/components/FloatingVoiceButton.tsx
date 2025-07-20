import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VoiceAssistant from './VoiceAssistant';

const FloatingVoiceButton: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          size="lg"
          className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-r from-primary to-primary-glow"
        >
          {isOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <MessageCircle className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Voice Assistant Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-40 animate-in slide-in-from-bottom-5 fade-in-0 duration-300">
          <VoiceAssistant className="shadow-2xl border-0 bg-card/95 backdrop-blur-sm" />
        </div>
      )}
    </>
  );
};

export default FloatingVoiceButton;