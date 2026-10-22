import { GUIDE_UPDATED_AT, GUIDE_VERSION } from "./guide-content";
import type { GuideModule } from "./types";

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN = 17;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

export async function createGuidePdf(modules: GuideModule[]) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let y = MARGIN;
  let pageNumber = 1;

  const footer = () => {
    pdf.setDrawColor(210, 218, 228);
    pdf.line(MARGIN, PAGE_HEIGHT - 13, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 13);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(92, 103, 119);
    pdf.text(`Guide d'utilisation - version ${GUIDE_VERSION}`, MARGIN, PAGE_HEIGHT - 8);
    pdf.text(`Page ${pageNumber}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
  };

  const nextPage = () => {
    footer();
    pdf.addPage();
    pageNumber += 1;
    y = MARGIN;
  };

  const ensureSpace = (height: number) => {
    if (y + height > PAGE_HEIGHT - 18) nextPage();
  };

  const paragraph = (text: string, options?: { size?: number; bold?: boolean; color?: [number, number, number]; indent?: number; gap?: number }) => {
    const size = options?.size ?? 10;
    const indent = options?.indent ?? 0;
    const lines = pdf.splitTextToSize(text, CONTENT_WIDTH - indent);
    const lineHeight = size * 0.43;
    ensureSpace(lines.length * lineHeight + (options?.gap ?? 2));
    pdf.setFont("helvetica", options?.bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(...(options?.color ?? [22, 30, 43]));
    pdf.text(lines, MARGIN + indent, y);
    y += lines.length * lineHeight + (options?.gap ?? 2);
  };

  pdf.setFillColor(7, 79, 65);
  pdf.rect(0, 0, PAGE_WIDTH, 48, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(24);
  pdf.text("GUIDE D'UTILISATION", MARGIN, 24);
  pdf.setFontSize(13);
  pdf.text("Plateforme de gestion d'assurance", MARGIN, 34);
  y = 61;
  paragraph(`Version ${GUIDE_VERSION} - mise à jour le ${GUIDE_UPDATED_AT}`, { size: 11, bold: true });
  paragraph("Ce document décrit les écrans accessibles à l'utilisateur, les procédures métier, les boutons à utiliser et les solutions aux erreurs courantes.", { size: 10, color: [70, 80, 96], gap: 6 });
  paragraph("Sommaire", { size: 16, bold: true, color: [7, 79, 65] });
  modules.forEach((module, index) => {
    paragraph(`${index + 1}. ${module.title} (${module.topics.length} rubrique${module.topics.length > 1 ? "s" : ""})`, { size: 10, bold: true, indent: 2, gap: 1.5 });
  });

  modules.forEach((module, moduleIndex) => {
    nextPage();
    paragraph(`${moduleIndex + 1}. ${module.title}`, { size: 19, bold: true, color: [7, 79, 65], gap: 2 });
    paragraph(module.description, { size: 10, color: [70, 80, 96], gap: 6 });
    module.topics.forEach((topic, topicIndex) => {
      ensureSpace(35);
      paragraph(`${moduleIndex + 1}.${topicIndex + 1} ${topic.title}`, { size: 14, bold: true, color: [13, 54, 88], gap: 1.5 });
      paragraph(topic.summary, { size: 9.5, color: [70, 80, 96], gap: 3 });
      if (topic.prerequisites?.length) {
        paragraph("Prérequis", { size: 10, bold: true, gap: 1 });
        topic.prerequisites.forEach((item) => paragraph(`- ${item}`, { size: 9, indent: 3, gap: 1 }));
      }
      paragraph("Procédure", { size: 10, bold: true, gap: 1 });
      topic.steps.forEach((step, index) => {
        paragraph(`${index + 1}. ${step.title}${step.action ? ` - bouton « ${step.action} »` : ""}`, { size: 9.5, bold: true, indent: 3, gap: 0.5 });
        paragraph(step.description, { size: 9, indent: 7, color: [55, 65, 81], gap: 1.5 });
      });
      if (topic.results?.length) {
        paragraph("Résultat", { size: 10, bold: true, gap: 1 });
        topic.results.forEach((item) => paragraph(`- ${item}`, { size: 9, indent: 3, gap: 1 }));
      }
      if (topic.warnings?.length) {
        paragraph("Points d'attention", { size: 10, bold: true, color: [161, 98, 7], gap: 1 });
        topic.warnings.forEach((item) => paragraph(`- ${item}`, { size: 9, indent: 3, color: [112, 70, 11], gap: 1 }));
      }
      if (topic.errors?.length) {
        paragraph("Erreurs et solutions", { size: 10, bold: true, color: [176, 34, 39], gap: 1 });
        topic.errors.forEach((error) => {
          paragraph(error.message, { size: 9, bold: true, indent: 3, color: [176, 34, 39], gap: 0.5 });
          paragraph(error.resolution, { size: 9, indent: 7, color: [55, 65, 81], gap: 1.5 });
        });
      }
      y += 4;
    });
  });
  footer();
  return pdf;
}

export async function downloadGuidePdf(modules: GuideModule[]) {
  const pdf = await createGuidePdf(modules);
  pdf.save(`guide-utilisation-assurance-v${GUIDE_VERSION}.pdf`);
}
