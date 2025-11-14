import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { trackServerEvent } from "@/lib/ga-server";

export async function GET() {
  await trackServerEvent([
    {
      name: "download_pdf",
      params: {
        slug: "odonto_guia",
      },
    },
  ]);

  const filePath = join(
    process.cwd(),
    "public",
    "downloads",
    "odonto",
    "guia-odonto.pdf"
  );

  const file = await readFile(filePath);

  return new NextResponse(file, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="guia-odonto.pdf"',
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
