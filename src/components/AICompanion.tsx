import { useState, useRef, useEffect } from "react";
import { Send, Camera, X, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

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

const QUICK_PROMPTS = [
  "How do I style this better?",
  "Outfit ideas for dinner?",
  "What can I pair this with?",
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

  // Analytics helper
  const trackEvent = (eventName: string, metadata?: any) => {
    console.log(`[Analytics] ${eventName}`, metadata);
  };

  // Load user profile from onboarding
  useEffect(() => {
    const onboardingData = localStorage.getItem("onboardingData");
    if (onboardingData) {
      try {
        const profile = JSON.parse(onboardingData);
        setUserProfile(profile);
      } catch (e) {
        console.error("Failed to parse onboarding data", e);
      }
    }
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
        setShowPrompts(false);
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
    const genderTone = userProfile.gender === "male" ? "bro" : userProfile.gender === "female" ? "girl" : "friend";
    const userName = userProfile.name || "there";
    
    const greeting: Message = {
      id: "greeting",
      role: "assistant",
      content: `Hey ${userName} 👋 ready to style something up today, ${genderTone}?`,
      timestamp: new Date(),
    };

    setMessages([greeting]);
    setShowPrompts(true);
    localStorage.setItem("chat_last_session", Date.now().toString());
    localStorage.setItem("chat_session_messages", JSON.stringify([greeting]));
    trackEvent("session_started", { userName });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
      });

      if (!response.ok || !response.body) {
        if (response.status === 429) {
          toast({
            title: "Rate Limit Reached",
            description: "Too many requests. Please try again in a moment.",
            variant: "destructive",
          });
          trackEvent("rate_limit_error");
          return;
        }
        if (response.status === 402) {
          toast({
            title: "Payment Required",
            description: "Please add credits to continue using AI features.",
            variant: "destructive",
          });
          trackEvent("payment_required_error");
          return;
        }
        throw new Error('Failed to start chat stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantMessage = '';
      let streamDone = false;

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
                // Save to localStorage for session persistence
                localStorage.setItem("chat_session_messages", JSON.stringify(updated));
                return updated;
              });
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
      
      trackEvent("reply_delivered");
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
      trackEvent("chat_error", { error: error instanceof Error ? error.message : "Unknown" });
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInputValue(prompt);
    setShowPrompts(false);
    trackEvent("prompt_clicked", { prompt });
    // Auto-send after selecting prompt
    setTimeout(() => {
      const btn = document.querySelector('[data-send-button]') as HTMLButtonElement;
      btn?.click();
    }, 100);
  };

  const handleSend = async () => {
    if ((!inputValue.trim() && selectedImages.length === 0) || isLoading) return;

    const hasImages = selectedImages.length > 0;
    trackEvent("sent_message", { hasImages, messageLength: inputValue.length });
    if (hasImages) trackEvent("uploaded_image", { count: selectedImages.length });

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue || "What do you think about this outfit?",
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
    localStorage.setItem("chat_last_session", Date.now().toString());
    localStorage.setItem("chat_session_messages", JSON.stringify(newMessages));

    await streamChat(newMessages);
    setIsLoading(false);
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
                  {message.content || (message.role === "assistant" && isLoading ? "..." : "")}
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

      {/* Quick Start Prompts */}
      {showPrompts && messages.length <= 1 && (
        <div className="px-4 py-2 border-t border-border/50">
          <div className="flex gap-2 max-w-2xl mx-auto overflow-x-auto pb-1 scrollbar-hide">
            {QUICK_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                variant="outline"
                size="sm"
                onClick={() => handlePromptClick(prompt)}
                className="glass-card border-border/50 whitespace-nowrap text-xs min-h-[36px]"
              >
                {prompt}
              </Button>
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
              placeholder="Ask about your style..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
              className="flex-1 glass-card border-border/50 min-h-[44px] text-sm"
            />
            <Button
              data-send-button
              size="icon"
              onClick={handleSend}
              disabled={(!inputValue.trim() && selectedImages.length === 0) || isLoading}
              className="glow-primary flex-shrink-0 min-w-[44px] min-h-[44px]"
              title="Send message"
            >
              <Send className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICompanion;
