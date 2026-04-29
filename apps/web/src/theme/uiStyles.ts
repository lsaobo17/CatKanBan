import { theme as antdTheme } from "antd";
import type { ThemeConfig } from "antd/es/config-provider/context";

export type UiStyle = "classic" | "dark" | "mint" | "warm" | "contrast";

export interface UiStyleOption {
  id: UiStyle;
  name: string;
  description: string;
  swatches: [string, string, string];
  theme: ThemeConfig;
}

export const UI_STYLE_STORAGE_KEY = "catkanban:ui-style";

export const UI_STYLE_OPTIONS: UiStyleOption[] = [
  {
    id: "classic",
    name: "清爽蓝白",
    description: "明亮、克制，适合日常项目推进。",
    swatches: ["#f3f5f7", "#ffffff", "#1677ff"],
    theme: {
      token: {
        colorPrimary: "#1677ff",
        colorInfo: "#1677ff",
        colorSuccess: "#2f9e44",
        colorWarning: "#d48806",
        colorError: "#d4380d",
        colorBgBase: "#f3f5f7",
        colorBgContainer: "#ffffff",
        colorText: "#1f2933",
        colorTextSecondary: "#52606d",
        colorBorder: "#d9e1e8",
        borderRadius: 8
      }
    }
  },
  {
    id: "dark",
    name: "夜间深色",
    description: "低亮度界面，适合长时间查看。",
    swatches: ["#141414", "#1f1f1f", "#40a9ff"],
    theme: {
      algorithm: antdTheme.darkAlgorithm,
      token: {
        colorPrimary: "#40a9ff",
        colorInfo: "#40a9ff",
        colorSuccess: "#73d13d",
        colorWarning: "#ffc53d",
        colorError: "#ff7875",
        colorBgBase: "#141414",
        colorBgContainer: "#1f1f1f",
        colorText: "#f0f0f0",
        colorTextSecondary: "#bfbfbf",
        colorBorder: "#434343",
        borderRadius: 8
      }
    }
  },
  {
    id: "mint",
    name: "绿意专注",
    description: "轻绿色背景，强调稳定和专注。",
    swatches: ["#eef7f1", "#ffffff", "#119c73"],
    theme: {
      token: {
        colorPrimary: "#119c73",
        colorInfo: "#119c73",
        colorSuccess: "#2f9e44",
        colorWarning: "#c77800",
        colorError: "#c92a2a",
        colorBgBase: "#eef7f1",
        colorBgContainer: "#ffffff",
        colorText: "#18352c",
        colorTextSecondary: "#49655d",
        colorBorder: "#cfe3d9",
        borderRadius: 8
      }
    }
  },
  {
    id: "warm",
    name: "暖光柔和",
    description: "温暖但不刺眼，适合计划梳理。",
    swatches: ["#f7f1e8", "#fffaf2", "#b46b2a"],
    theme: {
      token: {
        colorPrimary: "#b46b2a",
        colorInfo: "#b46b2a",
        colorSuccess: "#3f8f4f",
        colorWarning: "#c77800",
        colorError: "#c2410c",
        colorBgBase: "#f7f1e8",
        colorBgContainer: "#fffaf2",
        colorText: "#35271d",
        colorTextSecondary: "#6b5a4a",
        colorBorder: "#e3d4c1",
        borderRadius: 8
      }
    }
  },
  {
    id: "contrast",
    name: "高对比",
    description: "边界更清晰，适合快速扫描。",
    swatches: ["#f8fafc", "#ffffff", "#111827"],
    theme: {
      token: {
        colorPrimary: "#111827",
        colorInfo: "#111827",
        colorSuccess: "#15803d",
        colorWarning: "#b45309",
        colorError: "#b91c1c",
        colorBgBase: "#f8fafc",
        colorBgContainer: "#ffffff",
        colorText: "#0f172a",
        colorTextSecondary: "#334155",
        colorBorder: "#94a3b8",
        borderRadius: 4
      }
    }
  }
];

export const DEFAULT_UI_STYLE: UiStyle = "classic";

export function isUiStyle(value: unknown): value is UiStyle {
  return UI_STYLE_OPTIONS.some((option) => option.id === value);
}

export function getUiStyleOption(uiStyle: UiStyle) {
  return UI_STYLE_OPTIONS.find((option) => option.id === uiStyle) ?? UI_STYLE_OPTIONS[0];
}
