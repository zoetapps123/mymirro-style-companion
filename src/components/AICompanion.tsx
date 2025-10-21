import { useState } from "react";
import { Send, Mic, Image, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

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
      content: "Hey there! I'm your personal stylist. Tell me about your day—where are you heading? What vibe are you feeling? Or just snap a pic of your outfit and I'll help you nail it. 💫",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [voiceSecondsUsed] = useState(120); // Mock data: 2 minutes used
  const voiceSecondsTotal = 300; // 5 minutes daily cap

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages([...messages, userMessage]);
    setInputValue("");

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I hear you! Let me help you with that. Can you tell me more about the occasion and the vibe you're going for?",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  const voiceMinutesRemaining = Math.floor((voiceSecondsTotal - voiceSecondsUsed) / 60);
  const voiceSecondsRemaining = (voiceSecondsTotal - voiceSecondsUsed) % 60;

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4 py-6">
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
                <p className="text-sm leading-relaxed">{message.content}</p>
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
            disabled={!inputValue.trim()}
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
