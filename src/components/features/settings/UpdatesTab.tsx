import React, { useState, useEffect, useRef } from "react";
import {
  Download,
  RefreshCw,
  CheckCircle2,
  Sparkles,
  Clock,
  RotateCcw,
} from "lucide-react";
import {
  checkForUpdates,
  downloadAndInstallUpdate,
  relaunchApp,
  snoozeUpdate,
  getAppCurrentVersion,
  APP_VERSION,
  AppUpdateInfo,
} from "../../../services/updaterService";

export const UpdatesTab: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<AppUpdateInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>(APP_VERSION);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isReadyToRestart, setIsReadyToRestart] = useState(false);
  const [isSnoozed, setIsSnoozed] = useState(false);
  const isMountedRef = useRef(true);

  // Check on tab mount
  useEffect(() => {
    isMountedRef.current = true;
    getAppCurrentVersion().then((ver) => {
      if (isMountedRef.current) setCurrentVersion(ver);
    });
    handleCheck(false);
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const handleCheck = async (force = true) => {
    if (!isMountedRef.current) return;
    setIsChecking(true);
    setStatusMessage(null);
    try {
      const info = await checkForUpdates(force);
      if (!isMountedRef.current) return;
      setUpdateInfo(info);
      if (!info.available) {
        setStatusMessage("FocusHUD is currently up to date.");
      }
    } catch {
      if (!isMountedRef.current) return;
      setStatusMessage("Failed to check for updates. Please check your network connection.");
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false);
      }
    }
  };

  const handleDownloadAndInstall = async () => {
    if (!updateInfo?.rawUpdate) return;
    setDownloadProgress(0);
    try {
      await downloadAndInstallUpdate(
        updateInfo.rawUpdate,
        (percent) => {
          setDownloadProgress(percent);
        }
      );
      setDownloadProgress(100);
      setIsReadyToRestart(true);
    } catch (err: any) {
      console.error(err);
      setStatusMessage("Download failed: " + (err?.message || "Unknown error"));
      setDownloadProgress(null);
    }
  };

  const handleSnooze = () => {
    if (updateInfo?.version) {
      snoozeUpdate(updateInfo.version, 48);
      setIsSnoozed(true);
      setTimeout(() => setIsSnoozed(false), 3000);
    }
  };

  return (
    <div
      data-testid="updates-tab"
      className="border border-cyan-500/20 bg-cyan-950/20 p-3.5 rounded flex flex-col gap-3 font-tech"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <span className="font-semibold text-cyan-100 tracking-wider">
            SOFTWARE UPDATES & BUILD
          </span>
        </div>
        <span className="text-[10px] text-cyan-400/60 uppercase">
          Current: {updateInfo?.currentVersion || currentVersion}
        </span>
      </div>

      {/* Check Controls */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-cyan-300/80">
          Cryptographically signed updates delivered securely via GitHub Releases.
        </div>
        <button
          type="button"
          onClick={() => handleCheck(true)}
          disabled={isChecking || downloadProgress !== null}
          data-testid="check-updates-btn"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/40 hover:border-cyan-400 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? "animate-spin text-cyan-300" : ""}`} />
          <span>{isChecking ? "Checking..." : "Check for Updates"}</span>
        </button>
      </div>

      {/* Up to date message */}
      {!isChecking && !updateInfo?.available && statusMessage && (
        <div
          data-testid="up-to-date-message"
          className="flex items-center gap-2 px-3 py-2 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[11px]"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Update Available Card */}
      {updateInfo?.available && (
        <div
          data-testid="update-available-card"
          className="p-3 rounded-lg bg-[#07172b] border border-amber-500/40 shadow-[0_0_15px_rgba(255,179,0,0.15)] flex flex-col gap-2.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="font-semibold text-amber-200 text-xs tracking-wider uppercase">
                New Update Available: v{updateInfo.version}
              </span>
            </div>
            {updateInfo.date && (
              <span className="text-[10px] text-amber-400/60 font-mono">
                {new Date(updateInfo.date).toLocaleDateString()}
              </span>
            )}
          </div>

          {/* Release Notes */}
          {updateInfo.body && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-cyan-400/70 uppercase">
                What's New:
              </span>
              <div
                data-testid="release-notes-box"
                className="max-h-28 overflow-y-auto p-2 rounded bg-[#030a14] border border-cyan-500/20 text-[11px] text-cyan-200/90 whitespace-pre-wrap font-mono select-text"
              >
                {updateInfo.body}
              </div>
            </div>
          )}

          {/* Download Progress Bar */}
          {downloadProgress !== null && (
            <div className="flex flex-col gap-1 my-1">
              <div className="flex justify-between text-[10px] text-cyan-300">
                <span>Downloading update...</span>
                <span>{downloadProgress}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-cyan-950 border border-cyan-500/30 overflow-hidden">
                <div
                  className="h-full bg-cyan-400 transition-all duration-150 shadow-[0_0_8px_#00e5ff]"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1 border-t border-cyan-500/20 gap-2">
            {!isReadyToRestart ? (
              <>
                <button
                  type="button"
                  onClick={handleSnooze}
                  disabled={downloadProgress !== null}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-cyan-400/70 hover:text-cyan-200 hover:bg-cyan-500/10 transition cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isSnoozed ? "Snoozed for 48h" : "Remind me in 48h"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadAndInstall}
                  disabled={downloadProgress !== null}
                  data-testid="install-update-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/50 hover:border-amber-300 font-semibold tracking-wider transition cursor-pointer shadow-[0_0_10px_rgba(255,179,0,0.2)]"
                >
                  <Download className="w-3.5 h-3.5 text-amber-400" />
                  <span>{downloadProgress !== null ? "Downloading..." : "Download & Install"}</span>
                </button>
              </>
            ) : (
              <div className="w-full flex items-center justify-between gap-2">
                <span className="text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Update installed successfully!
                </span>
                <button
                  type="button"
                  onClick={() => relaunchApp()}
                  data-testid="relaunch-btn"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/50 font-semibold tracking-wider transition cursor-pointer shadow-[0_0_10px_rgba(0,230,118,0.2)]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Restart FocusHUD</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
