import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";

const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
  txt: "text/plain",
} as const;

export const maxDuration = 60;

/** Removes the stored original file (the CV text stays). */
export async function DELETE() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("cv_file_path").eq("id", user.id).single();
  if (data?.cv_file_path) await supabase.storage.from("cvs").remove([data.cv_file_path]);
  await supabase.from("profiles").update({ cv_file_path: null, cv_file_name: null, cv_file_type: null }).eq("id", user.id);
  return NextResponse.json({ ok: true });
}

const MAX_BYTES = 5 * 1024 * 1024;

function tidy(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, 50_000);
}

/**
 * Extracts text from an uploaded CV (PDF, DOCX or TXT) and keeps the original file in the
 * user's private storage folder, so tailored CVs can reuse its formatting.
 */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no_file" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Decide by content, not by the file name.
  const isPdf = bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46; // %PDF
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04; // PK.. (docx)
  const isTxt = /\.txt$/i.test(file.name) && !bytes.subarray(0, 1024).includes(0);

  try {
    let text = "";
    if (isPdf) {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      text = (await extractText(pdf, { mergePages: true })).text;
    } else if (isZip && /\.docx$/i.test(file.name)) {
      const mammoth = await import("mammoth");
      text = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } else if (isTxt) {
      text = new TextDecoder().decode(bytes);
    } else {
      return NextResponse.json({ error: "unsupported_type" }, { status: 415 });
    }

    text = tidy(text);
    // Scanned PDFs have no text layer.
    if (text.length < 30) return NextResponse.json({ error: "no_text" }, { status: 422 });

    // Save the CV text right away, so nothing is lost if the user leaves the page.
    const supabase = await createClient();
    const { error: saveError } = await supabase.from("profiles").update({ cv_text: text }).eq("id", user.id);
    if (saveError) {
      console.error("saving CV text failed", saveError.message);
      return NextResponse.json({ error: "save_failed" }, { status: 500 });
    }
    revalidatePath("/", "layout");

    // Keep the original file too; optional — the text is already saved.
    const type = isPdf ? "pdf" : isZip ? "docx" : "txt";
    const path = `${user.id}/original.${type}`;
    const { error: uploadError } = await supabase.storage
      .from("cvs")
      .upload(path, bytes, { upsert: true, contentType: MIME[type] });
    let stored = false;
    if (uploadError) {
      // Text extraction still worked; the file just won't be reused for formatting.
      console.error("CV file upload failed", uploadError.message);
    } else {
      const { error } = await supabase
        .from("profiles")
        .update({ cv_file_path: path, cv_file_name: file.name.slice(0, 200), cv_file_type: type })
        .eq("id", user.id);
      stored = !error;
    }
    return NextResponse.json({ text, saved: true, file: stored ? { name: file.name, type } : null });
  } catch (e) {
    console.error("CV extraction failed", e);
    return NextResponse.json({ error: "extract_failed" }, { status: 422 });
  }
}
