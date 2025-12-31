import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MapModel, { toMongooseAdjacencyList } from "@/models/Map";

/**
 * GET /api/maps
 * Returns metadata for all maps (id, name, imageUrl, nodes count)
 */
export async function GET() {
  try {
    await dbConnect();

    const maps = await MapModel.find({}, "id name imageUrl nodes").lean();

    return NextResponse.json({
      success: true,
      data: maps.map((m) => ({
        id: m.id,
        name: m.name,
        imageUrl: m.imageUrl,
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
      { status: 500 }
    );
  }
}

/**
 * POST /api/maps
 * Create a new map
 * Input: { id, name, imageUrl, nodes?, adjacencyList? }
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const body = await request.json();
    const { id, name, imageUrl, nodes = [], adjacencyList = {} } = body;

    // Validation
    if (!id || !name || !imageUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: id, name, imageUrl",
        },
        { status: 400 }
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
        { status: 409 }
      );
    }

    // Create new map
    const newMap = new MapModel({
      id,
      name,
      imageUrl,
      nodes,
      adjacencyList: toMongooseAdjacencyList(adjacencyList),
    });

    await newMap.save();

    return NextResponse.json(
      {
        success: true,
        data: newMap.toJSON(),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("POST /api/maps error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create map",
      },
      { status: 500 }
    );
  }
}
