import React, { useState, useEffect } from "react";
import {
  Bot,
  Key,
  Globe,
  Sparkles,
  Check,
  RefreshCw,
  Eye,
  EyeOff,
  Server,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import {
  AiProvider,
  AiSettingsConfig,
  DEFAULT_AI_SETTINGS,
  PROVIDER_DEFAULT_MODELS,
} from "../../types/ai";
import {
  loadAiSettings,
  saveAiSettings,
  fetchAvailableModels,
  fetchAiSettingsFromDb,
} from "../../services/aiService";
import { getSystemDiagnostics } from "../../services/tauriBridge";
import {
  calculateGpuContextRecommendation,
  getContextDropdownOptions,
} from "../chat/gpuContextCalculator";

const PROVIDER_LABELS: Record<AiProvider, string> = {
  ollama: "Ollama (Local)",
  openai: "OpenAI / LM Studio",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
};

export const AITab: React.FC = () => {
  const [settings, setSettings] = useState<AiSettingsConfig>(() => loadAiSettings());
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [testMessage, setTestMessage] = useState("");
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [modelsMessage, setModelsMessage] = useState<string | null>(null);
  const [vramTotalBytes, setVramTotalBytes] = useState<number | undefined>(undefined);
  const [gpuName, setGpuName] = useState<string | undefined>(undefined);

  useEffect(() => {
    getSystemDiagnostics()
      .then((diag) => {
        if (diag) {
          if (typeof diag.vram_total_bytes === "number") setVramTotalBytes(diag.vram_total_bytes);
          if (diag.gpu_name) setGpuName(diag.gpu_name);
        }
      })
      .catch(() => {});
    fetchAiSettingsFromDb().then((dbSettings) => setSettings(dbSettings));
  }, []);

  // Update settings with immediate persistence to ensure changes are never lost
  const updateSettings = (partial: Partial<AiSettingsConfig>) => {
    setSettings((prev) => {
      const next = { ...prev, ...partial };
      saveAiSettings(next);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 1500);
      return next;
    });
  };

  const handleProviderChange = (provider: AiProvider) => {
    const defaults = PROVIDER_DEFAULT_MODELS[provider];
    updateSettings({
      provider,
      model: defaults.defaultModel,
      endpoint: defaults.endpoint || settings.endpoint,
    });
    setAvailableModels([]);
    setModelsMessage(null);
  };

  const handleReset = () => {
    setSettings(DEFAULT_AI_SETTINGS);
    saveAiSettings(DEFAULT_AI_SETTINGS);
    setSavedSuccess(true);
    setAvailableModels([]);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const isLocalHttps =
    settings.endpoint.startsWith("https://localhost") ||
    settings.endpoint.startsWith("https://127.0.0.1");

  const fixLocalHttps = () => {
    const fixed = settings.endpoint.replace("https://", "http://");
    updateSettings({ endpoint: fixed });
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setModelsMessage(null);
    setTestStatus("testing");
    setTestMessage("Querying model server...");

    try {
      const models = await fetchAvailableModels(
        settings.provider,
        settings.endpoint,
        settings.apiKey
      );

      if (models.length > 0) {
        setAvailableModels(models);
        setTestStatus("success");
        setTestMessage(`Server operational! Discovered ${models.length} model(s).`);
        setModelsMessage(`Found ${models.length} model(s) available on server.`);
      } else {
        setTestStatus("error");
        setTestMessage("Server reached, but 0 models found.");
        setModelsMessage("No models detected on server.");
      }
    } catch (err: any) {
      setTestStatus("error");
      const errStr = err?.message || String(err);
      setTestMessage(`Server error: ${errStr}`);
      setModelsMessage(`Connection failed: ${errStr}`);
    } finally {
      setIsFetchingModels(false);
      setTimeout(() => {
        setTestStatus("idle");
        setTestMessage("");
      }, 5000);
    }
  };

  const gpuRec = calculateGpuContextRecommendation(
    settings.model,
    settings.provider,
    vramTotalBytes
  );
  const contextOptions = getContextDropdownOptions(
    settings.model,
    settings.provider,
    vramTotalBytes
  );

  return (
    <div className="space-y-4 font-tech text-xs select-none">
      {/* Provider Selector */}
      <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
        <div className="flex items-center justify-between text-cyan-300 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            AI MODEL PROVIDER
          </span>
          <div className="flex items-center gap-2">
            {savedSuccess && (
              <span className="text-[10px] text-emerald-400 font-tech flex items-center gap-0.5 animate-pulse">
                <Check className="w-3 h-3" /> Auto-saved
              </span>
            )}
            <span className="text-[10px] text-cyan-400/70 font-tech">
              ACTIVE: {settings.provider.toUpperCase()}
            </span>
          </div>
        </div>

        <p className="text-[11px] leading-relaxed text-cyan-200/80">
          Choose your intelligence engine. Ollama and LM Studio (via OpenAI profile) run
          completely offline without sending data to external servers.
        </p>

        {/* Provider Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          {(["ollama", "openai", "anthropic", "gemini"] as AiProvider[]).map((prov) => {
            const isSelected = settings.provider === prov;
            return (
              <button
                key={prov}
                type="button"
                onClick={() => handleProviderChange(prov)}
                className={`p-2.5 rounded border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? "border-cyan-400 bg-cyan-900/30 ring-1 ring-cyan-400/50 shadow-[0_0_12px_rgba(0,229,255,0.25)] text-cyan-100"
                    : "border-cyan-500/20 bg-black/40 text-cyan-300/70 hover:border-cyan-500/50 hover:text-cyan-200"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-[11px] uppercase">{prov}</span>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <span className="text-[10px] opacity-75">{PROVIDER_LABELS[prov]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Model & Credentials Configuration */}
      <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
        <div className="text-cyan-300 font-bold uppercase tracking-wider flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5 text-cyan-400" />
            CREDENTIALS & ENDPOINT
          </span>

          <button
            type="button"
            onClick={handleFetchModels}
            disabled={isFetchingModels}
            className="hud-btn px-2.5 py-1 rounded text-[10px] border border-cyan-400/60 text-cyan-200 hover:text-cyan-100 hover:border-cyan-300 bg-cyan-950/40 hover:bg-cyan-900/50 flex items-center gap-1.5 transition cursor-pointer"
            title="Test connection to server and retrieve list of loaded models"
          >
            <Server className={`w-3 h-3 text-cyan-400 ${isFetchingModels ? "animate-spin" : ""}`} />
            <span>{isFetchingModels ? "QUERYING..." : "TEST SERVER & FETCH MODELS"}</span>
          </button>
        </div>

        {/* Local HTTPS warning */}
        {isLocalHttps && (
          <div className="p-2 rounded bg-amber-950/40 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Local servers (LM Studio, Ollama) use HTTP, not HTTPS.</span>
            </div>
            <button
              type="button"
              onClick={fixLocalHttps}
              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/40 border border-amber-400/60 text-amber-100 text-[10px] font-bold cursor-pointer"
            >
              Fix to http://
            </button>
          </div>
        )}

        {/* Server Models status note */}
        {modelsMessage && (
          <div className="text-[10px] text-cyan-300 bg-black/40 border border-cyan-500/20 rounded px-2.5 py-1.5 flex items-center justify-between">
            <span>{modelsMessage}</span>
            {availableModels.length > 0 && (
              <span className="text-cyan-400/70">Click any model below to select</span>
            )}
          </div>
        )}

        {/* Available Models Pills (if retrieved) */}
        {availableModels.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-cyan-500/20">
            <label className="text-[10px] text-cyan-300/80 uppercase font-semibold flex items-center gap-1">
              <ChevronDown className="w-3 h-3 text-cyan-400" />
              Available Models On Server ({availableModels.length})
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {availableModels.map((m) => {
                const isCurrent = settings.model === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => updateSettings({ model: m })}
                    className={`px-2 py-0.5 rounded text-[10px] border transition cursor-pointer truncate max-w-[220px] ${
                      isCurrent
                        ? "bg-cyan-900/60 border-cyan-400 text-cyan-100 shadow-[0_0_8px_rgba(0,229,255,0.3)] font-bold"
                        : "bg-black/40 border-cyan-500/30 text-cyan-300/80 hover:border-cyan-400 hover:text-cyan-100"
                    }`}
                    title={`Select model: ${m}`}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Model Name */}
          <div className="space-y-1">
            <label htmlFor="ai-model-input" className="text-[11px] text-cyan-300/80 uppercase">
              Model Identifier
            </label>
            <input
              id="ai-model-input"
              type="text"
              value={settings.model}
              onChange={(e) => updateSettings({ model: e.target.value })}
              placeholder="e.g. gemma-4-12b-qat, llama3.2, gpt-4o-mini"
              className="w-full bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-cyan-100 text-xs focus:border-cyan-400 focus:outline-none"
            />
          </div>

          {/* Endpoint */}
          <div className="space-y-1">
            <label htmlFor="ai-endpoint-input" className="text-[11px] text-cyan-300/80 uppercase">
              API Endpoint URL
            </label>
            <input
              id="ai-endpoint-input"
              type="text"
              value={settings.endpoint}
              onChange={(e) => updateSettings({ endpoint: e.target.value })}
              placeholder="http://localhost:1234/v1/chat/completions"
              className="w-full bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-cyan-100 text-xs focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>

        {/* Context Window & GPU VRAM Allocation */}
        <div className="space-y-1.5 pt-1 border-t border-cyan-500/20">
          <div className="flex items-center justify-between">
            <label htmlFor="ai-context-size-select" className="text-[11px] text-cyan-300/80 uppercase font-semibold">
              Context Window & GPU VRAM Allocation
            </label>
            <span
              className={`text-[10px] px-2 py-0.5 rounded border ${
                gpuRec.fitsEntirelyOnGpu
                  ? "border-emerald-500/40 text-emerald-300 bg-emerald-950/40"
                  : "border-amber-500/40 text-amber-300 bg-amber-950/40"
              }`}
              title={gpuRec.tooltip}
            >
              {gpuName ? `${gpuName} · ` : ""}{gpuRec.badgeLabel}
            </span>
          </div>
          <select
            id="ai-context-size-select"
            value={settings.contextSize ?? "auto"}
            onChange={(e) => {
              const val = e.target.value;
              updateSettings({ contextSize: val === "auto" ? "auto" : Number(val) });
            }}
            className="w-full bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-cyan-100 text-xs focus:border-cyan-400 focus:outline-none cursor-pointer"
          >
            {contextOptions.map((opt) => (
              <option key={String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-cyan-400/60 leading-tight">
            {gpuRec.tooltip}
          </p>
        </div>

        {/* API Key (not required for Ollama) */}
        {settings.provider !== "ollama" && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between">
              <label htmlFor="ai-key-input" className="text-[11px] text-cyan-300/80 uppercase">
                API Key (Optional for LM Studio / Local servers)
              </label>
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="text-[10px] text-cyan-400/80 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                title={showApiKey ? "Hide API Key" : "Show API Key"}
              >
                {showApiKey ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                {showApiKey ? "HIDE" : "SHOW"}
              </button>
            </div>
            <input
              id="ai-key-input"
              type={showApiKey ? "text" : "password"}
              value={settings.apiKey}
              onChange={(e) => updateSettings({ apiKey: e.target.value })}
              placeholder={
                settings.endpoint.includes("localhost") || settings.endpoint.includes("127.0.0.1")
                  ? "Local server: enter placeholder (e.g. lm-studio)"
                  : `Enter your ${settings.provider} API key...`
              }
              className="w-full bg-black/60 border border-cyan-500/30 rounded px-2.5 py-1.5 text-cyan-100 text-xs focus:border-cyan-400 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Persona, System Prompt & Agent Capabilities */}
      <div className="bg-cyan-950/40 border border-cyan-500/20 rounded p-3.5 space-y-3">
        <div className="text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          PERSONA & AGENT CAPABILITIES
        </div>

        {/* System Prompt */}
        <div className="space-y-1">
          <label className="text-[11px] text-cyan-300/80 uppercase">System Prompt / HUD Persona</label>
          <textarea
            rows={3}
            value={settings.systemPrompt}
            onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
            className="w-full bg-black/60 border border-cyan-500/30 rounded p-2 text-cyan-100 text-xs focus:border-cyan-400 focus:outline-none leading-relaxed resize-none"
          />
        </div>

        {/* Toggles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
          <label className="flex items-center gap-2 p-2 rounded bg-black/40 border border-cyan-500/20 cursor-pointer hover:border-cyan-400/50">
            <input
              type="checkbox"
              checked={settings.enableContext}
              onChange={(e) => updateSettings({ enableContext: e.target.checked })}
              className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] text-cyan-200">Allow Hardware Diagnostics Tool (CPU, RAM, GPU)</span>
          </label>

          <label className="flex items-center gap-2 p-2 rounded bg-black/40 border border-cyan-500/20 cursor-pointer hover:border-cyan-400/50">
            <input
              type="checkbox"
              checked={settings.enableTools}
              onChange={(e) => updateSettings({ enableTools: e.target.checked })}
              className="accent-cyan-400 w-3.5 h-3.5 cursor-pointer"
            />
            <span className="text-[11px] text-cyan-200">Enable Workspace Tools (Tasks, Goals, Timer)</span>
          </label>

          <div className="flex items-center justify-between p-2 rounded bg-black/40 border border-cyan-500/20">
            <div className="flex flex-col">
              <span className="text-[11px] text-cyan-200">Auto-Compact Threshold</span>
              <span className="text-[9px] text-cyan-400/60">Trigger at % of context window</span>
            </div>
            <select
              aria-label="Auto-Compact Threshold"
              value={settings.autoCompactThresholdPct ?? 70}
              onChange={(e) => updateSettings({ autoCompactThresholdPct: Number(e.target.value) })}
              className="bg-black/60 border border-cyan-500/40 rounded px-2 py-1 text-[11px] text-cyan-200 focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              <option value={0}>Disabled</option>
              <option value={50}>50% of Context</option>
              <option value={60}>60% of Context</option>
              <option value={70}>70% (Default)</option>
              <option value={80}>80% of Context</option>
              <option value={85}>85% of Context</option>
              <option value={90}>90% of Context</option>
            </select>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-cyan-500/20">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleFetchModels}
            disabled={isFetchingModels}
            className="hud-btn px-3 py-1.5 rounded text-[11px] border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 hover:text-cyan-100 transition cursor-pointer flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            {isFetchingModels ? "TESTING..." : "TEST SERVER"}
          </button>

          {testMessage && (
            <span className={`text-[11px] ${testStatus === "success" ? "text-green-400" : testStatus === "error" ? "text-red-400" : "text-cyan-300"}`}>
              {testMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="hud-btn px-3 py-1.5 rounded text-[11px] border border-cyan-500/30 text-cyan-400/70 hover:text-cyan-200 hover:border-cyan-500/50 transition cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" />
            RESET DEFAULTS
          </button>

          <button
            type="button"
            onClick={() => {
              saveAiSettings(settings);
              setSavedSuccess(true);
              setTimeout(() => setSavedSuccess(false), 2000);
            }}
            className="hud-btn-active px-4 py-1.5 rounded text-[11px] border border-cyan-400 text-cyan-100 font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-cyan-400" />
            {savedSuccess ? "SAVED!" : "SAVE SETTINGS"}
          </button>
        </div>
      </div>
    </div>
  );
};
