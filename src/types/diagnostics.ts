export interface SystemDiagnostics {
  cpu_usage: number;
  cpu_name: string;
  cpu_cores: number;
  ram_used_bytes: number;
  ram_total_bytes: number;
  ram_usage: number;
  gpu_name?: string | null;
  gpu_usage?: number | null;
  vram_used_bytes?: number | null;
  vram_total_bytes?: number | null;
  vram_usage?: number | null;
  gpu_temp?: number | null;
}
