import { useState, useRef, useEffect } from "react";
import { Send, Camera, X, Sparkles, RotateCcw, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { WardrobeItemsDisplay, OutfitSuggestionDisplay } from "./chat/ChatVisualElements";
import { useAnalytics } from "@/hooks/useAnalytics";

interface ToolCall {
  type: 'show_wardrobe_items' | 'create_outfit_suggestion';
  data: any;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  images?: string[];
  timestamp: Date;
  toolCalls?: ToolCall[];
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

const SESSION_DURATION = Number.MAX_SAFE_INTEGER; // Indefinite session

const AICompanion = () => {
  const [userProfile, setUserProfile] = useState<UserProfile>({});
  const [showPrompts, setShowPrompts] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [chatError, setChatError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);
  const { trackCustom } = useAnalytics();
  const chatStartTimeRef = useRef<number>(Date.now());
  const messageCountRef = useRef<number>(0);

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

  const resetChat = () => {
    const userName = userProfile.name || "there";
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: `Hey ${userName} 👋\nWelcome to your personal style lab.\n\nI'm here to decode your wardrobe, refine your vibe, and make sure every outfit looks like you actually meant it.`,
      timestamp: new Date(),
    };
    setMessages([greeting]);
    setShowPrompts(true);
    persistMessages([greeting]);
    trackCustom("chat_reset");
  };

  // Check session and initialize greeting
  useEffect(() => {
    // Don't initialize until profile is loaded
    if (!userProfile.name && localStorage.getItem("onboard_name")) return;

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
        trackCustom("session_restored");
      } catch (e) {
        // Invalid session, start fresh
        initializeSession();
      }
    } else {
      initializeSession();
    }
  }, [userProfile.name]);

  const initializeSession = () => {
    const userName = userProfile.name || "there";
    
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: `Hey ${userName} 👋\nWelcome to your personal style lab.\n\nI'm here to decode your wardrobe, refine your vibe, and make sure every outfit looks like you actually meant it.`,
      timestamp: new Date(),
    };

    setMessages([greeting]);
    setShowPrompts(true);
    persistMessages([greeting]);
    trackCustom("session_started", { userName });
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

    // Get current user and session for authentication
    const { data: { user } } = await supabase.auth.getUser();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      toast({
        title: "Authentication Required",
        description: "Please sign in to use the chat feature.",
        variant: "destructive",
      });
      return;
    }

    // Fetch recent fashion history for context
    let recentBattles: any[] = [];
    let recentStyleChecks: any[] = [];
    if (user) {
      try {
        const { data: battles } = await supabase
          .from('battles')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        recentBattles = battles || [];

        const { data: checks } = await supabase
          .from('style_checks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(3);
        recentStyleChecks = checks || [];
      } catch (e) {
        console.error('Failed to fetch fashion history:', e);
      }
    }

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
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: userMessages.map(m => ({ 
            role: m.role, 
            content: m.content,
            images: m.images 
          })),
          userProfile,
          recentBattles,
          recentStyleChecks,
        }),
        cache: 'no-store',
        keepalive: !isMobileSafari,
        mode: 'cors',
        signal: controller.signal,
      });

      // Check for errors BEFORE adding assistant message
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Chat API error:', response.status, errorText);
        
        let errorMessage = "Unable to connect to AI. Please try again.";
        
        if (response.status === 429) {
          errorMessage = "Too many requests. Please try again in a moment.";
          trackCustom("rate_limit_error");
        } else if (response.status === 402) {
          errorMessage = "Service unavailable. Please contact support.";
          trackCustom("payment_required_error");
        } else if (response.status === 401) {
          errorMessage = "Authentication error. Please sign in again.";
          trackCustom("auth_error");
        } else {
          trackCustom("chat_api_error", { status: response.status });
        }
        
        setChatError(errorMessage);
        return; // Exit early without adding empty message
      }
      
      // Clear any previous errors on successful connection
      setChatError(null);

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
          toolCalls: [],
        }];
        return updated;
      });

      let assistantMessage = '';
      let collectedToolCalls: ToolCall[] = [];

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
        trackCustom("reply_delivered");
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
                const delta = parsed.choices?.[0]?.delta;
                const content = delta?.content;
                const toolCalls = delta?.tool_calls;

                if (content) {
                  assistantMessage += content;
                  setMessages(prev => {
                    const updated = prev.map(m =>
                      m.id === assistantMsgId ? { ...m, content: assistantMessage, toolCalls: collectedToolCalls } : m
                    );
                    persistMessages(updated);
                    return updated;
                  });
                }

                if (toolCalls) {
                  toolCalls.forEach((tc: any) => {
                    if (tc.function?.name && tc.function?.arguments) {
                      try {
                        const args = JSON.parse(tc.function.arguments);
                        collectedToolCalls.push({
                          type: tc.function.name as any,
                          data: args
                        });
                      } catch (e) {
                        console.error('Failed to parse tool call args:', e);
                      }
                    }
                  });
                  setMessages(prev => {
                    const updated = prev.map(m =>
                      m.id === assistantMsgId ? { ...m, content: assistantMessage, toolCalls: collectedToolCalls } : m
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

        if (!assistantMessage) {
          // No content received at all – show banner and remove empty assistant bubble
          setMessages(prev => prev.filter(m => m.id !== assistantMsgId));
          setChatError("The AI didn't send a response. Please try again.");
        } else {
          setMessages(prev => {
            const updated = prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: assistantMessage } : m
            );
            persistMessages(updated);
            return updated;
          });
        }
      }

      trackCustom("reply_delivered");
      // Cleanup controller/timeout
      if (timeoutId) clearTimeout(timeoutId);
      abortControllerRef.current = null;
    } catch (error) {
      console.error('Chat error:', error);
      
      let errorMessage = "Failed to get response. Please try again.";
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "Request cancelled. Please try again.";
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      }
      
      setChatError(errorMessage);
      trackCustom("chat_error", { error: error instanceof Error ? error.message : "Unknown" });
      // Cleanup on error
      try { if (timeoutId) clearTimeout(timeoutId); } catch {}
      abortControllerRef.current = null;
    }
  };

  const handleCardClick = (query: string) => {
    setShowPrompts(false);
    trackCustom("query_card_clicked", { query });
    // Directly send the card query
    handleSend(query);
  };

  const handleSend = async (messageText?: string) => {
    const textToSend = messageText || inputValue;
    if ((!textToSend.trim() && selectedImages.length === 0) || isLoading) return;

    // Clear any previous errors
    setChatError(null);

    // Track chat message
    messageCountRef.current += 1;
    const timeSpentSeconds = Math.floor((Date.now() - chatStartTimeRef.current) / 1000);
    trackCustom('chat_message_sent', {
      message_number: messageCountRef.current,
      time_in_chat_seconds: timeSpentSeconds,
      has_images: selectedImages.length > 0,
      image_count: selectedImages.length,
      message_length: textToSend.length
    });

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
      {/* New Chat Button */}
      <div className="px-4 pt-4 pb-2 border-b border-border/50 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Chat</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={resetChat}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          New Chat
        </Button>
      </div>
      
      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef}>
        <div className="space-y-3 max-w-2xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] ${
                  message.role === "user"
                    ? ""
                    : ""
                }`}
              >
                {message.role === "user" ? (
                  <div className="rounded-2xl px-4 py-3 bg-primary text-primary-foreground">
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
                      {message.content}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {message.content && (
                      <div className="rounded-2xl px-4 py-3 bg-muted/50 text-foreground border border-border">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.id === "greeting" ? (
                            <>
                              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                                {message.content.split('\n')[0]}
                              </span>
                              <br />
                              {message.content.split('\n').slice(1).join('\n')}
                            </>
                          ) : (
                            message.content || (isLoading ? "..." : "")
                          )}
                        </p>
                      </div>
                    )}
                    {message.toolCalls?.map((tc, tcIdx) => (
                      <div key={tcIdx}>
                        {tc.type === 'show_wardrobe_items' && (
                          <WardrobeItemsDisplay
                            itemIds={tc.data.item_ids}
                            context={tc.data.context}
                          />
                        )}
                        {tc.type === 'create_outfit_suggestion' && (
                          <OutfitSuggestionDisplay
                            outfitName={tc.data.outfit_name}
                            itemIds={tc.data.item_ids}
                            reasoning={tc.data.reasoning}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Interactive Query Cards */}
      {showPrompts && messages.length <= 2 && (
        <div className="px-4 py-3 border-t border-border/50">
          <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
            {QUERY_CARDS.map((card, index) => (
              <motion.button
                key={card.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleCardClick(card.query)}
                className="glass-card p-4 rounded-2xl text-left hover:glow-primary transition-all duration-300 group"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform">
                  {card.icon}
                </span>
                <h3 className="font-semibold text-sm mb-1 text-foreground">
                  {card.title}
                </h3>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {card.subtitle}
                </p>
              </motion.button>
            ))}
          </div>
        </div>
      )}

      {/* Error Banner */}
      <AnimatePresence>
        {chatError && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="px-4 py-3 border-t border-border/50"
          >
            <div className="max-w-2xl mx-auto">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-destructive font-medium mb-2">
                    {chatError}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setChatError(null);
                      // Retry the last user message
                      const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
                      if (lastUserMsg) {
                        handleSend(lastUserMsg.content);
                      }
                    }}
                    className="text-xs h-8"
                  >
                    Try Again
                  </Button>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setChatError(null)}
                  className="h-6 w-6 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <div className="px-4 py-3 border-t border-border bg-background safe-area-bottom">
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
              className="border-border flex-shrink-0 min-w-[44px] min-h-[44px] bg-background"
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
              className="flex-1 border-border min-h-[44px] text-sm bg-background"
            />
            <Button
              data-send-button
              size="icon"
              onClick={() => handleSend()}
              disabled={(!inputValue.trim() && selectedImages.length === 0) || isLoading}
              className="flex-shrink-0 min-w-[44px] min-h-[44px] bg-foreground text-background hover:bg-foreground/90"
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
