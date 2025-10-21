import { useState, useRef, useEffect } from "react";
import { Send, Mic, Image, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const AICompanion = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hey there! I'm your personal stylist. Tell me what's on your mind—outfit ideas, shopping help, color advice, or anything fashion. I'm here to help! 💫",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [voiceSecondsUsed] = useState(120);
  const voiceSecondsTotal = 300;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
          messages: userMessages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to start chat stream');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let assistantMessage = '';
      let streamDone = false;

      // Add empty assistant message to update
      const assistantMsgId = Date.now().toString();
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      }]);

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
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: assistantMessage } : m
              ));
            }
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get response. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInputValue("");
    setIsLoading(true);

    await streamChat(newMessages);
    setIsLoading(false);
  };

  const voiceMinutesRemaining = Math.floor((voiceSecondsTotal - voiceSecondsUsed) / 60);
  const voiceSecondsRemaining = (voiceSecondsTotal - voiceSecondsUsed) % 60;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4 py-6" ref={scrollRef}>
        <div className="space-y-4 max-w-2xl mx-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground glow-primary"
                    : "glass-card"
                }`}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content || (message.role === "assistant" && isLoading ? "..." : "")}</p>
                <span className="text-xs opacity-60 mt-1 block">
                  {message.timestamp.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="px-4 py-3 border-t border-border/50">
        <div className="flex gap-2 max-w-2xl mx-auto overflow-x-auto pb-2">
          <Button variant="outline" size="sm" className="glass-card border-border/50 whitespace-nowrap">
            <Sparkles className="w-4 h-4 mr-2" />
            Build Outfit
          </Button>
          <Button variant="outline" size="sm" className="glass-card border-border/50 whitespace-nowrap">
            Find Similar
          </Button>
          <Button variant="outline" size="sm" className="glass-card border-border/50 whitespace-nowrap">
            Shop in India
          </Button>
        </div>
      </div>

      {/* Voice Timer */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/20">
        <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto">
          <Mic className="w-4 h-4 text-accent" />
          <span className="text-xs text-muted-foreground">
            Voice time today: {voiceMinutesRemaining}:{voiceSecondsRemaining.toString().padStart(2, "0")} remaining
          </span>
        </div>
      </div>

      {/* Input Area */}
      <div className="px-4 py-4 border-t border-border/50 glass-card">
        <div className="flex items-center gap-2 max-w-2xl mx-auto">
          <Button size="icon" variant="outline" className="glass-card border-border/50">
            <Image className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="outline"
            className="glass-card border-border/50"
            disabled={voiceSecondsUsed >= voiceSecondsTotal}
          >
            <Mic className="w-5 h-5" />
          </Button>
          <Input
            placeholder="Ask me anything about style..."
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 glass-card border-border/50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="glow-primary"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AICompanion;
