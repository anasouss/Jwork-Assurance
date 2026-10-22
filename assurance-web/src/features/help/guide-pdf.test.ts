import { describe, expect, it } from "vitest";
import { guideModules } from "./guide-content";
import { createGuidePdf } from "./guide-pdf";

describe("guide PDF", () => {
  it("generates a complete multi-page document from the shared guide content", async () => {
    const pdf = await createGuidePdf(guideModules);
    const output = pdf.output("arraybuffer");

    expect(Buffer.from(output).subarray(0, 4).toString()).toBe("%PDF");
    expect(pdf.getNumberOfPages()).toBeGreaterThanOrEqual(20);
  });
});
