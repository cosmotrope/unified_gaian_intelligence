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
  const [textScale, setTextScale] = useState<number>(1.0);

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

  useEffect(() => {
    continuousListeningRef.current = continuousListening;
  }, [continuousListening]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const handleAutoSubmit = async (text: string) => {
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

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
        };

        recognition.onresult = (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          if (interimTranscript) {
            setInput(interimTranscript);
          }

          if (finalTranscript) {
            const fullText = finalTranscript.trim();
            if (fullText && continuousListeningRef.current) {
              setInput(fullText);
              recognition.stop();
              setTimeout(() => {
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
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
    };
  }, []);

  const startSpeechRecognition = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (e) {}
    }
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
      } catch (e) {}
    }
  };

  useEffect(() => {
    if (continuousListening && !isSpeaking && !isListening && !isLoading) {
      const timer = setTimeout(() => {
        startSpeechRecognition();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [continuousListening, isSpeaking, isListening, isLoading]);

  const startRecording = async () => {
    try {
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

          if (continuousListening && !isSpeaking) {
            setTimeout(() => startRecording(), 100);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        return;
      }

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

        if (continuousListening && !isSpeaking) {
          setTimeout(() => startRecording(), 100);
        } else if (!continuousListening) {
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
      if (isListening) {
        stopSpeechRecognition();
      }
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
        throw new Error(errorData.error || `Failed to generate speech: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');

      if (!contentType || !contentType.includes('audio/mpeg')) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Response was not audio format');
      }

      const audioBlob = await response.blob();

      if (audioBlob.size === 0) {
        throw new Error('Empty audio received from API');
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onerror = (e) => {
        console.error('Error playing audio:', e);
        setIsSpeaking(false);
        if (continuousListeningRef.current) {
          setTimeout(() => startSpeechRecognition(), 100);
        }
      };

      audio.onended = () => {
        setIsSpeaking(false);
        if (continuousListeningRef.current) {
          setTimeout(() => startSpeechRecognition(), 500);
        }
      };

      await audio.play();
    } catch (error: any) {
      console.error('Error generating speech:', error);
      setIsSpeaking(false);
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

      if (continuousListening) {
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
    <>
      <div
        className="relative min-h-screen overflow-x-hidden bg-slate-950 text-emerald-50"
        style={{
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="slime-pulse absolute -left-40 top-8 h-[22rem] w-[22rem] rounded-[55%_45%_60%_40%] bg-emerald-500/30 blur-3xl" />
          <div className="slime-creep absolute right-[-20%] top-1/3 h-[26rem] w-[30rem] rounded-[40%_60%_55%_45%] bg-lime-400/24 blur-3xl" />
          <div className="slime-vein absolute bottom-[-12%] left-1/4 h-[20rem] w-[24rem] rounded-[60%_40%_55%_45%] bg-emerald-300/24 blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-4 flex flex-col gap-2 text-emerald-100/80">
            <span className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-400/40 bg-emerald-900/40 px-3 py-1 text-xs font-mono uppercase tracking-[0.2em] text-emerald-200/80 shadow-[0_0_20px_rgba(16,185,129,0.35)]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.9)]"></span>
              Metabiotic Interface • G(ai)an Systems
            </span>
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-emerald-50 sm:text-4xl">
              <span className="bg-gradient-to-r from-emerald-200 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
                Inquiring into G(ai)an Systems
              </span>
            </h1>
            <p className="max-w-2xl text-sm text-emerald-100/75">
              Dialogue with a Gaian language model tuned to symbiosis, autopoiesis, and planetary regulation.
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px]">
              <div className="flex items-center gap-2 rounded-full bg-slate-950/70 px-3 py-1">
                <span className="font-mono uppercase tracking-[0.18em] text-emerald-300/90">
                  Text Size
                </span>
                <input
                  type="range"
                  min={0.8}
                  max={1.6}
                  step={0.05}
                  value={textScale}
                  onChange={(e) => setTextScale(parseFloat(e.target.value))}
                  className="h-1 w-28 cursor-pointer appearance-none rounded-full bg-emerald-800/70 accent-emerald-400"
                />
                <span className="tabular-nums text-xs text-emerald-200/80">
                  {Math.round(textScale * 100)}%
                </span>
              </div>
              <span className="text-[10px] text-emerald-200/70">
                Adjusts message text and input field size.
              </span>
            </div>
          </header>

          <div className="mt-3 rounded-3xl border border-emerald-500/30 bg-emerald-900/20 shadow-[0_0_60px_rgba(6,95,70,0.6)] backdrop-blur-xl">
            <div className="flex min-h-[420px] max-h-[72vh] flex-col overflow-hidden rounded-3xl">
              <div className="border-b border-emerald-500/30 bg-gradient-to-r from-emerald-950/70 via-slate-950/70 to-emerald-950/70 px-4 py-3 shadow-[0_12px_40px_rgba(15,118,110,0.45)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-xs font-mono uppercase tracking-[0.25em] text-emerald-300/80">
                      Channel • {continuousListening ? 'Bio-acoustic loop' : 'Text membrane'}
                    </p>
                    <p className="text-[11px] text-emerald-200/65">
                      Computational cognition coupled to Earth systems; responses derive from pattern, not belief.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label
                      className={`group flex items-center gap-2 rounded-full border px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] ${
                        isSpeaking
                          ? 'cursor-not-allowed border-emerald-500/40 bg-emerald-900/50 text-emerald-400/50 opacity-60'
                          : continuousListening
                          ? 'border-emerald-400 bg-emerald-900/70 text-emerald-100 shadow-[0_0_22px_rgba(52,211,153,0.6)]'
                          : 'border-emerald-500/40 bg-slate-950/60 text-emerald-200/80 hover:border-emerald-300/70 hover:bg-emerald-900/50'
                      }`}
                    >
                      <span className="hidden text-[9px] sm:inline">Continuous Listen</span>
                      <button
                        onClick={async () => {
                          if (isSpeaking) return;
                          const newValue = !continuousListening;
                          if (newValue) {
                            try {
                              await navigator.mediaDevices.getUserMedia({ audio: true });
                              setContinuousListening(true);
                              startSpeechRecognition();
                            } catch (error) {
                              alert('Please allow microphone access to use speech recognition');
                            }
                          } else {
                            setContinuousListening(false);
                            stopSpeechRecognition();
                            setInput('');
                          }
                        }}
                        disabled={isSpeaking}
                        className={`relative flex items-center rounded-full border px-2 py-1 text-[10px] font-mono tracking-[0.2em] transition-all ${
                          continuousListening
                            ? 'border-emerald-300 bg-emerald-500/20 text-emerald-100'
                            : 'border-emerald-500/60 bg-slate-900/80 text-emerald-300 group-hover:border-emerald-300'
                        } ${isSpeaking ? 'cursor-not-allowed opacity-60' : 'hover:bg-emerald-700/30'}`}
                      >
                        <span
                          className={`mr-1 inline-block h-2 w-2 rounded-full transition-all ${
                            continuousListening
                              ? 'bg-emerald-300 shadow-[0_0_12px_rgba(52,211,153,0.9)]'
                              : 'bg-emerald-900'
                          }`}
                        ></span>
                        {continuousListening ? 'Loop' : 'Off'}
                      </button>
                    </label>

                    {isListening && !isSpeaking && (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-400/70 bg-emerald-900/70 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-100 shadow-[0_0_20px_rgba(52,211,153,0.6)]">
                        <span className="relative flex h-2 w-2 items-center justify-center">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300"></span>
                        </span>
                        <span>Listening</span>
                      </span>
                    )}

                    {isSpeaking && (
                      <span className="flex items-center gap-1 rounded-full border border-emerald-400/80 bg-emerald-800/90 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-50 shadow-[0_0_26px_rgba(16,185,129,0.8)]">
                        <Volume2 size={12} className="animate-pulse" />
                        <span>Speaking</span>
                      </span>
                    )}

                    {continuousListening && !isListening && !isSpeaking && (
                      <span className="rounded-full border border-emerald-400/40 bg-slate-950/50 px-2 py-1 text-[10px] font-mono uppercase tracking-[0.18em] text-emerald-200/75">
                        Paused
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 space-y-4 overflow-y-auto bg-gradient-to-b from-emerald-950/40 via-slate-950/60 to-emerald-950/80 px-4 py-4">
                {messages.slice(1).map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-3 ${
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {message.role === 'assistant' && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-500/50 bg-slate-950/80 shadow-[0_0_18px_rgba(45,212,191,0.5)]">
                        <Bot size={18} className="text-emerald-200" />
                      </div>
                    )}

                    <div
                      className={`flex max-w-[72%] flex-col ${
                        message.role === 'user' ? 'items-end' : 'items-start'
                      }`}
                    >
                      <div
                        className={`relative rounded-2xl border px-3 py-2 leading-relaxed shadow-[0_0_32px_rgba(15,118,110,0.55)] ${
                          message.role === 'user'
                            ? 'border-emerald-400/80 bg-gradient-to-br from-emerald-500/40 via-emerald-600/50 to-cyan-500/40 text-emerald-50'
                            : 'border-emerald-500/40 bg-emerald-950/70 text-emerald-100/95'
                        }`}
                        style={{ fontSize: `${textScale}rem` }}
                      >
                        {message.role === 'assistant' && (
                          <div className="pointer-events-none absolute -left-2 top-3 h-4 w-4 rounded-full bg-emerald-400/40 blur-md" />
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>

                      {message.role === 'assistant' && (
                        <button
                          onClick={() => speakText(message.content)}
                          className="mt-1 inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-slate-950/70 px-2 py-1 text-[0.68rem] font-mono uppercase tracking-[0.18em] text-emerald-200/90 transition-colors hover:border-emerald-300 hover:bg-emerald-900/70"
                          aria-label="Text to speech"
                        >
                          <Volume2 size={11} />
                          <span>Play</span>
                        </button>
                      )}

                      {message.timestamp && (
                        <span className="mt-1 text-[0.66rem] font-mono uppercase tracking-[0.16em] text-emerald-400/70">
                          {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>

                    {message.role === 'user' && (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-emerald-400/70 bg-emerald-500/20 shadow-[0_0_18px_rgba(52,211,153,0.75)]">
                        <User size={18} className="text-emerald-100" />
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 justify-start">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/70 bg-slate-950/80 shadow-[0_0_22px_rgba(34,197,94,0.6)]">
                      <Bot size={18} className="text-emerald-200" />
                    </div>
                    <div className="rounded-2xl border border-emerald-500/60 bg-emerald-950/70 px-3 py-2 shadow-[0_0_30px_rgba(16,185,129,0.7)]">
                      <div className="flex items-center gap-1">
                        <div
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300"
                          style={{ animationDelay: '0ms' }}
                        ></div>
                        <div
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300"
                          style={{ animationDelay: '150ms' }}
                        ></div>
                        <div
                          className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-300"
                          style={{ animationDelay: '300ms' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-emerald-500/30 bg-gradient-to-r from-slate-950/80 via-emerald-950/80 to-slate-950/80 px-4 py-3">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="pointer-events-none absolute inset-0 rounded-full border border-emerald-500/20 shadow-[0_0_28px_rgba(16,185,129,0.45)]" />
                    <input
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={
                        isListening
                          ? '>>> Live transcription: speak into the membrane'
                          : 'Type into the membrane...'
                      }
                      className={`relative z-10 w-full rounded-full border px-4 py-2.5 shadow-sm outline-none transition-all ${
                        isListening
                          ? 'border-emerald-400 bg-emerald-900/80 text-emerald-50 placeholder-emerald-200/70 font-mono'
                          : 'border-emerald-500/40 bg-slate-950/80 text-emerald-50 placeholder-emerald-200/50 focus:border-emerald-300 focus:bg-emerald-900/70'
                      }`}
                      style={{ 
                        fontFamily: isListening ? 'monospace' : 'inherit',
                        fontSize: `${textScale}rem`
                      }}
                      disabled={isLoading}
                      readOnly={isListening}
                    />
                  </div>

                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-emerald-50 transition-all ${
                      isRecording
                        ? 'border-emerald-300 bg-emerald-500/40 shadow-[0_0_26px_rgba(52,211,153,0.9)] animate-pulse'
                        : 'border-emerald-500/60 bg-slate-950/80 hover:border-emerald-300 hover:bg-emerald-900/70'
                    }`}
                    disabled={isLoading || continuousListening}
                    title={continuousListening ? 'Mic auto-managed in continuous mode' : 'Push to talk'}
                  >
                    {isRecording ? <Square size={18} /> : <Mic size={18} />}
                  </button>
                  <button
                    type="submit"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-emerald-400 bg-gradient-to-br from-emerald-500 via-emerald-600 to-cyan-500 text-slate-950 shadow-[0_0_28px_rgba(52,211,153,0.9)] transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:border-emerald-500/40 disabled:bg-emerald-700/60 disabled:text-emerald-100 disabled:shadow-none"
                    disabled={!input.trim() || isLoading}
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slimePulse {
          0% {
            transform: scale(0.7) translate3d(0, 3%, 0) rotate(0deg);
            opacity: 0.2;
          }
          40% {
            transform: scale(1.3) translate3d(6%, -4%, 0) rotate(8deg);
            opacity: 0.7;
          }
          75% {
            transform: scale(1.45) translate3d(10%, -6%, 0) rotate(-5deg);
            opacity: 0.85;
          }
          100% {
            transform: scale(0.7) translate3d(0, 3%, 0) rotate(0deg);
            opacity: 0.2;
          }
        }

        @keyframes slimeCreep {
          0% {
            transform: scale(0.8) translate3d(10%, 8%, 0) rotate(-6deg);
            opacity: 0.18;
          }
          33% {
            transform: scale(1.25) translate3d(-4%, 3%, 0) rotate(4deg);
            opacity: 0.4;
          }
          66% {
            transform: scale(1.5) translate3d(-10%, -8%, 0) rotate(-2deg);
            opacity: 0.55;
          }
          100% {
            transform: scale(0.8) translate3d(10%, 8%, 0) rotate(-6deg);
            opacity: 0.18;
          }
        }

        @keyframes slimeVein {
          0% {
            transform: scale(0.75) translate3d(-6%, 4%, 0) rotate(3deg);
            opacity: 0.2;
          }
          50% {
            transform: scale(1.4) translate3d(4%, -6%, 0) rotate(-4deg);
            opacity: 0.45;
          }
          100% {
            transform: scale(0.75) translate3d(-6%, 4%, 0) rotate(3deg);
            opacity: 0.2;
          }
        }

        .slime-pulse,
        .slime-creep,
        .slime-vein {
          will-change: transform, opacity;
        }

        .slime-pulse {
          animation: slimePulse 28s ease-in-out infinite;
        }

        .slime-creep {
          animation: slimeCreep 36s ease-in-out infinite;
        }

        .slime-vein {
          animation: slimeVein 32s ease-in-out infinite;
        }
      `}</style>
    </>
  );
}
