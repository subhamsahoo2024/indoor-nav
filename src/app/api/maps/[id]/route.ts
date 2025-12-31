import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/db";
import MapModel, { toMongooseAdjacencyList } from "@/models/Map";
import type { MapData } from "@/types/navigation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/maps/[id]
 * Returns the FULL map document (nodes, edges, everything)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const { id } = await params;
    const map = await MapModel.findOne({ id });

    if (!map) {
      return NextResponse.json(
        {
          success: false,
          error: `Map '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: map.toJSON(),
    });
  } catch (error) {
    console.error(`GET /api/maps/[id] error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch map",
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/maps/[id]
 * Update a map (full replacement)
 * Input: Full MapData object
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const { id } = await params;
    const body: Partial<MapData> = await request.json();

    // Find existing map
    const existingMap = await MapModel.findOne({ id });

    if (!existingMap) {
      return NextResponse.json(
        {
          success: false,
          error: `Map '${id}' not found`,
        },
        { status: 404 }
      );
    }

    // Update fields
    if (body.name !== undefined) existingMap.name = body.name;
    if (body.imageUrl !== undefined) existingMap.imageUrl = body.imageUrl;
    if (body.nodes !== undefined) existingMap.nodes = body.nodes;
    if (body.adjacencyList !== undefined) {
      existingMap.adjacencyList = toMongooseAdjacencyList(body.adjacencyList);
    }

    await existingMap.save();

    return NextResponse.json({
      success: true,
      data: existingMap.toJSON(),
    });
  } catch (error) {
    console.error(`PUT /api/maps/[id] error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to update map",
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/maps/[id]
 * Delete a map
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await dbConnect();

    const { id } = await params;
    const result = await MapModel.deleteOne({ id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Map '${id}' not found`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Map '${id}' deleted successfully`,
    });
  } catch (error) {
    console.error(`DELETE /api/maps/[id] error:`, error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to delete map",
      },
      { status: 500 }
    );
  }
}
