import { MessageSquare } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { ChatView } from "./ChatView";

export { ChatView };

export const chatViewDefinition: ViewDefinition = {
  id: "chat",
  title: "AI CHAT",
  icon: MessageSquare,
  component: ChatView,
  defaultDock: "right",
  minWidth: 280,
};
