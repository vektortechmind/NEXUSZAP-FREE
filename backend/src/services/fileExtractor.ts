import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { truncateExtractedText, withExtractionTimeout } from "./fileSecurity.service";

export async function extractTextFromBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  return withExtractionTimeout(extractTextFromBufferUnsafe(buffer, mimetype));
}

async function extractTextFromBufferUnsafe(buffer: Buffer, mimetype: string): Promise<string> {
  if (mimetype === "application/pdf") {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return truncateExtractedText(result.text ?? "");
    } finally {
      await parser.destroy();
    }
  }

  if (mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    const result = await mammoth.extractRawText({ buffer });
    return truncateExtractedText(result.value);
  }

  if (mimetype === "application/json" || mimetype === "text/plain") {
    return truncateExtractedText(buffer.toString("utf-8"));
  }

  throw new Error("Formato não suportado para extração restrita do OWASP FileSanity.");
}
