import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FileDropzone } from "./file-dropzone";

describe("shared file dropzone", () => {
  it("keeps the single-file selection and removal surface", () => {
    const html = renderToStaticMarkup(createElement(FileDropzone, {
      file: new File(["pdf"], "document.pdf", { type: "application/pdf" }), onFileChange: () => {},
    }));
    expect(html).toContain("document.pdf");
    expect(html).toContain("Retirer document.pdf");
    expect(html).not.toContain("multiple=");
  });

  it("supports multiple files through a keyboard-accessible French upload surface", () => {
    const html = renderToStaticMarkup(createElement(FileDropzone, {
      multiple: true, onFilesSelect: () => {}, title: "Déposer un constat", accept: ".pdf,.png",
    }));
    expect(html).toContain('multiple=""');
    expect(html).toContain('aria-label="Déposer un constat"');
    expect(html).toContain('accept=".pdf,.png"');
    expect(html).toContain("sr-only");
    expect(html).not.toContain("Choose Files");
  });

  it("disables browsing when the upload is pending", () => {
    const html = renderToStaticMarkup(createElement(FileDropzone, {
      multiple: true, onFilesSelect: () => {}, disabled: true,
    }));
    expect(html).toContain('disabled=""');
    expect(html).toContain("cursor-not-allowed");
  });
});
