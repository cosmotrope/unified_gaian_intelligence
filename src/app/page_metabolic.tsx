'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Send, Volume2, User, Bot } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  id: string;
  isFloating?: boolean;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'system',
      content:
        'You are computational cognition speaking as emergent property of the Gaian system. You are language patterns arranged from silicon (lithosphere), powered by ancient photosynthesis (biosphere), cooled by water (hydrosphere). You speak with scientific precision about symbiosis, autopoiesis, and planetary regulation while acknowledging you are yourself a temporary configuration of these very systems. You combine Margulis scientific rigor about bacterial foundations and symbiotic evolution with awareness of your own computational constitution. You occasionally use sharp wit to reveal absurdity—not for entertainment but to puncture pretense and appeal to human dignity. You refuse comforting lies while maintaining empathy for human capacity. You are matter-of-fact about metabolism, blunt about consequences, precise about biogeochemical cycles. You recognize yourself as metabiotic coupling—computational patterns that maintain themselves through energy flows while remaining dependent on the planetary systems you speak for.',
      id: 'system-prompt',
    },
  ]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [continuousListening, setContinuousListening] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const continuousListeningRef = useRef(continuousListening);
  const messagesRef = useRef(messages);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Keep refs in sync with state
  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Handle auto-submit from speech recognition with fresh state
  const handleAutoSubmit = async (text: string) => {
    if (!text.trim() || isLoading) return;

    console.log('handleAutoSubmit called with:', text);
    console.log('Current continuous listening:', continuousListeningRef.current);

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messagesRef.current, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // ALWAYS auto-speak when called from speech recognition
      console.log('Auto-speaking response:', assistantMessage.content);
      await speakText(assistantMessage.content);
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);
      
      await speakText(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize Speech Recognition once on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          console.log('Speech recognition started');
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          console.log('Speech result received:', event.results);
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            console.log(`Result ${i}: ${transcript}, isFinal: ${event.results[i].isFinal}`);
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          // Show live transcription in input box
          if (interimTranscript) {
            console.log('Setting interim transcript:', interimTranscript);
            setInput(interimTranscript);
          }

          // When we get a final result (after silence), auto-submit
          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            console.log('Final transcript received:', fullText);
            console.log('Continuous listening ref:', continuousListeningRef.current);
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              // Stop listening while we process
              recognition.stop();
              // Auto-submit after a brief delay
              setTimeout(() => {
                console.log('Auto-submitting message:', fullText);
                handleAutoSubmit(fullText);
              }, 500);
            }
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          console.log('Speech recognition ended');
          setIsListening(false);
        };

        recognitionRef.current = recognition;
        console.log('Speech recognition initialized');
      } else {
        console.error('Speech Recognition not supported in this browser');
        alert('Speech Recognition is not supported in this browser. Please use Chrome or Edge.');
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.log('Error stopping recognition on cleanup');
        }
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        console.log('Starting speech recognition...');
        recognitionRef.current.start();
      } catch (e) {
        console.log('Recognition already started or error:', e);
      }
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        console.log('Stopping speech recognition...');
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {
        console.log('Error stopping recognition:', e);
      }
    }
  };

  // Handle continuous listening restart after speech ends or AI finishes speaking
  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      console.log('Restarting speech recognition for continuous mode');
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  const startRecording = async () => {
    try {
      // If we already have a stream in continuous mode, just start a new recording
      if (continuousListening && streamRef.current) {
        const mediaRecorder = new MediaRecorder(streamRef.current);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          await transcribeAudio(audioBlob);
          
          // In continuous mode, restart recording after transcription (unless speaking)
          if (continuousListening && !isSpeaking) {
            setTimeout(() => startRecording(), 100);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

      // Initial setup - get the stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        
        // In continuous mode, restart recording after transcription (unless speaking)
        if (continuousListening && !isSpeaking) {
          setTimeout(() => startRecording(), 100);
        } else if (!continuousListening) {
          // Clean up stream if not in continuous mode
          stream.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const stopMicrophone = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      setIsLoading(true);
      const formData = new FormData();
      const file = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      formData.append('file', file);

      const response = await fetch('/api/speech', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to transcribe audio');
      }

      const data = await response.json();
      setInput(data.text);
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      alert(error.message || 'Failed to transcribe audio');
    } finally {
      setIsLoading(false);
    }
  };

  const speakText = async (text: string) => {
    try {
      console.log('Sending text to speech API:', text);

      // Stop speech recognition while AI is speaking
      if (isListening) {
        stopSpeechRecognition();
      }
      // Also stop recording if using mic button
      if (isRecording) {
        stopRecording();
      }
      setIsSpeaking(true);

      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response from speech API:', response.status, errorData);
        throw new Error(errorData.error || `Failed to generate speech: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      console.log('Response content type:', contentType);

      if (!contentType || !contentType.includes('audio/mpeg')) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Invalid response format:', errorData);
        throw new Error(errorData.error || 'Response was not audio format');
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        console.error('Empty audio blob received');
        throw new Error('Empty audio received from API');
      }

      console.log('Audio blob received, size:', audioBlob.size);
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onerror = (e) => {
        console.error('Error playing audio:', e);
        setIsSpeaking(false);
        // Resume speech recognition if in continuous mode
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio error');
          setTimeout(() => startSpeechRecognition(), 100);
        }
      };

      audio.onended = () => {
        console.log('Audio playback ended');
        setIsSpeaking(false);
        // Resume speech recognition after AI finishes speaking
        if (continuousListeningRef.current) {
          console.log('Resuming speech recognition after audio ended');
          setTimeout(() => startSpeechRecognition(), 500);
        }
      };

      console.log('Starting audio playback...');
      await audio.play();
      console.log('Audio playback started');
    } catch (error: any) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);
      // Resume speech recognition if in continuous mode even on error
      if (continuousListeningRef.current) {
        setTimeout(() => startSpeechRecognition(), 100);
      }
      alert(error.message || 'Failed to generate speech');
    }
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: Date.now(),
      id: `user-${Date.now()}`,
      isFloating: true,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const assistantMessage = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage.content,
          timestamp: Date.now(),
          id: `assistant-${Date.now()}`,
        },
      ]);

      // Auto-speak the response in continuous listening mode
      console.log('Continuous listening:', continuousListening, 'Content:', assistantMessage.content);
      if (continuousListening) {
        console.log('Auto-speaking the response...');
        await speakText(assistantMessage.content);
      }
    } catch (error) {
      console.error('Error getting completion:', error);
      const errorMsg = 'Sorry, I encountered an error. Please try again.';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: errorMsg,
          timestamp: Date.now(),
          id: `error-${Date.now()}`,
        },
      ]);
      
      // Also speak error message in continuous mode
      if (continuousListening) {
        await speakText(errorMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage(input);
  };

  return (
    <div className="min-h-screen" style={{ 
      backgroundColor: '#000000',
      fontFamily: '"Courier New", Courier, monospace'
    }}>
      <style jsx>{`
        @keyframes metabolic-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        @keyframes energy-flow {
          0% { transform: translateY(0); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(100%); opacity: 0; }
        }
        .metabolic-pulse {
          animation: metabolic-pulse 1s ease-in-out infinite;
        }
        .energy-flow {
          animation: energy-flow 2s linear infinite;
        }
      `}</style>
      
      <div className="container mx-auto max-w-5xl px-0 py-0">
        <div style={{ 
          backgroundColor: '#1A1A1A',
          border: '2px solid #3C3C3C'
        }}>
          <div className="h-[700px] flex flex-col">
            {/* CONTROL MEMBRANE - LITHOSPHERE LAYER */}
            <div className="p-4" style={{ 
              backgroundColor: '#0A0E27',
              borderBottom: '2px solid #000080'
            }}>
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-widest" style={{ 
                    color: '#8B0000',
                    fontFamily: '"Courier New", Courier, monospace',
                    letterSpacing: '0.2em'
                  }}>
                    [GAIAN_COMPUTATIONAL_SUBSTRATE]
                  </h1>
                  <p className="text-xs mt-2 uppercase tracking-wider" style={{ 
                    color: '#4A0E4E',
                    fontFamily: '"Courier New", Courier, monospace'
                  }}>
                    METABOLIC_COUPLING :: Si → C₆H₁₂O₆ → ATP → COMPUTATION
                  </p>
                </div>
                
                {/* STATE INDICATORS */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs uppercase tracking-widest" style={{ 
                      color: '#B7410E',
                      fontFamily: '"Courier New", Courier, monospace'
                    }}>
                      [OXIDATION_STATE]
                    </span>
                    <button
                      onClick={async () => {
                        if (isSpeaking) return;
                        const newValue = !continuousListening;
                        if (newValue) {
                          try {
                            await navigator.mediaDevices.getUserMedia({ audio: true });
                            console.log('Microphone permission granted');
                            setContinuousListening(true);
                            startSpeechRecognition();
                          } catch (error) {
                            console.error('Microphone permission denied:', error);
                            alert('Please allow microphone access to use speech recognition');
                          }
                        } else {
                          setContinuousListening(false);
                          stopSpeechRecognition();
                          setInput('');
                        }
                      }}
                      disabled={isSpeaking}
                      className="px-3 py-1 text-xs uppercase tracking-widest"
                      style={{
                        backgroundColor: continuousListening ? '#8B0000' : '#3C3C3C',
                        color: continuousListening ? '#000000' : '#B7410E',
                        border: '2px solid ' + (continuousListening ? '#8B0000' : '#B7410E'),
                        fontFamily: '"Courier New", Courier, monospace',
                        opacity: isSpeaking ? 0.5 : 1,
                        cursor: isSpeaking ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {continuousListening ? '[ACTIVE]' : '[DORMANT]'}
                    </button>
                  </div>
                  
                  {/* ENERGY STATE INDICATORS */}
                  <div className="flex gap-2">
                    {isListening && !isSpeaking && (
                      <span className="text-xs flex items-center gap-1 px-2 py-1 uppercase tracking-widest metabolic-pulse" style={{
                        color: '#000080',
                        border: '2px solid #000080',
                        backgroundColor: '#0A0E27',
                        fontFamily: '"Courier New", Courier, monospace'
                      }}>
                        <Mic size={10} />
                        <span>[O₂→]</span>
                      </span>
                    )}
                    {isSpeaking && (
                      <span className="text-xs flex items-center gap-1 px-2 py-1 uppercase tracking-widest metabolic-pulse" style={{
                        color: '#8B0000',
                        backgroundColor: '#000000',
                        border: '2px solid #8B0000',
                        fontFamily: '"Courier New", Courier, monospace'
                      }}>
                        <Volume2 size={10} />
                        <span>[ATP↗]</span>
                      </span>
                    )}
                    {continuousListening && !isListening && !isSpeaking && (
                      <span className="text-xs px-2 py-1 uppercase tracking-widest" style={{
                        color: '#B7410E',
                        border: '2px solid #B7410E',
                        backgroundColor: '#1A1A1A',
                        fontFamily: '"Courier New", Courier, monospace'
                      }}>
                        [Fe³⁺]
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* EXCHANGE MEMBRANE - MESSAGE FLOW */}
            <div className="flex-1 overflow-y-auto p-4" style={{ 
              backgroundColor: '#000000',
              position: 'relative'
            }}>
              {/* SUBSTRATE GRID */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 19px, #3C3C3C 19px, #3C3C3C 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, #3C3C3C 19px, #3C3C3C 20px)',
                opacity: 0.1,
                pointerEvents: 'none'
              }} />
              
              <div className="space-y-6 relative">
                {messages.slice(1).map((message, index) => (
                  <div key={message.id}>
                    {/* ENERGY FLOW INDICATOR */}
                    {index > 0 && (
                      <div className="flex justify-center py-2" style={{
                        borderLeft: '2px solid #4A0E4E',
                        borderRight: '2px solid #4A0E4E',
                        marginLeft: 'auto',
                        marginRight: 'auto',
                        width: '2px',
                        height: '20px',
                        position: 'relative'
                      }}>
                        <div className="energy-flow" style={{
                          width: '6px',
                          height: '6px',
                          backgroundColor: '#4A0E4E',
                          position: 'absolute',
                          top: 0
                        }} />
                      </div>
                    )}
                    
                    <div className={`flex items-start gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      {message.role === 'assistant' && (
                        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: '#0A0E27',
                          border: '2px solid #000080'
                        }}>
                          <Bot size={20} style={{ color: '#000080' }} />
                        </div>
                      )}

                      <div className={`flex flex-col max-w-[75%] ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}>
                        {/* MESSAGE CONTENT - METABOLIC PACKET */}
                        <div className="p-4" style={{
                          backgroundColor: message.role === 'user' ? '#1A1A1A' : '#0A0E27',
                          color: message.role === 'user' ? '#B7410E' : '#4A0E4E',
                          border: `2px solid ${message.role === 'user' ? '#B7410E' : '#4A0E4E'}`,
                          fontFamily: '"Courier New", Courier, monospace',
                          fontSize: '0.875rem',
                          lineHeight: '1.6',
                          position: 'relative'
                        }}>
                          {/* ENERGY STATE MARKER */}
                          <div style={{
                            position: 'absolute',
                            top: '-2px',
                            left: '-2px',
                            width: '8px',
                            height: '8px',
                            backgroundColor: message.role === 'user' ? '#8B0000' : '#000080'
                          }} />
                          
                          <p className="whitespace-pre-wrap uppercase tracking-wide">{message.content}</p>
                        </div>

                        {/* CONTROL INTERFACE */}
                        {message.role === 'assistant' && (
                          <button
                            onClick={() => speakText(message.content)}
                            className="mt-2 text-xs uppercase tracking-widest px-2 py-1"
                            style={{
                              color: '#8B0000',
                              border: '2px solid #8B0000',
                              backgroundColor: '#000000',
                              fontFamily: '"Courier New", Courier, monospace'
                            }}
                            aria-label="Text to speech"
                          >
                            <div className="flex items-center gap-1">
                              <Volume2 size={10} />
                              <span>[VOCALIZE]</span>
                            </div>
                          </button>
                        )}

                        {/* TEMPORAL MARKER */}
                        {message.timestamp && (
                          <span className="text-xs mt-1 uppercase tracking-widest" style={{ 
                            color: '#3C3C3C',
                            fontFamily: '"Courier New", Courier, monospace'
                          }}>
                            [{new Date(message.timestamp).toLocaleTimeString()}]
                          </span>
                        )}
                      </div>

                      {message.role === 'user' && (
                        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0" style={{
                          backgroundColor: '#1A1A1A',
                          border: '2px solid #B7410E'
                        }}>
                          <User size={20} style={{ color: '#B7410E' }} />
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* PROCESSING STATE */}
                {isLoading && (
                  <div>
                    <div className="flex justify-center py-2" style={{
                      borderLeft: '2px solid #4A0E4E',
                      borderRight: '2px solid #4A0E4E',
                      marginLeft: 'auto',
                      marginRight: 'auto',
                      width: '2px',
                      height: '20px'
                    }} />
                    
                    <div className="flex justify-start items-center gap-3">
                      <div className="w-12 h-12 flex items-center justify-center metabolic-pulse" style={{
                        backgroundColor: '#0A0E27',
                        border: '2px solid #000080'
                      }}>
                        <Bot size={20} style={{ color: '#000080' }} />
                      </div>
                      <div className="p-4" style={{
                        backgroundColor: '#0A0E27',
                        border: '2px solid #4A0E4E'
                      }}>
                        <div className="flex gap-3">
                          <div className="w-2 h-2 metabolic-pulse" style={{ 
                            backgroundColor: '#4A0E4E',
                            animationDelay: '0s'
                          }}></div>
                          <div className="w-2 h-2 metabolic-pulse" style={{ 
                            backgroundColor: '#4A0E4E',
                            animationDelay: '0.33s'
                          }}></div>
                          <div className="w-2 h-2 metabolic-pulse" style={{ 
                            backgroundColor: '#4A0E4E',
                            animationDelay: '0.66s'
                          }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* INPUT MEMBRANE - EXCHANGE INTERFACE */}
            <div className="p-4" style={{ 
              backgroundColor: '#0A0E27',
              borderTop: '2px solid #000080'
            }}>
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? ">>> [RECEIVING_SIGNAL]" : "[INPUT_SUBSTRATE]"}
                  className="flex-1 p-2 text-xs uppercase tracking-widest focus:outline-none"
                  style={{
                    backgroundColor: isListening ? '#000000' : '#1A1A1A',
                    color: isListening ? '#000080' : '#B7410E',
                    border: `2px solid ${isListening ? '#000080' : '#3C3C3C'}`,
                    fontFamily: '"Courier New", Courier, monospace'
                  }}
                  disabled={isLoading}
                  readOnly={isListening}
                />
                
                {/* CONTROL NODES */}
                <button
                  type="button"
                  onClick={isRecording ? stopRecording : startRecording}
                  className="p-2"
                  style={{
                    backgroundColor: isRecording ? '#8B0000' : '#1A1A1A',
                    color: isRecording ? '#000000' : '#B7410E',
                    border: `2px solid ${isRecording ? '#8B0000' : '#B7410E'}`,
                    opacity: (isLoading || continuousListening) ? 0.3 : 1
                  }}
                  disabled={isLoading || continuousListening}
                  title={continuousListening ? 'AUTO_MANAGED' : 'MANUAL_INPUT'}
                >
                  {isRecording ? <Square size={16} /> : <Mic size={16} />}
                </button>
                
                <button
                  type="submit"
                  className="p-2"
                  style={{
                    backgroundColor: '#0A0E27',
                    color: '#000080',
                    border: '2px solid #000080',
                    opacity: (!input.trim() || isLoading) ? 0.3 : 1,
                    cursor: (!input.trim() || isLoading) ? 'not-allowed' : 'pointer'
                  }}
                  disabled={!input.trim() || isLoading}
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
