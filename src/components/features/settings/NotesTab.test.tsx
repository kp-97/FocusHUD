import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { NotesTab } from "./NotesTab";
import * as dbService from "../../../services/dbService";

vi.mock("../../../services/dbService", () => ({
  fetchNotesDir: vi.fn(),
  updateNotesDir: vi.fn(),
  pickNotesDir: vi.fn(),
  isTauriEnvironment: vi.fn(),
}));

describe("NotesTab Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(dbService.isTauriEnvironment).mockReturnValue(true);
    vi.mocked(dbService.fetchNotesDir).mockResolvedValue("C:/Users/User/FocusHUD/notes");
  });

  it("renders current storage path and description", async () => {
    render(<NotesTab />);

    await waitFor(() => {
      expect(screen.getByTestId("current-notes-path")).toHaveTextContent(
        "C:/Users/User/FocusHUD/notes"
      );
    });

    expect(screen.getByText(/MARKDOWN STORAGE DIRECTORY/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Notes are saved as human-readable/i)
    ).toBeInTheDocument();
  });

  it("allows selecting a folder via folder picker and updates directory", async () => {
    vi.mocked(dbService.pickNotesDir).mockResolvedValue("D:/Obsidian/Vault/FocusHUD");
    vi.mocked(dbService.updateNotesDir).mockResolvedValue(true);

    render(<NotesTab />);

    const changeBtn = screen.getByRole("button", { name: /CHANGE FOLDER/i });
    fireEvent.click(changeBtn);

    await waitFor(() => {
      expect(dbService.pickNotesDir).toHaveBeenCalled();
      expect(dbService.updateNotesDir).toHaveBeenCalledWith(
        "D:/Obsidian/Vault/FocusHUD",
        true
      );
      expect(screen.getByTestId("current-notes-path")).toHaveTextContent(
        "D:/Obsidian/Vault/FocusHUD"
      );
    });
  });

  it("toggles migration checkbox option", async () => {
    render(<NotesTab />);

    const checkbox = screen.getByRole("checkbox", {
      name: /Migrate existing notes to new folder/i,
    });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});

