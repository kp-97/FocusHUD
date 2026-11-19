export type ThemeCategory = "dark" | "light";

export type ThemeId =
  | "cyber"
  | "dark"
  | "light"
  | "pink"
  | "amber"
  | "nord"
  | "matrix";

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  category: ThemeCategory;
  description: string;
  accentColor: string;
  secondaryColor: string;
  bgColor: string;
  borderColor: string;
}

export type WaveformStyle = "cyan-electric" | "amber-crt" | "stealth-slate";

