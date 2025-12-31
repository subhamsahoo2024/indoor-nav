import type {
  MapData,
  GlobalGraph,
  MapConnection,
  Node,
} from "@/types/navigation";
import { isGatewayNode } from "@/types/navigation";

// Import mock data as fallback
import {
  allMaps as mockMaps,
  mapsById as mockMapsById,
} from "@/data/mockGraph";

/**
 * Map Service - Data Access Layer for Navigation Maps
 *
 * Provides methods to:
 * - Retrieve individual maps (from API or fallback to mock)
 * - Get all maps
 * - Build global graph for cross-map routing
 * - Find nodes across maps
 * - Save maps to database
 */

/**
 * Configuration for data source
 * Set USE_DATABASE to true when MongoDB is connected
 */
const USE_DATABASE = process.env.NEXT_PUBLIC_USE_DATABASE === "true";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

/**
 * Internal cache for maps (used in server-side and as fallback)
 */
let mapCache: MapData[] | null = null;

/**
 * Retrieve a single map by its ID
 * @param id - The unique identifier of the map
 * @returns Promise resolving to MapData or null if not found
 */
export async function getMap(id: string): Promise<MapData | null> {
  if (USE_DATABASE) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 404) return null;
        throw new Error(`Failed to fetch map: ${response.statusText}`);
      }

      const result = await response.json();
      return result.success ? result.data : null;
    } catch (error) {
      console.error(`Error fetching map '${id}':`, error);
      // Fallback to mock data
      return mockMapsById[id] ?? null;
    }
  }

  // Use mock data
  return mockMapsById[id] ?? null;
}

/**
 * Retrieve all available maps
 * @returns Promise resolving to array of all MapData
 */
export async function getAllMaps(): Promise<MapData[]> {
  if (USE_DATABASE) {
    try {
      // First get all map IDs
      const listResponse = await fetch(`${API_BASE_URL}/api/maps`, {
        cache: "no-store",
      });

      if (!listResponse.ok) {
        throw new Error(
          `Failed to fetch maps list: ${listResponse.statusText}`
        );
      }

      const listResult = await listResponse.json();

      if (!listResult.success) {
        throw new Error("Failed to get maps list");
      }

      // Fetch full data for each map
      const maps = await Promise.all(
        listResult.data.map(async (mapMeta: { id: string }) => {
          const map = await getMap(mapMeta.id);
          return map;
        })
      );

      // Filter out any nulls and cache
      mapCache = maps.filter((m): m is MapData => m !== null);
      return mapCache;
    } catch (error) {
      console.error("Error fetching all maps:", error);
      // Fallback to mock data
      return mockMaps;
    }
  }

  // Use mock data
  return mockMaps;
}

/**
 * Save a map to the database
 * @param mapData - The map data to save
 * @returns Promise resolving to the saved map or null on failure
 */
export async function saveMap(mapData: MapData): Promise<MapData | null> {
  if (!USE_DATABASE) {
    console.warn("Database not enabled. Map not saved.");
    return mapData;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/maps/${mapData.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(mapData),
    });

    if (!response.ok) {
      // If map doesn't exist, create it
      if (response.status === 404) {
        const createResponse = await fetch(`${API_BASE_URL}/api/maps`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mapData),
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create map: ${createResponse.statusText}`);
        }

        const result = await createResponse.json();
        return result.success ? result.data : null;
      }
      throw new Error(`Failed to save map: ${response.statusText}`);
    }

    const result = await response.json();

    // Invalidate cache
    mapCache = null;

    return result.success ? result.data : null;
  } catch (error) {
    console.error(`Error saving map '${mapData.id}':`, error);
    return null;
  }
}

/**
 * Create a new map
 * @param id - Unique identifier for the map
 * @param name - Display name for the map
 * @param imageUrl - URL to the map image
 * @returns Promise resolving to the created map or null on failure
 */
export async function createMap(
  id: string,
  name: string,
  imageUrl: string
): Promise<MapData | null> {
  const newMap: MapData = {
    id,
    name,
    imageUrl,
    nodes: [],
    adjacencyList: {},
  };

  if (!USE_DATABASE) {
    return newMap;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/maps`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(newMap),
    });

    if (!response.ok) {
      throw new Error(`Failed to create map: ${response.statusText}`);
    }

    const result = await response.json();

    // Invalidate cache
    mapCache = null;

    return result.success ? result.data : null;
  } catch (error) {
    console.error(`Error creating map '${id}':`, error);
    return null;
  }
}

/**
 * Delete a map
 * @param id - The map ID to delete
 * @returns Promise resolving to true if successful
 */
export async function deleteMap(id: string): Promise<boolean> {
  if (!USE_DATABASE) {
    console.warn("Database not enabled. Map not deleted.");
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/maps/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete map: ${response.statusText}`);
    }

    // Invalidate cache
    mapCache = null;

    return true;
  } catch (error) {
    console.error(`Error deleting map '${id}':`, error);
    return false;
  }
}

/**
 * Build the global graph showing how all maps connect to each other
 * Essential for multi-map pathfinding
 *
 * @returns Promise resolving to GlobalGraph structure
 */
export async function getGlobalGraph(): Promise<GlobalGraph> {
  const allMaps = await getAllMaps();

  const mapIds: string[] = allMaps.map((map) => map.id);
  const connections: Record<string, string[]> = {};
  const connectionDetails: MapConnection[] = [];

  // Initialize connections record for all maps
  for (const mapId of mapIds) {
    connections[mapId] = [];
  }

  // Scan all maps for gateway nodes and build connections
  for (const map of allMaps) {
    for (const node of map.nodes) {
      if (isGatewayNode(node)) {
        const targetMapId = node.gatewayConfig.targetMapId;

        // Add to simplified connections (avoid duplicates)
        if (!connections[map.id].includes(targetMapId)) {
          connections[map.id].push(targetMapId);
        }

        // Add detailed connection info
        connectionDetails.push({
          fromMapId: map.id,
          toMapId: targetMapId,
          gatewayNodeId: node.id,
          targetNodeId: node.gatewayConfig.targetNodeId,
        });
      }
    }
  }

  return {
    mapIds,
    connections,
    connectionDetails,
  };
}

/**
 * Find a specific node across all maps
 * @param nodeId - The node ID to search for
 * @returns Object containing the node and its map, or null if not found
 */
export async function findNodeGlobally(
  nodeId: string
): Promise<{ node: Node; mapId: string } | null> {
  const allMaps = await getAllMaps();

  for (const map of allMaps) {
    const node = map.nodes.find((n) => n.id === nodeId);
    if (node) {
      return { node, mapId: map.id };
    }
  }
  return null;
}

/**
 * Get all gateway nodes from a specific map
 * @param mapId - The map ID to search in
 * @returns Array of gateway nodes
 */
export async function getGatewayNodes(mapId: string): Promise<Node[]> {
  const map = await getMap(mapId);
  if (!map) return [];

  return map.nodes.filter((node) => node.type === "GATEWAY");
}

/**
 * Get all rooms from a specific map
 * @param mapId - The map ID to search in
 * @returns Array of room nodes
 */
export async function getRoomNodes(mapId: string): Promise<Node[]> {
  const map = await getMap(mapId);
  if (!map) return [];

  return map.nodes.filter((node) => node.type === "ROOM");
}

/**
 * Search for nodes by name across all maps
 * @param searchTerm - Partial name to search for (case-insensitive)
 * @returns Array of matching nodes with their map IDs
 */
export async function searchNodes(
  searchTerm: string
): Promise<Array<{ node: Node; mapId: string }>> {
  const allMaps = await getAllMaps();
  const results: Array<{ node: Node; mapId: string }> = [];
  const lowerSearch = searchTerm.toLowerCase();

  for (const map of allMaps) {
    for (const node of map.nodes) {
      if (node.name.toLowerCase().includes(lowerSearch)) {
        results.push({ node, mapId: map.id });
      }
    }
  }

  return results;
}

/**
 * Get the path between two maps (which maps to traverse)
 * Uses BFS on the global graph to find the shortest map sequence
 * @param startMapId - Starting map ID
 * @param endMapId - Destination map ID
 * @returns Array of map IDs representing the path, or null if no path exists
 */
export async function getMapPath(
  startMapId: string,
  endMapId: string
): Promise<string[] | null> {
  if (startMapId === endMapId) {
    return [startMapId];
  }

  const globalGraph = await getGlobalGraph();
  const visited = new Set<string>();
  const queue: Array<{ mapId: string; path: string[] }> = [
    { mapId: startMapId, path: [startMapId] },
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.mapId === endMapId) {
      return current.path;
    }

    if (visited.has(current.mapId)) {
      continue;
    }
    visited.add(current.mapId);

    const neighbors = globalGraph.connections[current.mapId] ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push({
          mapId: neighbor,
          path: [...current.path, neighbor],
        });
      }
    }
  }

  return null; // No path found
}

/**
 * Get the gateway connection between two adjacent maps
 * @param fromMapId - Source map ID
 * @param toMapId - Target map ID
 * @returns Connection details or null if maps are not directly connected
 */
export async function getGatewayConnection(
  fromMapId: string,
  toMapId: string
): Promise<MapConnection | null> {
  const globalGraph = await getGlobalGraph();

  const connection = globalGraph.connectionDetails.find(
    (c) => c.fromMapId === fromMapId && c.toMapId === toMapId
  );

  return connection ?? null;
}

/**
 * Validate that all gateway connections are bidirectional
 * Useful for debugging and ensuring data integrity
 * @returns Array of warnings for any one-way gateway connections
 */
export async function validateGatewayConnections(): Promise<string[]> {
  const warnings: string[] = [];
  const globalGraph = await getGlobalGraph();

  for (const connection of globalGraph.connectionDetails) {
    const reverseExists = globalGraph.connectionDetails.some(
      (c) =>
        c.fromMapId === connection.toMapId && c.toMapId === connection.fromMapId
    );

    if (!reverseExists) {
      warnings.push(
        `One-way gateway: ${connection.fromMapId}:${connection.gatewayNodeId} -> ` +
          `${connection.toMapId}:${connection.targetNodeId} has no return path`
      );
    }
  }

  return warnings;
}
