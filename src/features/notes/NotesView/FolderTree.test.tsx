import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FolderTree } from "./FolderTree";
import { NoteFolder } from "../../../types/hud";

describe("FolderTree Component", () => {
  const mockFolders: NoteFolder[] = [
    {
      name: "Work",
      relativePath: "Work",
      children: [
        {
          name: "Projects",
          relativePath: "Work/Projects",
          children: [],
        },
      ],
    },
    {
      name: "Personal",
      relativePath: "Personal",
      children: [],
    },
  ];

  it("renders ALL NOTES and ROOT/UNFILED items with total count", () => {
    render(
      <FolderTree
        folders={mockFolders}
        selectedFolder={null}
        onSelectFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        totalNotesCount={42}
      />
    );

    expect(screen.getByText("ALL NOTES")).toBeInTheDocument();
    expect(screen.getByText("ROOT / UNFILED")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Work")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("selects a folder when clicked", () => {
    const onSelect = vi.fn();
    render(
      <FolderTree
        folders={mockFolders}
        selectedFolder={null}
        onSelectFolder={onSelect}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        totalNotesCount={10}
      />
    );

    fireEvent.click(screen.getByText("Personal"));
    expect(onSelect).toHaveBeenCalledWith("Personal");

    fireEvent.click(screen.getByText("ROOT / UNFILED"));
    expect(onSelect).toHaveBeenCalledWith("");
  });

  it("allows creating a new root folder", () => {
    const onCreate = vi.fn();
    render(
      <FolderTree
        folders={mockFolders}
        selectedFolder={null}
        onSelectFolder={vi.fn()}
        onCreateFolder={onCreate}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        totalNotesCount={10}
      />
    );

    const folderBtn = screen.getByTitle("Create New Folder");
    fireEvent.click(folderBtn);

    const input = screen.getByPlaceholderText("New folder name...");
    fireEvent.change(input, { target: { value: "Finance" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreate).toHaveBeenCalledWith("", "Finance");
  });

  it("prompts confirmation modal when deleting a folder and confirms", () => {
    const onDelete = vi.fn();
    render(
      <FolderTree
        folders={mockFolders}
        selectedFolder={null}
        onSelectFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={onDelete}
        totalNotesCount={10}
      />
    );

    const deleteBtns = screen.getAllByTitle("Delete Folder");
    fireEvent.click(deleteBtns[0]);

    expect(screen.getByText(/DELETE FOLDER & CONTENTS\?/i)).toBeInTheDocument();
    const confirmBtn = screen.getByRole("button", { name: /CONFIRM DELETE/i });
    fireEvent.click(confirmBtn);

    expect(onDelete).toHaveBeenCalledWith("Work");
  });

  it("expands nested children when chevron is clicked", () => {
    render(
      <FolderTree
        folders={mockFolders}
        selectedFolder={null}
        onSelectFolder={vi.fn()}
        onCreateFolder={vi.fn()}
        onRenameFolder={vi.fn()}
        onDeleteFolder={vi.fn()}
        totalNotesCount={10}
      />
    );

    expect(screen.queryByText("Projects")).not.toBeInTheDocument();
    const expandBtn = screen.getByTitle("Expand Folder");
    fireEvent.click(expandBtn);

    expect(screen.getByText("Projects")).toBeInTheDocument();
  });
});

