import "server-only";
import { DOMParser, XMLSerializer, type Document, type Element } from "@xmldom/xmldom";
import JSZip from "jszip";

/*
 * Edits the text of a user's own .docx in place, so the tailored CV keeps the original
 * fonts, colours, spacing, tables and columns. Only paragraph text changes.
 */

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";

function descendants(el: Element | Document, ns: string, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(ns, local) as unknown as ArrayLike<Element>);
}

function hasAncestor(el: Element, ns: string, local: string, stopAt?: Element): boolean {
  for (let p = el.parentNode as Element | null; p && p !== stopAt; p = p.parentNode as Element | null) {
    if (p.namespaceURI === ns && p.localName === local) return true;
  }
  return false;
}

/** Paragraphs that hold text directly (not wrappers around text boxes), skipping legacy fallback copies. */
function textParagraphs(doc: Document): Element[] {
  return descendants(doc, W, "p").filter(
    (p) => descendants(p, W, "p").length === 0 && !hasAncestor(p, MC, "Fallback"),
  );
}

/** Text nodes (<w:t>) that belong to this paragraph. */
function textNodes(p: Element): Element[] {
  return descendants(p, W, "t").filter((t) => !hasAncestor(t, MC, "Fallback", p));
}

function paragraphText(p: Element): string {
  return textNodes(p)
    .map((t) => t.textContent ?? "")
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

async function load(file: ArrayBuffer | Uint8Array) {
  const zip = await JSZip.loadAsync(file);
  const entry = zip.file("word/document.xml");
  if (!entry) throw new Error("Not a Word document");
  const doc = new DOMParser().parseFromString(await entry.async("string"), "text/xml") as unknown as Document;
  return { zip, doc };
}

/** One entry per text paragraph, in document order (empty paragraphs included as ""). */
export async function readDocxParagraphs(file: ArrayBuffer | Uint8Array): Promise<string[]> {
  const { doc } = await load(file);
  return textParagraphs(doc).map(paragraphText);
}

/**
 * Writes new text into each paragraph. The first text run keeps its formatting and receives the
 * new text; the paragraph's other runs are emptied. Unchanged paragraphs aren't touched at all.
 */
export async function writeDocxParagraphs(file: ArrayBuffer | Uint8Array, texts: string[]): Promise<Uint8Array> {
  const { zip, doc } = await load(file);
  const paragraphs = textParagraphs(doc);
  if (paragraphs.length !== texts.length) throw new Error("Paragraph count changed");

  paragraphs.forEach((p, i) => {
    const next = texts[i].replace(/\s+/g, " ").trim();
    if (next === paragraphText(p)) return;
    const nodes = textNodes(p);
    if (!nodes.length) return; // e.g. an image-only paragraph
    nodes.forEach((t, j) => {
      while (t.firstChild) t.removeChild(t.firstChild);
      if (j === 0) {
        t.appendChild(doc.createTextNode(next));
        t.setAttribute("xml:space", "preserve");
      }
    });
  });

  zip.file("word/document.xml", new XMLSerializer().serializeToString(doc as never));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
