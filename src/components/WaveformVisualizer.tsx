import React, { useState, useEffect, useRef } from "react";
import { Edit2, Check } from "lucide-react";

interface WaveformVisualizerProps {
  isCompact?: boolean;
  assistantName?: string;
  onAssistantNameChange?: (name: string) => void;
  isSpeaking?: boolean;
  voiceAmplitude?: number; // 0.0 to 1.0 (for future audio analysis hook)
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isCompact = false,
  assistantName: externalName,
  onAssistantNameChange,
  isSpeaking: externalIsSpeaking,
  voiceAmplitude = 1.0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Assistant name state (persisted in localStorage)
  const [name, setName] = useState<string>(() => {
    return externalName || localStorage.getItem("hud_assistant_name") || "JARVIS";
  });
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(name);

  // Voice activity state: controlled by external prop (false by default -> flatline)
  // Waveform will animate dynamically when voice agent is integrated
  const isVoiceActive = externalIsSpeaking ?? false;

  useEffect(() => {
    if (externalName) {
      setName(externalName);
      setTempName(externalName);
    }
  }, [externalName]);

  const handleSaveName = () => {
    const trimmed = tempName.trim() || "JARVIS";
    setName(trimmed);
    localStorage.setItem("hud_assistant_name", trimmed);
    if (onAssistantNameChange) onAssistantNameChange(trimmed);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveName();
    } else if (e.key === "Escape") {
      setTempName(name);
      setIsEditing(false);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      // Draw subtle background grid
      ctx.strokeStyle = "rgba(0, 229, 255, 0.08)";
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 16) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 12) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Center baseline
      ctx.strokeStyle = "rgba(0, 229, 255, 0.22)";
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();

      if (!isVoiceActive) {
        // Flat waveform line across the center (voice agent will animate when speaking)
        ctx.strokeStyle = "#00e5ff";
        ctx.lineWidth = 1.6;
        ctx.shadowColor = "#00e5ff";
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.stroke();
        return;
      }

      const currentPhase = phase;
      const ampMultiplier = voiceAmplitude;

      // Main active waveform
      ctx.strokeStyle = "#00e5ff";
      ctx.lineWidth = 1.8;
      ctx.shadowColor = "#00e5ff";
      ctx.shadowBlur = 10;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        const envelope = Math.sin((x / width) * Math.PI); // taper at ends
        const wave1 = Math.sin(x * 0.05 + currentPhase * 2) * 11 * ampMultiplier;
        const wave2 = Math.sin(x * 0.12 - currentPhase * 3) * 5 * ampMultiplier;
        const wave3 = Math.cos(x * 0.03 + currentPhase) * 7 * ampMultiplier;
        const jitter = (Math.random() - 0.5) * 2;
        const y = centerY + (wave1 + wave2 + wave3 + jitter) * envelope;

        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Second harmonic wave
      ctx.strokeStyle = "rgba(0, 229, 255, 0.38)";
      ctx.lineWidth = 1;
      ctx.shadowBlur = 2;
      ctx.beginPath();
      for (let x = 0; x < width; x += 2) {
        const envelope = Math.sin((x / width) * Math.PI);
        const y =
          centerY + Math.sin(x * 0.08 + currentPhase * 1.5) * 14 * ampMultiplier * envelope;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += 0.045;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isVoiceActive, voiceAmplitude]);

  return (
    <div className="relative w-full rounded bg-cyan-950/20 border border-cyan-500/20 p-2 overflow-hidden">
      {/* Header Above Wave: Assistant Name */}
      <div className="flex justify-between items-center text-[11px] text-cyan-300 font-tech uppercase tracking-wider mb-1.5">
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <div className="flex items-center gap-1">
              <input
                id="assistant-name-input"
                name="assistantName"
                type="text"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveName}
                autoFocus
                className="bg-black/80 border border-cyan-400 rounded px-1.5 py-0.5 text-xs font-orbitron font-bold text-cyan-200 outline-none w-28"
              />
              <button
                onClick={handleSaveName}
                title="Save Name"
                className="text-cyan-400 hover:text-cyan-200 p-0.5"
              >
                <Check className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div
              onClick={() => {
                setTempName(name);
                setIsEditing(true);
              }}
              title="Click to rename assistant"
              className="group flex items-center gap-1.5 cursor-pointer hover:text-white transition"
            >
              <span className="font-orbitron font-bold tracking-widest text-cyan-200 group-hover:text-cyan-100 hud-glow-cyan text-xs">
                {name}
              </span>
              <Edit2 className="w-2.5 h-2.5 text-cyan-500/60 group-hover:text-cyan-300 opacity-60 group-hover:opacity-100 transition" />
            </div>
          )}
        </div>

        <span className="text-[9px] font-tech text-cyan-500/50 tracking-wider">
          AI AGENT
        </span>
      </div>

      {/* Waveform Canvas with strictly fixed vertical height */}
      <div className="w-full flex items-center justify-center h-[56px] overflow-hidden">
        <canvas
          ref={canvasRef}
          width={isCompact ? 200 : 280}
          height={56}
          style={{ height: "56px" }}
          className="w-full h-[56px] block"
        />
      </div>

      {/* Text below the wave has been completely removed as requested */}
    </div>
  );
};
