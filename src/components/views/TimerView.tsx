import React from "react";
import { PomodoroDial } from "../features/pomodoro/PomodoroDial";
import { HudBrackets } from "../ui/HudBrackets";

export const TimerView: React.FC = () => {
  return (
    <div className="h-full w-full flex flex-col items-center justify-center p-2 bg-[#03070d] text-cyan-300 font-hud overflow-y-auto select-none">
      <HudBrackets variant="amber" className="p-3 w-full max-w-[340px]">
        <PomodoroDial isCompact={false} />
      </HudBrackets>
    </div>
  );
};
