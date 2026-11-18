import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api";
import { nameTheFile } from "@/lib/deckImport";

const files = [new File(["{}"], "day-1.json"), new File(["{}"], "day-2.json")];

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

describe("nameTheFile", () => {
  it("swaps the file's position for its name", () => {
    const error = new ApiError(
      422,
      "files[1].cards[0].back: String should have at least 1 character",
    );
    const named = nameTheFile(error, files);
    expect(named).toBeInstanceOf(ApiError);
    expect(message(named)).toBe(
      "day-2.json: cards[0].back: String should have at least 1 character",
    );
  });

  it("handles a problem with the file as a whole", () => {
    expect(message(nameTheFile(new ApiError(422, "files[0]: Field required"), files))).toBe(
      "day-1.json: Field required",
    );
  });

  it("leaves other errors alone", () => {
    const tooBig = new ApiError(413, "The files add up to more than 16 MiB.");
    expect(nameTheFile(tooBig, files)).toBe(tooBig);
    const unknownFile = new ApiError(422, "files[7].deck: Field required");
    expect(nameTheFile(unknownFile, files)).toBe(unknownFile);
  });
});
