import React, { useState, useRef } from "react";
import { Send, Bot, User, Radio, Sparkles } from "lucide-react";
import { ChatMessage } from "../../types/hud";

const SAMPLE_RESPONSES = [
  "Analyzing system telemetry... All core processes are operating within nominal thresholds. Memory allocation is stable at 48% and GPU rendering latency is 2.4ms.",
  "Understood. I have logged your action plan into the local database and synced it with your current Pomodoro cycle. Next focus block is scheduled in 15 minutes.",
  "FocusHUD diagnostics show zero dropped frames on the Win32 stationary canvas clipping pipeline. External windows are snapping smoothly between the dual docks.",
  "Task decomposition complete: 1 primary goal has been divided into 3 actionable milestones with nested subtasks. The 3D neural tree projection is updated.",
];

export const ChatView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "m0",
      role: "assistant",
      content: "FocusHUD Tactical Intelligence Online. How may I assist your workflow today?",
      timestamp: "10:00",
    },
  ]);

  const [inputText, setInputText] = useState("");
  const [streamMode, setStreamMode] = useState<boolean>(true); // Stream vs Send When Complete
  const [isGenerating, setIsGenerating] = useState(false);

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const activeAssistantMsgRef = useRef<HTMLDivElement | null>(null);

  const handleSend = () => {
    if (!inputText.trim() || isGenerating) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      role: "user",
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText("");
    setIsGenerating(true);

    const randomResponse = SAMPLE_RESPONSES[Math.floor(Math.random() * SAMPLE_RESPONSES.length)];
    const assistantId = "bot_" + Date.now();

    if (streamMode) {
      // Streaming mode: append characters progressively
      let charIndex = 0;
      const initialBotMsg: ChatMessage = {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages([...nextMessages, initialBotMsg]);

      const interval = setInterval(() => {
        charIndex += 2;
        const currentSlice = randomResponse.slice(0, charIndex);

        setMessages((prev) =>
          prev.map((msg) => (msg.id === assistantId ? { ...msg, content: currentSlice } : msg))
        );

        if (charIndex >= randomResponse.length) {
          clearInterval(interval);
          setIsGenerating(false);

          // Crucial user requirement:
          // "When the response is complete the chat will not automatically scroll to the end of the response but stay at the start of it."
          scrollToStartOfResponse();
        }
      }, 25);
    } else {
      // Send when complete mode: delay slightly then reveal full message at once
      setTimeout(() => {
        const fullBotMsg: ChatMessage = {
          id: assistantId,
          role: "assistant",
          content: randomResponse,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages([...nextMessages, fullBotMsg]);
        setIsGenerating(false);

        // Crucial user requirement:
        // "When the response is complete the chat will not automatically scroll to the end of the response but stay at the start of it."
        setTimeout(scrollToStartOfResponse, 50);
      }, 800);
    }
  };

  const scrollToStartOfResponse = () => {
    if (activeAssistantMsgRef.current) {
      activeAssistantMsgRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="h-full w-full flex flex-col p-2.5 bg-[#03070d] text-cyan-300 font-hud overflow-hidden select-none">
      {/* Header with Streaming Mode Toggle */}
      <div className="w-full flex items-center justify-between border-b border-cyan-500/30 pb-2 mb-2 text-[10px] font-tech uppercase tracking-wider">
        <div className="flex items-center gap-1.5">
          <Bot className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-cyan-200">AI AGENT CHAT</span>
        </div>

        {/* Streaming Mode Toggle */}
        <button
          onClick={() => setStreamMode(!streamMode)}
          title="Toggle between real-time streaming and complete message dispatch"
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded border transition cursor-pointer ${
            streamMode
              ? "bg-cyan-950/60 border-cyan-400/60 text-cyan-200 shadow-[0_0_8px_rgba(0,229,255,0.3)]"
              : "bg-black/40 border-cyan-500/20 text-cyan-400/70 hover:text-cyan-200"
          }`}
        >
          <Radio className={`w-3 h-3 ${streamMode ? "text-cyan-400 animate-pulse" : "text-neutral-500"}`} />
          <span>{streamMode ? "MODE: STREAMING" : "MODE: COMPLETE"}</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 font-tech"
      >
        {messages.map((msg, idx) => {
          const isUser = msg.role === "user";
          const isLastAssistant = !isUser && idx === messages.length - 1;

          return (
            <div
              key={msg.id}
              ref={isLastAssistant ? activeAssistantMsgRef : null}
              className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
            >
              <div className="flex items-center gap-1 text-[9px] text-cyan-500/60 mb-0.5 px-1 uppercase tracking-wider">
                {isUser ? (
                  <>
                    <span>OPERATOR</span>
                    <User className="w-2.5 h-2.5 text-cyan-400" />
                  </>
                ) : (
                  <>
                    <Bot className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-amber-400/80">AGENT JARVIS</span>
                  </>
                )}
                <span>· {msg.timestamp}</span>
              </div>

              <div
                className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed border ${
                  isUser
                    ? "bg-cyan-950/40 border-cyan-500/40 text-cyan-100 shadow-[0_0_10px_rgba(0,229,255,0.15)]"
                    : "bg-[#090b10] border-amber-500/30 text-amber-100/90 shadow-[0_0_12px_rgba(255,145,0,0.1)]"
                }`}
              >
                {msg.content ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <span className="inline-flex items-center gap-1 text-cyan-400/60 italic text-[11px]">
                    <Sparkles className="w-3 h-3 animate-spin" /> Generating response...
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Box */}
      <div className="mt-2 pt-2 border-t border-cyan-500/30 flex items-center gap-1.5">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask local agent..."
          disabled={isGenerating}
          className="flex-1 bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-xs text-cyan-200 placeholder-cyan-500/40 focus:outline-none focus:border-cyan-400 transition"
        />

        <button
          onClick={handleSend}
          disabled={!inputText.trim() || isGenerating}
          title="Send Command"
          className="p-1.5 rounded bg-cyan-600/30 hover:bg-cyan-500/40 border border-cyan-400/50 hover:border-cyan-300 text-cyan-200 disabled:opacity-40 transition cursor-pointer"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
