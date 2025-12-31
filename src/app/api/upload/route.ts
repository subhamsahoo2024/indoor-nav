import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * POST /api/upload
 * Handle file uploads for map images
 * Saves files to public/maps/ directory
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/gif",
    ];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid file type. Only images are allowed.",
        },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    // Get file extension
    const originalName = file.name;
    const extension = path.extname(originalName).toLowerCase() || ".png";

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const uniqueFilename = `map-${timestamp}-${randomStr}${extension}`;

    // Ensure the maps directory exists
    const mapsDir = path.join(process.cwd(), "public", "maps");
    if (!existsSync(mapsDir)) {
      await mkdir(mapsDir, { recursive: true });
    }

    // Convert file to buffer and write to disk
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const filePath = path.join(mapsDir, uniqueFilename);
    await writeFile(filePath, buffer);

    // Return the relative URL for the uploaded file
    const relativeUrl = `/maps/${uniqueFilename}`;

    return NextResponse.json({
      success: true,
      data: {
        url: relativeUrl,
        filename: uniqueFilename,
        originalName: originalName,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
