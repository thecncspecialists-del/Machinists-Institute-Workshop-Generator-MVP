import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireStaffUser } from "@/lib/require-staff-user";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().uuid()
});

const packageFiles = [
  { source: "public/branding/mi-logo-full.png", name: "mi-logo-full.png" },
  { source: "public/branding/mi-page-header.jpg", name: "mi-page-header.jpg" }
] as const;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireStaffUser();
  if (authResult.response) {
    return authResult.response;
  }

  const { id } = paramsSchema.parse(await params);
  const workspace = await prisma.courseWorkspace.findFirst({
    where: { id, archivedAt: null },
    include: { course: true }
  });
  if (!workspace) {
    return NextResponse.json({ error: "Class not found." }, { status: 404 });
  }

  const files: { name: string; data: Buffer }[] = await Promise.all(
    packageFiles.map(async (file) => ({
      name: file.name,
      data: await fs.readFile(path.join(process.cwd(), file.source))
    }))
  );
  const note = [
    "Machinists Institute Canvas image package",
    "",
    `Class: ${workspace.title}`,
    `Catalog course: ${workspace.course.courseCode ? `${workspace.course.courseCode} - ` : ""}${workspace.course.courseName}`,
    "",
    "Upload these files into the Canvas course files area before pasting the generated homepage HTML:",
    "- mi-logo-full.png",
    "- mi-page-header.jpg",
    "",
    "The generated homepage HTML references these exact filenames."
  ].join("\n");
  files.push({ name: "README.txt", data: Buffer.from(note, "utf8") });

  const zip = createStoreZip(files);
  const safeTitle = workspace.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "course-workspace";

  return new NextResponse(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeTitle}-canvas-images.zip"`
    }
  });
}

function createStoreZip(files: { name: string; data: Buffer }[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, "utf8");
    const crc = crc32(file.data);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(file.data.length, 18);
    localHeader.writeUInt32LE(file.data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    localParts.push(localHeader, name, file.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(file.data.length, 20);
    centralHeader.writeUInt32LE(file.data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);
    offset += localHeader.length + name.length + file.data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
