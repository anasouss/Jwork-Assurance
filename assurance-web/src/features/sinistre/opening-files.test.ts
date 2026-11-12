import { describe, expect, it } from "vitest";
import { appendOpeningFiles } from "./opening-files";

const pdf = (name: string) => new File(["%PDF-test"], name, { type: "application/pdf", lastModified: 1 });

describe("claim opening uploads", () => {
  it("preserves existing files and assigns every dropped file to its document type", () => {
    const existing = [{ type: "CONSTAT" as const, file: pdf("constat.pdf") }];
    const result = appendOpeningFiles(existing, [pdf("pv-1.pdf"), pdf("pv-2.pdf")], "PV_POLICE");
    expect(result.documents.map((document) => document.type)).toEqual(["CONSTAT", "PV_POLICE", "PV_POLICE"]);
    expect(result.errors).toEqual([]);
    expect(existing).toHaveLength(1);
  });

  it("rejects invalid formats and empty files while accepting other files in the drop", () => {
    const result = appendOpeningFiles([], [new File([], "empty.pdf", { type: "application/pdf" }),
      new File(["bad"], "run.exe", { type: "application/octet-stream" }), pdf("valid.pdf")], "DECLARATION");
    expect(result.documents).toHaveLength(1);
    expect(result.errors).toHaveLength(2);
  });

  it("prevents duplicate files within a type but permits the same file for another document type", () => {
    const file = pdf("shared.pdf");
    const current = [{ type: "CONSTAT" as const, file }];
    expect(appendOpeningFiles(current, [file], "CONSTAT").documents).toHaveLength(1);
    expect(appendOpeningFiles(current, [file], "CONSTAT").errors).toHaveLength(1);
    expect(appendOpeningFiles(current, [file], "DECLARATION").documents).toHaveLength(2);
  });

  it("enforces per-file and combined request limits without discarding earlier selections", () => {
    const large = pdf("large.pdf");
    Object.defineProperty(large, "size", { value: 30 * 1024 * 1024 + 1 });
    expect(appendOpeningFiles([], [large], "CONSTAT").errors[0]).toContain("30 Mo");
    const prior = pdf("prior.pdf");
    const next = pdf("next.pdf");
    Object.defineProperty(prior, "size", { value: 20 * 1024 * 1024 });
    Object.defineProperty(next, "size", { value: 12 * 1024 * 1024 });
    const result = appendOpeningFiles([{ type: "CONSTAT", file: prior }], [next], "DECLARATION");
    expect(result.documents).toHaveLength(1);
    expect(result.errors[0]).toContain("31 Mo");
  });

  it("accepts the Word formats supported by the backend", () => {
    const result = appendOpeningFiles([], [new File(["word"], "declaration.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })], "DECLARATION");
    expect(result.documents).toHaveLength(1);
    expect(result.errors).toEqual([]);
  });
});
