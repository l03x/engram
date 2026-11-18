import { fileURLToPath } from "node:url";

import { expect, readStack, signInAs, test } from "../fixtures";

const PACKAGE = fileURLToPath(new URL("../fixtures/geography.apkg", import.meta.url));

function deckFile(fileName: string, deckName: string, fronts: string[]) {
  const deck = {
    format: "engram-deck",
    version: 1,
    deck: { name: deckName, description: "" },
    cards: fronts.map((front) => ({ type: "basic", front, back: front.toUpperCase(), tags: [] })),
  };
  return {
    name: fileName,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(deck)),
  };
}

test("imports an Anki package with its progress, then several deck files", async ({ page }) => {
  await signInAs(page, readStack().users.importer);
  await page.goto("/");

  await page.getByRole("button", { name: "Import" }).click();
  await page.getByRole("menuitem", { name: "Anki package (.apkg)" }).click();
  const dialog = page.getByRole("dialog", { name: "Import from Anki" });
  await dialog.getByLabel("Deck package").setInputFiles(PACKAGE);
  await expect(dialog.getByLabel("Keep my Anki progress")).toBeChecked();
  await dialog.getByRole("button", { name: "Import" }).click();

  const summary = dialog.getByRole("status");
  await expect(summary).toContainText("Imported 6 cards into Geography.");
  await expect(summary).toContainText("4 past reviews kept your schedule going.");
  await expect(summary).toContainText("3 cards lost an image or a sound");
  await expect(summary).toContainText("1 card was left out");

  await dialog.getByRole("link", { name: "Open deck" }).click();
  await expect(page.getByRole("heading", { name: "Geography" })).toBeVisible();
  const cards = page.getByRole("region", { name: "Cards" }).getByRole("listitem");
  await expect(cards).toHaveCount(6);
  // Cloze and MathJax arrive as Markdown and render.
  await expect(cards.nth(3).locator(".katex")).toBeVisible();

  // Several deck files at once each become a deck, and stay in the list instead of opening.
  await page.goto("/");
  await page.getByRole("button", { name: "Import" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: "Engram decks (.json)" }).click();
  await (
    await chooser
  ).setFiles([
    deckFile("day-1.json", "Spanish::Day 1", ["hola", "adiós"]),
    deckFile("day-2.json", "Spanish::Day 2", ["gracias"]),
  ]);
  await expect(page.getByText("Imported 2 decks with 3 cards.")).toBeVisible();

  // Rows open a menu on right-click.
  await page.getByRole("button", { name: /^Spanish/ }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "Expand" }).click();
  const dayOne = page.getByRole("link", { name: "Day 1", exact: true });
  await expect(dayOne).toBeVisible();
  await dayOne.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Deck settings" }).click();
  await expect(page.getByRole("dialog", { name: "Deck settings" }).getByLabel("Name")).toHaveValue(
    "Spanish::Day 1",
  );
});
