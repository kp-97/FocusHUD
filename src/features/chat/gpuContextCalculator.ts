export interface GpuContextRecommendation {
  recommendedTokens: number;
  fitsEntirelyOnGpu: boolean;
  vramTierGb: number;
  modelParamsB: number;
  estimatedWeightsGb: number;
  badgeLabel: string;
  tooltip: string;
}

export interface ContextDropdownOption {
  label: string;
  value: number | "auto";
  isRecommended: boolean;
  fitsInVram: boolean;
}

export const STANDARD_CONTEXT_OPTIONS = [
  { label: "Auto (Optimal GPU Fit)", value: "auto" as const },
  { label: "4,096 tokens (4k)", value: 4096 },
  { label: "8,192 tokens (8k)", value: 8192 },
  { label: "16,384 tokens (16k)", value: 16384 },
  { label: "32,768 tokens (32k)", value: 32768 },
  { label: "64,000 tokens (64k)", value: 64000 },
  { label: "128,000 tokens (128k)", value: 128000 },
];

/**
 * Returns tailored dropdown options with explicit VRAM recommendations per option
 * based on the system's detected VRAM and the selected model.
 */
export function getContextDropdownOptions(
  modelName: string,
  provider?: string,
  vramTotalBytes?: number
): ContextDropdownOption[] {
  const rec = calculateGpuContextRecommendation(modelName, provider, vramTotalBytes);
  const recStr =
    rec.recommendedTokens >= 1024
      ? `${Math.round(rec.recommendedTokens / 1024)}k`
      : `${rec.recommendedTokens}`;

  const isCloud = isCloudModel(modelName, provider);

  const baseValues: Array<{ rawLabel: string; value: number }> = [
    { rawLabel: "4,096 tokens (4k)", value: 4096 },
    { rawLabel: "8,192 tokens (8k)", value: 8192 },
    { rawLabel: "16,384 tokens (16k)", value: 16384 },
    { rawLabel: "32,768 tokens (32k)", value: 32768 },
    { rawLabel: "64,000 tokens (64k)", value: 64000 },
    { rawLabel: "128,000 tokens (128k)", value: 128000 },
  ];

  const options: ContextDropdownOption[] = [
    {
      label: `Auto (${isCloud ? "Cloud Native" : `Recommended: ${recStr}`})`,
      value: "auto",
      isRecommended: true,
      fitsInVram: rec.fitsEntirelyOnGpu,
    },
  ];

  for (const item of baseValues) {
    if (isCloud) {
      const isRec = item.value === rec.recommendedTokens;
      options.push({
        label: isRec ? `${item.rawLabel} — ⭐ Recommended` : item.rawLabel,
        value: item.value,
        isRecommended: isRec,
        fitsInVram: true,
      });
      continue;
    }

    const kvGb = item.value * 0.000128;
    const totalRequiredGb = rec.estimatedWeightsGb + kvGb;
    const vramGb = rec.vramTierGb > 0 ? rec.vramTierGb : 8;
    const usableVramGb = Math.max(0, vramGb - 1.7);
    const fits = totalRequiredGb <= usableVramGb;
    const isRec = item.value === rec.recommendedTokens && rec.fitsEntirelyOnGpu;

    let tag = "";
    if (isRec) {
      tag = " — ⭐ Recommended (100% GPU Fit)";
    } else if (fits) {
      tag = " — ✓ Fits in VRAM";
    } else {
      tag = " — ⚠️ Exceeds VRAM (Spills to RAM)";
    }

    options.push({
      label: `${item.rawLabel}${tag}`,
      value: item.value,
      isRecommended: isRec,
      fitsInVram: fits,
    });
  }

  return options;
}

/**
 * Extracts estimated model parameter count in billions from common model naming conventions.
 */
export function parseModelParameterSize(modelName: string): number {
  const lower = (modelName || "").toLowerCase();

  // Explicit parameter match (e.g. "llama3.1:8b", "qwen2.5:14b", "phi3:3.8b")
  const paramMatch = lower.match(/(\d+(?:\.\d+)?)\s*b\b/);
  if (paramMatch && paramMatch[1]) {
    const val = parseFloat(paramMatch[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // Known models
  if (lower.includes("llama3.2")) return 3;
  if (lower.includes("llama3.1") || lower.includes("llama3") || lower.includes("mistral")) return 8;
  if (lower.includes("phi-3") || lower.includes("phi3")) return 3.8;
  if (lower.includes("qwen") || lower.includes("deepseek")) return 7;
  if (lower.includes("gemma2:2b")) return 2;
  if (lower.includes("gemma2:9b") || lower.includes("gemma")) return 9;

  return 7; // Default baseline estimate
}

/**
 * Determines whether the model is a cloud provider model (OpenAI, Anthropic, Gemini).
 */
export function isCloudModel(modelName: string, provider?: string): boolean {
  const p = (provider || "").toLowerCase();
  if (p === "openai" || p === "anthropic" || p === "gemini") return true;
  const m = (modelName || "").toLowerCase();
  return (
    m.startsWith("gpt-") ||
    m.startsWith("claude-") ||
    m.startsWith("gemini-") ||
    m.includes("o1") ||
    m.includes("o3")
  );
}

/**
 * Calculates the maximum safe context window that fits 100% in local GPU VRAM.
 */
export function calculateGpuContextRecommendation(
  modelName: string,
  provider?: string,
  vramTotalBytes?: number
): GpuContextRecommendation {
  if (isCloudModel(modelName, provider)) {
    const m = modelName.toLowerCase();
    const recommendedTokens = m.includes("gemini")
      ? 1_000_000
      : m.includes("claude")
      ? 200_000
      : 128_000;

    return {
      recommendedTokens,
      fitsEntirelyOnGpu: true,
      vramTierGb: 0,
      modelParamsB: 0,
      estimatedWeightsGb: 0,
      badgeLabel: "Cloud Managed Context",
      tooltip: "Cloud provider handles execution off-device without local GPU VRAM limits.",
    };
  }

  // Local Ollama / GGUF model
  const paramsB = parseModelParameterSize(modelName);
  // 4.5-bit quantization weights estimate in GB
  const estimatedWeightsGb = Number(((paramsB * 10 ** 9 * 4.5) / 8 / 1024 ** 3).toFixed(1));

  // Determine available VRAM in GB (fallback to 8GB if undetected)
  const vramGb = vramTotalBytes && vramTotalBytes > 0
    ? Number((vramTotalBytes / 1024 ** 3).toFixed(1))
    : 8;

  // OS display & desktop window manager reserve: ~1.2 GB
  // CUDA scratchpad/graph overhead: ~0.5 GB
  const usableVramGb = Math.max(0, vramGb - 1.7);
  const freeForKvCacheGb = usableVramGb - estimatedWeightsGb;

  if (freeForKvCacheGb < 0.4) {
    // Model exceeds or completely saturates VRAM
    return {
      recommendedTokens: 4096,
      fitsEntirelyOnGpu: false,
      vramTierGb: vramGb,
      modelParamsB: paramsB,
      estimatedWeightsGb,
      badgeLabel: "Partial GPU Offload",
      tooltip: `Model weights (${estimatedWeightsGb}GB) exceed safe VRAM (${vramGb}GB). Layers will offload to CPU RAM.`,
    };
  }

  // KV cache at 16-bit precision with GQA: ~0.128 MB per token (0.000128 GB/token)
  const estimatedTokens = Math.floor(freeForKvCacheGb / 0.000128);

  let recommendedTokens = 4096;
  if (estimatedTokens >= 128000) recommendedTokens = 128000;
  else if (estimatedTokens >= 64000) recommendedTokens = 64000;
  else if (estimatedTokens >= 32768) recommendedTokens = 32768;
  else if (estimatedTokens >= 16384) recommendedTokens = 16384;
  else if (estimatedTokens >= 8192) recommendedTokens = 8192;
  else recommendedTokens = 4096;

  const badgeContextStr =
    recommendedTokens >= 1000 ? `${Math.round(recommendedTokens / 1024)}k` : `${recommendedTokens}`;

  return {
    recommendedTokens,
    fitsEntirelyOnGpu: true,
    vramTierGb: vramGb,
    modelParamsB: paramsB,
    estimatedWeightsGb,
    badgeLabel: `100% GPU Fit (Max ${badgeContextStr})`,
    tooltip: `Detected ${vramGb}GB VRAM. Model weights (${estimatedWeightsGb}GB) + ${badgeContextStr} tokens fit completely in GPU memory.`,
  };
}

/**
 * Resolves the numeric context limit based on settings and hardware capability.
 */
export function resolveEffectiveContextLimit(
  configuredContext: number | "auto" | undefined,
  modelName: string,
  provider?: string,
  vramTotalBytes?: number
): number {
  if (typeof configuredContext === "number" && configuredContext > 0) {
    return configuredContext;
  }
  const recommendation = calculateGpuContextRecommendation(modelName, provider, vramTotalBytes);
  return recommendation.recommendedTokens;
}
