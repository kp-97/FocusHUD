import { describe, it, expect } from "vitest";
import {
  parseModelParameterSize,
  isCloudModel,
  calculateGpuContextRecommendation,
  resolveEffectiveContextLimit,
  getContextDropdownOptions,
} from "./gpuContextCalculator";

describe("gpuContextCalculator", () => {
  it("parses model parameter sizes accurately", () => {
    expect(parseModelParameterSize("llama3.1:8b")).toBe(8);
    expect(parseModelParameterSize("qwen2.5:14b")).toBe(14);
    expect(parseModelParameterSize("deepseek-r1:32b")).toBe(32);
    expect(parseModelParameterSize("llama3.2")).toBe(3);
    expect(parseModelParameterSize("gemma2:9b")).toBe(9);
    expect(parseModelParameterSize("custom-model")).toBe(7);
  });

  it("identifies cloud models", () => {
    expect(isCloudModel("gpt-4o", "openai")).toBe(true);
    expect(isCloudModel("claude-3-5-sonnet", "anthropic")).toBe(true);
    expect(isCloudModel("gemini-1.5-flash", "gemini")).toBe(true);
    expect(isCloudModel("llama3.1:8b", "ollama")).toBe(false);
  });

  it("recommends 100% GPU fit for 8B model on 12GB VRAM", () => {
    const vram12Gb = 12 * 1024 ** 3;
    const rec = calculateGpuContextRecommendation("llama3.1:8b", "ollama", vram12Gb);
    expect(rec.fitsEntirelyOnGpu).toBe(true);
    expect(rec.recommendedTokens).toBeGreaterThanOrEqual(32768);
    expect(rec.badgeLabel).toContain("100% GPU Fit");
  });

  it("flags partial offload if model weights exceed VRAM", () => {
    const vram6Gb = 6 * 1024 ** 3;
    const rec = calculateGpuContextRecommendation("qwen2.5:14b", "ollama", vram6Gb);
    expect(rec.fitsEntirelyOnGpu).toBe(false);
    expect(rec.badgeLabel).toBe("Partial GPU Offload");
  });

  it("resolves effective context limit properly", () => {
    expect(resolveEffectiveContextLimit(16384, "llama3.1:8b")).toBe(16384);
    const vram8Gb = 8 * 1024 ** 3;
    expect(resolveEffectiveContextLimit("auto", "llama3.1:8b", "ollama", vram8Gb)).toBeGreaterThanOrEqual(8192);
  });

  it("formats dropdown options with recommended option and VRAM tags", () => {
    const vram12Gb = 12 * 1024 ** 3;
    const options = getContextDropdownOptions("llama3.1:8b", "ollama", vram12Gb);
    expect(options.length).toBe(7);
    expect(options[0].label).toContain("Auto (Recommended:");
    const recommendedOpt = options.find((o) => o.isRecommended && o.value !== "auto");
    expect(recommendedOpt).toBeDefined();
    expect(recommendedOpt?.label).toContain("⭐ Recommended (100% GPU Fit)");

    const exceedsOpt = options.find((o) => o.value === 128000);
    expect(exceedsOpt?.label).toContain("Exceeds VRAM");
  });
});
