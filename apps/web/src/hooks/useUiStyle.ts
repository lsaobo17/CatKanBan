import { useEffect, useState } from "react";
import { DEFAULT_UI_STYLE, isUiStyle, type UiStyle, UI_STYLE_STORAGE_KEY } from "../theme/uiStyles";

function readStoredUiStyle(): UiStyle {
  if (typeof window === "undefined") {
    return DEFAULT_UI_STYLE;
  }

  try {
    const stored = window.localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return isUiStyle(stored) ? stored : DEFAULT_UI_STYLE;
  } catch {
    return DEFAULT_UI_STYLE;
  }
}

export function useUiStyle() {
  const [uiStyle, setUiStyle] = useState<UiStyle>(readStoredUiStyle);

  useEffect(() => {
    document.documentElement.dataset.uiStyle = uiStyle;
    try {
      window.localStorage.setItem(UI_STYLE_STORAGE_KEY, uiStyle);
    } catch {
      // Storage can be unavailable in private or restricted browser contexts.
    }
  }, [uiStyle]);

  return [uiStyle, setUiStyle] as const;
}
