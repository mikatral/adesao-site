import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { trackServerEvent } from "@/lib/ga-server";

export async function GET() {
  await trackServerEvent([
    {
      name: "download_pdf",
      params: {
        slug: "telemedicina_vida_class",
      },
    },
  ]);

  const filePath = join(
    process.cwd(),
    "public",
    "downloads",
    "telemedicina",
    "VIDA CLASS - COMO UTILIZAR.pdf"
  );

  const buffer = await readFile(filePath);
  const uint8 = new Uint8Array(buffer);
  const blob = new Blob([uint8], { type: "application/pdf" });

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition":
        'attachment; filename="telemedicina-vida-class-como-utilizar.pdf"',
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
