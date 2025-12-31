import { NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MapModel, { toMongooseAdjacencyList } from "@/models/Map";
import { campusMainMap, blockALobbyMap, floor1Map } from "@/data/mockGraph";

/**
 * GET /api/seed
 * Seeds the database with initial mock data
 * WARNING: This will delete all existing maps and replace with mock data
 */
export async function GET() {
  try {
    await dbConnect();

    // Clear existing data
    await MapModel.deleteMany({});

    // Prepare maps for insertion
    const mapsToInsert = [campusMainMap, blockALobbyMap, floor1Map].map(
      (map) => ({
        id: map.id,
        name: map.name,
        imageUrl: map.imageUrl,
        nodes: map.nodes,
        adjacencyList: toMongooseAdjacencyList(map.adjacencyList),
      })
    );

    // Insert all maps
    await MapModel.insertMany(mapsToInsert);

    // Fetch inserted maps to return
    const insertedMaps = await MapModel.find({});

    return NextResponse.json({
      success: true,
      message: "Database seeded successfully",
      data: {
        mapsInserted: insertedMaps.length,
        maps: insertedMaps.map((m) => ({
          id: m.id,
          name: m.name,
          nodeCount: m.nodes.length,
        })),
      },
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to seed database",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/seed
 * Alternative endpoint that accepts custom seed data
 * Input: { maps: MapData[] }
 */
export async function POST(request: Request) {
  try {
    await dbConnect();

    const body = await request.json();
    const { maps, clearExisting = false } = body;

    if (!maps || !Array.isArray(maps)) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid input: 'maps' array is required",
        },
        { status: 400 }
      );
    }

    // Optionally clear existing data
    if (clearExisting) {
      await MapModel.deleteMany({});
    }

    // Prepare and insert maps
    const mapsToInsert = maps.map(
      (map: {
        id: string;
        name: string;
        imageUrl: string;
        nodes: Array<{
          id: string;
          x: number;
          y: number;
          type: string;
          name: string;
          description?: string;
          gatewayConfig?: {
            targetMapId: string;
            targetNodeId: string;
          };
        }>;
        adjacencyList: Record<
          string,
          Array<{ targetNodeId: string; weight: number }>
        >;
      }) => ({
        id: map.id,
        name: map.name,
        imageUrl: map.imageUrl,
        nodes: map.nodes,
        adjacencyList: toMongooseAdjacencyList(map.adjacencyList),
      })
    );

    const result = await MapModel.insertMany(mapsToInsert, {
      ordered: false, // Continue on error
    });

    return NextResponse.json({
      success: true,
      message: "Custom seed completed",
      data: {
        mapsInserted: result.length,
      },
    });
  } catch (error) {
    console.error("Custom seed error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to seed database",
      },
      { status: 500 }
    );
  }
}
