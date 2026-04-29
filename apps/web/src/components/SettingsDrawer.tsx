import { Check } from "lucide-react";
import { Drawer, Typography } from "antd";
import { UI_STYLE_OPTIONS, type UiStyle } from "../theme/uiStyles";

interface SettingsDrawerProps {
  open: boolean;
  uiStyle: UiStyle;
  onChange: (uiStyle: UiStyle) => void;
  onClose: () => void;
}

export function SettingsDrawer({ open, uiStyle, onChange, onClose }: SettingsDrawerProps) {
  return (
    <Drawer title="界面设置" size="default" open={open} onClose={onClose} className="settings-drawer">
      <div className="settings-section">
        <Typography.Title level={5} className="settings-title">
          UI 风格
        </Typography.Title>
        <Typography.Text type="secondary">选择后立即生效，并会保存在当前浏览器中。</Typography.Text>
      </div>

      <div className="ui-style-options" role="listbox" aria-label="UI 风格">
        {UI_STYLE_OPTIONS.map((option) => {
          const selected = option.id === uiStyle;

          return (
            <button
              key={option.id}
              type="button"
              className={`ui-style-option ${selected ? "is-selected" : ""}`}
              aria-selected={selected}
              role="option"
              onClick={() => onChange(option.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onChange(option.id);
                }
              }}
            >
              <span className="ui-style-swatch" aria-hidden="true">
                {option.swatches.map((color) => (
                  <span key={color} style={{ background: color }} />
                ))}
              </span>
              <span className="ui-style-copy">
                <span className="ui-style-name">{option.name}</span>
                <span className="ui-style-description">{option.description}</span>
              </span>
              <span className="ui-style-check" aria-hidden="true">
                {selected ? <Check size={16} /> : null}
              </span>
            </button>
          );
        })}
      </div>
    </Drawer>
  );
}
