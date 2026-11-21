import { FileText } from "lucide-react";
import type { ViewDefinition } from "../../types/navigation";
import { NotesView } from "./NotesView";

export { NotesView };
export { NoteEditor } from "./NotesView/NoteEditor";
export { FolderTree } from "./NotesView/FolderTree";
export { MarkdownPreview } from "./NotesView/MarkdownPreview";

export const notesViewDefinition: ViewDefinition = {
  id: "notes",
  title: "NOTES",
  icon: FileText,
  component: NotesView,
  defaultDock: "left",
  minWidth: 280,
};
