import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UserRegistryControls } from "./UserToolsPanel";

const buildSpacedRepetitionState = () => ({
  spacedRepetitionActiveUser: "Alice",
  spacedRepetitionSelectedUserId: "user-1",
  spacedRepetitionUsers: [{ id: "user-1", name: "Alice" }],
  spacedRepetitionNewUserName: "",
  spacedRepetitionUserError: "",
  handleSpacedRepetitionActiveUserLoadCards: vi.fn(),
  setSpacedRepetitionSelectedUserId: vi.fn(),
  setSpacedRepetitionNewUserName: vi.fn(),
  setSpacedRepetitionUserError: vi.fn(),
  handleSpacedRepetitionCreateUser: vi.fn(),
  handleSpacedRepetitionDeleteUser: vi.fn(),
  handleSpacedRepetitionLoadUser: vi.fn(),
});

describe("UserRegistryControls localization defaults", () => {
  it("keeps english labels when no language is provided", () => {
    const markup = renderToStaticMarkup(
      createElement(UserRegistryControls, {
        spacedRepetition: buildSpacedRepetitionState(),
        handleDeleteOpen: vi.fn(),
      }),
    );

    expect(markup).toContain(">Active user<");
    expect(markup).toContain(">User list<");
    expect(markup).toContain(">Create<");
    expect(markup).toContain(">Load<");
  });

  it("renders german labels when language=de is passed", () => {
    const markup = renderToStaticMarkup(
      createElement(UserRegistryControls, {
        language: "de",
        spacedRepetition: buildSpacedRepetitionState(),
        handleDeleteOpen: vi.fn(),
      }),
    );

    expect(markup).toContain(">Aktiver Benutzer<");
    expect(markup).toContain(">Benutzerliste<");
    expect(markup).toContain(">Erstellen<");
    expect(markup).toContain(">Laden<");
  });
});
