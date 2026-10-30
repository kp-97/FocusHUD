import React, { useState } from "react";
import { X, Clock, ArrowRight } from "lucide-react";
import { AppUpdateInfo, snoozeUpdate } from "../../services/updaterService";

interface UpdateNotificationToastProps {
  updateInfo: AppUpdateInfo;
  onOpenSettings?: () => void;
  onDismiss?: () => void;
}

export const UpdateNotificationToast: React.FC<UpdateNotificationToastProps> = ({
  updateInfo,
  onOpenSettings,
  onDismiss,
}) => {
  const [visible, setVisible] = useState(true);

  if (!visible || !updateInfo.available || !updateInfo.version) return null;

  const handleSnooze = () => {
    snoozeUpdate(updateInfo.version!, 48);
    setVisible(false);
    if (onDismiss) onDismiss();
  };

  const handleOpen = () => {
    setVisible(false);
    if (onOpenSettings) onOpenSettings();
  };

  return (
    <div
      data-testid="update-notification-toast"
      className="fixed top-3 right-4 z-50 max-w-sm bg-[#040f1f]/95 border border-amber-500/50 rounded-lg p-3 shadow-[0_0_20px_rgba(255,179,0,0.25)] text-xs font-hud text-amber-200 flex flex-col gap-2 backdrop-blur-md animate-in slide-in-from-top-2 duration-200 select-none"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          <span className="font-orbitron font-bold tracking-wider text-amber-100 uppercase text-[11px]">
            UPDATE AVAILABLE: v{updateInfo.version}
          </span>
        </div>
        <button
          onClick={handleSnooze}
          title="Dismiss for 48 hours"
          className="text-amber-400/60 hover:text-amber-100 p-0.5 rounded cursor-pointer transition"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-[10px] font-tech text-amber-300/80 line-clamp-2">
        {updateInfo.body || "A new signed release is ready for installation."}
      </p>

      <div className="flex items-center justify-between pt-1 border-t border-amber-500/20 gap-2">
        <button
          onClick={handleSnooze}
          className="flex items-center gap-1 text-[10px] text-amber-400/70 hover:text-amber-200 cursor-pointer transition"
        >
          <Clock className="w-3 h-3" />
          <span>Remind later</span>
        </button>

        <button
          onClick={handleOpen}
          data-testid="toast-view-update-btn"
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border border-amber-500/40 font-semibold text-[10px] tracking-wider cursor-pointer transition"
        >
          <span>View in Settings</span>
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};
