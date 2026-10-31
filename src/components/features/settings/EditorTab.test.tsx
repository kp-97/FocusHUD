import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EditorTab } from "./EditorTab";
import {
  SPELLCHECK_LOCALE_KEY,
  SPELLCHECK_ENABLED_KEY,
  DEFAULT_SPELLCHECK_LOCALE,
} from "../../../stores/spellcheckStore";

describe("EditorTab component", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = "";
    document.documentElement.removeAttribute("data-spellcheck");
  });

  it("renders spellcheck settings and options", () => {
    render(<EditorTab />);

    expect(screen.getByText(/SPELLCHECK & DICTIONARY/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Select spellcheck language English \(Australia\)/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Select spellcheck language English \(United States\)/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /Select spellcheck language English \(United Kingdom\)/i,
      })
    ).toBeInTheDocument();
    expect(screen.getByText(/LIVE SPELLCHECK TEST BENCH/i)).toBeInTheDocument();
  });

  it("switches locale when a locale button is clicked", () => {
    render(<EditorTab />);

    const usOption = screen.getByRole("button", {
      name: /Select spellcheck language English \(United States\)/i,
    });
    fireEvent.click(usOption);

    expect(localStorage.getItem(SPELLCHECK_LOCALE_KEY)).toBe("en-US");
    expect(document.documentElement.lang).toBe("en-US");
    expect(screen.getByText(/ACTIVE: ENGLISH \(UNITED STATES\)/i)).toBeInTheDocument();
  });

  it("toggles spellcheck enabled state with the checkbox", () => {
    render(<EditorTab />);

    const toggle = screen.getByLabelText(/Toggle Spellcheck/i) as HTMLInputElement;
    expect(toggle.checked).toBe(true);

    fireEvent.click(toggle);
    expect(toggle.checked).toBe(false);
    expect(localStorage.getItem(SPELLCHECK_ENABLED_KEY)).toBe("false");
    expect(document.documentElement.getAttribute("data-spellcheck")).toBe("false");

    // Options should now be disabled
    const auOption = screen.getByRole("button", {
      name: /Select spellcheck language English \(Australia\)/i,
    });
    expect(auOption).toBeDisabled();
  });

  it("allows typing in the live test bench textarea with correct lang attribute", () => {
    render(<EditorTab />);

    const textarea = screen.getByLabelText(/Spellcheck test area/i) as HTMLTextAreaElement;
    expect(textarea.lang).toBe(DEFAULT_SPELLCHECK_LOCALE);
    expect(textarea.getAttribute("spellcheck")).toBe("true");

    fireEvent.change(textarea, { target: { value: "Testing custom spelling" } });
    expect(textarea.value).toBe("Testing custom spelling");
  });
});
