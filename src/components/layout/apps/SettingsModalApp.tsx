import React from "react";
import { SettingsModal } from "../../features/settings/SettingsModal";
import { closeSettingsWindow } from "../../../services/tauriBridge";
import { UseDockLayoutReturn } from "../../../hooks/useDockLayout";

interface SettingsModalAppProps {
  layout: UseDockLayoutReturn;
}

export const SettingsModalApp: React.FC<SettingsModalAppProps> = ({ layout }) => {
  const initialTab =
    (typeof localStorage !== "undefined" && localStorage.getItem("hud_settings_tab")) || "all";

  return (
    <div data-testid="settings-modal-app">
      <SettingsModal
        isOpen={true}
        isStandalone={true}
        initialTab={initialTab}
        onClose={() => {
          closeSettingsWindow();
        }}
        onResetWidths={layout.handleResetWidths}
      />
    </div>
  );
};

