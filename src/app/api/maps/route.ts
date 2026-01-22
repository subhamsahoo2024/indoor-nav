import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MapModel, { toMongooseAdjacencyList } from "@/models/Map";

/**
 * GET /api/maps
 * Returns metadata for all maps (id, name, imageUrl, mapImage, nodes count)
 */
export async function GET() {
  try {
    await dbConnect();

    const maps = await MapModel.find(
      {},
      "id name imageUrl mapImage nodes",
    ).lean();

    return NextResponse.json({
      success: true,
      data: maps.map((m) => ({
        id: m.id,
        name: m.name,
        imageUrl: m.imageUrl,
        mapImage: m.mapImage,
        nodes: m.nodes || [],
      })),
    });
  } catch (error) {
    console.error("GET /api/maps error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch maps",
      },
      { status: 500 },
    );
  }
}

/**
 * POST /api/maps
 * Create a new map
 * Input: { id, name, imageUrl?, mapImage?, nodes?, adjacencyList? }
 * Either imageUrl (old maps) or mapImage (new maps with Base64) must be provided
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const {
      id,
      name,
      imageUrl,
      mapImage,
      nodes = [],
      adjacencyList = {},
    } = body;

    // Validation - require id, name, and either imageUrl or mapImage
    if (!id || !name) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: id, name",
        },
        { status: 400 },
      );
    }

    if (!imageUrl && !mapImage) {
      return NextResponse.json(
        {
          success: false,
          error: "Either imageUrl or mapImage (Base64) must be provided",
        },
        { status: 400 },
      );
    }

    // Validate mapImage size if provided (Base64 increases size by ~33%)
    // Limit to ~12MB of Base64 to stay safely under MongoDB's 16MB document limit
    if (mapImage && mapImage.length > 12 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error:
            "mapImage is too large. Maximum size is ~12MB (Base64 encoded)",
        },
        { status: 400 },
      );
    }

    // Check if map with this id already exists
    const existingMap = await MapModel.findOne({ id });
    if (existingMap) {
      return NextResponse.json(
        {
          success: false,
          error: `Map with id '${id}' already exists`,
        },
        { status: 409 },
      );
    }

    // Create new map with either imageUrl or mapImage
    const newMap = new MapModel({
      id,
      name,
      ...(imageUrl && { imageUrl }),
      ...(mapImage && { mapImage }),
      nodes,
      adjacencyList: toMongooseAdjacencyList(adjacencyList),
    });

    await newMap.save();

    return NextResponse.json(
      {
        success: true,
        data: newMap.toJSON(),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/maps error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create map",
      },
      { status: 500 },
    );
  }
}
