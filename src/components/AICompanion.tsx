import { useState, useRef, useEffect } from "react";
import { Send, Camera, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: Date;
}

interface UserProfile {
  name?: string;
  gender?: string;
  location?: string;
}

const QUERY_CARDS = [
  {
    id: 'shop-smarter',
    icon: '🛍️',
    title: 'Shop Smarter',
    subtitle: "Let's Find pieces that feel like you",
    query: 'Help me find pieces that match my style.'
  },
  {
    id: 'mix-match',
    icon: '🎨',
    title: 'Mix & Match',
    subtitle: 'See what works together.',
    query: 'What outfits can I create with what I have?'
  },
  {
    id: 'wardrobe-fit',
    icon: '👔',
    title: 'Wardrobe Fit',
    subtitle: "I'll pull looks straight from your wardrobe.",
    query: 'Create an outfit from my wardrobe items.'
  },
  {
    id: 'plan-fit',
    icon: '📅',
    title: 'Plan My Fit',
    subtitle: "Styling for your next occasion? I've got you.",
    query: 'Help me plan my outfit for an upcoming event.'
  }
];

const SESSION_DURATION = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

const AICompanion = () => {
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [showPrompts, setShowPrompts] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  // Analytics helper
  const trackEvent = (eventName: string, metadata?: any) => {
    console.log(`[Analytics] ${eventName}`, metadata);
  };

  // Load user profile from onboarding
  useEffect(() => {
    const name = localStorage.getItem("onboard_name");
    const gender = localStorage.getItem("onboard_gender");
    const location = localStorage.getItem("onboard_location");
    
    setUserProfile({
      name: name || undefined,
      gender: gender || undefined,
      location: location || undefined,
    });
  }, []);

  // Check session and initialize greeting
  useEffect(() => {
    const lastSession = localStorage.getItem("chat_last_session");
    const sessionMessages = localStorage.getItem("chat_session_messages");
    const now = Date.now();

    // Check if session is still valid (within 6 hours)
    if (lastSession && sessionMessages && (now - parseInt(lastSession)) < SESSION_DURATION) {
      try {
        const savedMessages = JSON.parse(sessionMessages);
        // Convert timestamp strings back to Date objects
        const messagesWithDates = savedMessages.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
        setMessages(messagesWithDates);
        setShowPrompts(messagesWithDates.length <= 1);
        trackEvent("session_restored");
      } catch (e) {
        // Invalid session, start fresh
        initializeSession();
      }
    } else {
      initializeSession();
    }
  }, [userProfile]);

  const initializeSession = () => {
    const userName = userProfile.name || "there";
    
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: `Hey ${userName},\nWelcome to your personal style lab. 👋\n\nI'm here to decode your wardrobe, refine your vibe, and make sure every outfit looks like you actually meant it.`,
      timestamp: new Date(),
    };

    setMessages([greeting]);
    setShowPrompts(true);
    persistMessages([greeting]);
    trackEvent("session_started", { userName });
  };

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: 'smooth'
        });
        }
      }
    }, [messages]);

    // Abort any inflight chat request on unmount
    useEffect(() => {
      return () => {
        abortControllerRef.current?.abort();
      };
    }, []);

    // Persist messages safely without large image payloads
    const persistMessages = (msgs: Message[]) => {
      try {
        const sanitized = msgs.map((m) => ({ ...m, images: undefined }));
        localStorage.setItem("chat_last_session", Date.now().toString());
        localStorage.setItem("chat_session_messages", JSON.stringify(sanitized));
      } catch (e) {
        console.warn("Persist messages failed:", e);
      }
    };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const streamChat = async (userMessages: Message[]) => {
    const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat`;

    // Detect Mobile Safari (known streaming issues after multiple requests)
    const ua = navigator.userAgent;
    const isIOS = /iP(hone|od|ad)/i.test(ua);
    const isMobileSafari = isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);

    // Abort any previous inflight request and start a new controller
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let timeoutId: number | undefined;

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: userMessages.map(m => ({ 
            role: m.role, 
            content: m.content,
            images: m.images 
          })),
          userProfile,
        }),
        cache: 'no-store',
        keepalive: !isMobileSafari,
        mode: 'cors',
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat API error:', response.status, errorText);
        
        if (response.status === 429) {
          toast({
            title: "Rate Limit Reached",
            description: "Too many requests. Please try again in a moment.",
            variant: "destructive",
          });
          trackEvent("rate_limit_error");
          throw new Error('Rate limit exceeded');
        }
        if (response.status === 402) {
          toast({
            title: "Payment Required",
            description: "Please add credits to continue using AI features.",
            variant: "destructive",
          });
          trackEvent("payment_required_error");
          throw new Error('Payment required');
        }
        throw new Error(`Failed to start chat stream: ${response.status}`);
      }

      // Safety timeout to prevent hanging connections on mobile
      if (!timeoutId) {
        const ms = isMobileSafari ? 30000 : 60000;
        timeoutId = window.setTimeout(() => {
          try { controller.abort(); } catch {}
        }, ms);
      }

      // Add empty assistant message to update
      const assistantMsgId = Date.now().toString();
      setMessages(prev => {
        const updated = [...prev, {
          id: assistantMsgId,
          role: 'assistant' as const,
          content: '',
          timestamp: new Date(),
        }];
        return updated;
      });

      let assistantMessage = '';

      // Always force non-stream fallback on Mobile Safari
      if (isMobileSafari) {
        try {
          const fullText = await response.text();
          const lines = fullText.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) assistantMessage += content;
            } catch {}
          }
        } catch (e) {
          console.error('Safari fallback text read failed', e);
        }

        setMessages(prev => {
          const updated = prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: assistantMessage || '...' } : m
          );
          persistMessages(updated);
          return updated;
        });
        trackEvent("reply_delivered");
        // Cleanup controller/timeout for Safari path
        if (timeoutId) clearTimeout(timeoutId);
        abortControllerRef.current = null;
        return; // Done for Mobile Safari
      }

      // Non-Safari: Try streaming first with a clone for safe fallback
      const responseClone = response.clone();

      // Streaming path
      if (response.body && typeof response.body.getReader === 'function') {
        try {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let textBuffer = '';
          let streamDone = false;

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
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  assistantMessage += content;
                  setMessages(prev => {
                    const updated = prev.map(m =>
                      m.id === assistantMsgId ? { ...m, content: assistantMessage } : m
                    );
                    persistMessages(updated);
                    return updated;
                  });
                }
              } catch {
                // If parsing fails mid-stream, push back and let next chunk complete
                textBuffer = line + '\n' + textBuffer;
                break;
              }
            }
          }
        } catch (streamError) {
          console.error('Stream reading failed, will use text fallback:', streamError);
          assistantMessage = '';
        }
      }

      // If we didn't get any streamed content, use text fallback (covers odd Safari cases)
      if (!assistantMessage) {
        try {
          const fullText = await responseClone.text();
          const lines = fullText.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) assistantMessage += content;
            } catch {}
          }
        } catch (e) {
          console.error('Text fallback failed:', e);
        }

        setMessages(prev => {
          const updated = prev.map(m =>
            m.id === assistantMsgId ? { ...m, content: assistantMessage || '...' } : m
          );
          persistMessages(updated);
          return updated;
        });
      }

      trackEvent("reply_delivered");
      // Cleanup controller/timeout
      if (timeoutId) clearTimeout(timeoutId);
      abortControllerRef.current = null;
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
      trackEvent("chat_error", { error: error instanceof Error ? error.message : "Unknown" });
      // Cleanup on error
      try { if (timeoutId) clearTimeout(timeoutId); } catch {}
      abortControllerRef.current = null;
    }
  };

  const handleCardClick = (query: string) => {
    setShowPrompts(false);
    trackEvent("query_card_clicked", { query });
    // Directly send the card query
    handleSend(query);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputValue;
    if ((!textToSend.trim() && selectedImages.length === 0) || isLoading) return;

    const hasImages = selectedImages.length > 0;
    trackEvent("sent_message", { hasImages, messageLength: inputValue.length });
    if (hasImages) trackEvent("uploaded_image", { count: selectedImages.length });

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: textToSend || "What do you think about this outfit?",
      images: selectedImages.length > 0 ? selectedImages : undefined,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");
    setSelectedImages([]);
    setShowPrompts(false);
    setIsLoading(true);

    // Update session
    persistMessages(newMessages);

    try {
      await streamChat(newMessages);
    } catch (error) {
      console.error("Stream chat error:", error);
      // Remove the failed user message if stream completely failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-3 max-w-2xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "glass-card text-foreground"
                }`}
              >
                {message.images && message.images.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {message.images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img}
                        alt="Uploaded"
                        className="rounded-lg w-full h-32 object-cover"
                      />
                    ))}
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {message.id === "greeting" && message.role === "assistant" ? (
                    <>
                      <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                        {message.content.split('\n')[0]}
                      </span>
                      <br />
                      {message.content.split('\n').slice(1).join('\n')}
                    </>
                  ) : (
                    message.content || (message.role === "assistant" && isLoading ? "..." : "")
                  )}
                </p>
                <span className="text-xs opacity-60 mt-1 block">
                  {new Date(message.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Interactive Query Cards */}
      {showPrompts && (
        <div className="px-4 py-3 border-t border-border/50">
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
            {QUERY_CARDS.map((card, index) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.15 }}
                onClick={() => handleCardClick(card.query)}
                className="relative h-[150px] rounded-2xl p-4 flex flex-col items-start justify-between text-left overflow-hidden backdrop-blur-xl bg-[#1B1B22]/60 hover:scale-[1.03] active:scale-[0.97] transition-transform duration-300 group border border-transparent hover:border-primary/30"
                style={{
                  background: 'linear-gradient(135deg, rgba(27, 27, 34, 0.6), rgba(27, 27, 34, 0.8))',
                }}
              >
                {/* Gradient border effect */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" 
                     style={{
                       background: 'linear-gradient(135deg, rgba(200, 108, 246, 0.2), rgba(0, 215, 192, 0.2))',
                       padding: '1px',
                       WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                       WebkitMaskComposite: 'xor',
                       maskComposite: 'exclude',
                     }}
                />
                
                {/* Gradient shimmer animation */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer" />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between">
                  <div className="text-3xl mb-2">{card.icon}</div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">{card.title}</h3>
                    <p className="text-xs text-muted-foreground leading-tight">{card.subtitle}</p>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border/50 glass-card safe-area-bottom">
        <div className="space-y-2 max-w-2xl mx-auto">
          {/* Image Preview */}
          {selectedImages.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {selectedImages.map((img, idx) => (
                <div key={idx} className="relative flex-shrink-0">
                  <img src={img} alt="Selected" className="w-16 h-16 object-cover rounded-lg" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-1 min-w-[24px] min-h-[24px]"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageSelect}
              className="hidden"
            />
            <Button
              size="icon"
              variant="outline"
              className="glass-card border-border/50 flex-shrink-0 min-w-[44px] min-h-[44px]"
              onClick={() => fileInputRef.current?.click()}
              title="Upload outfit image"
            >
              <Camera className="w-5 h-5" />
            </Button>
            <Input
              placeholder="What are we wearing today?"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 glass-card border-border/50 min-h-[44px] text-sm"
            />
            <Button
                data-send-button
                size="icon"
                onClick={() => handleSend()}
                disabled={(!inputValue.trim() && selectedImages.length === 0) || isLoading}
                className="glow-primary flex-shrink-0 min-w-[44px] min-h-[44px]"
                title="Send message"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            
            {/* Guided tip after first message */}
            {messages.length > 1 && messages.length < 4 && !selectedImages.length && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-muted-foreground text-center"
              >
                💡 Upload your look 📸 so I can give you sharper tips
              </motion.p>
            )}
          </div>
      </div>
    </div>
  );
};

export default AICompanion;
