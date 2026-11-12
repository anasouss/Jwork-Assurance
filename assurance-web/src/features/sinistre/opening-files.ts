import type { OpeningDocument } from "./types";

const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
const MAX_FILE = 30 * 1024 * 1024;
const MAX_TOTAL = 31 * 1024 * 1024;

export function appendOpeningFiles(current: OpeningDocument[], files: File[], type: OpeningDocument["type"]) {
  const documents = [...current];
  const errors: string[] = [];
  let total = documents.reduce((sum, document) => sum + document.file.size, 0);
  for (const file of files) {
    if (!file.size || !ALLOWED_TYPES.has(file.type)) {
      errors.push(`${file.name} : sélectionnez un PDF, une image JPEG/PNG ou un document Word.`);
    } else if (file.size > MAX_FILE) {
      errors.push(`${file.name} : taille maximale de 30 Mo par fichier.`);
    } else if (documents.some((document) => document.type === type && document.file.name === file.name
      && document.file.size === file.size && document.file.lastModified === file.lastModified)) {
      errors.push(`${file.name} est déjà joint à ce type de document.`);
    } else if (total + file.size > MAX_TOTAL) {
      errors.push(`${file.name} : les pièces d’ouverture dépasseraient 31 Mo au total.`);
    } else {
      documents.push({ type, file });
      total += file.size;
    }
  }
  return { documents, errors };
}
