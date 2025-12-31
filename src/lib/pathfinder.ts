import type { MapData, Edge, Node, GatewayConfig } from "@/types/navigation";
import { isGatewayNode } from "@/types/navigation";
import { getMap, getAllMaps } from "@/lib/mapService";

/**
 * Pathfinder Module - Hierarchical Multi-Map Navigation
 *
 * This module implements a two-level pathfinding system:
 * 1. Global Level: BFS to find the sequence of maps to traverse
 * 2. Local Level: Dijkstra's algorithm for pathfinding within each map
 *
 * The result is a series of NavigationSegments that guide the user
 * from start to destination across multiple maps.
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Represents a navigation path segment within a single map
 */
export interface NavigationSegment {
  /** The map this segment belongs to */
  mapId: string;
  /** Ordered sequence of node IDs to traverse on this map */
  pathNodeIds: string[];
  /** If segment ends at a gateway, specifies the next map entry point */
  transitionTarget?: {
    mapId: string;
    nodeId: string;
  };
}

/**
 * Complete navigation result containing all segments
 */
export interface NavigationResult {
  /** Whether a valid path was found */
  success: boolean;
  /** Total number of maps traversed */
  totalMaps: number;
  /** Total number of nodes in the complete path */
  totalNodes: number;
  /** Ordered list of navigation segments */
  segments: NavigationSegment[];
  /** Error message if navigation failed */
  error?: string;
}

/**
 * Internal structure for Dijkstra's priority queue
 */
interface DijkstraQueueItem {
  nodeId: string;
  distance: number;
}

/**
 * Error types for pathfinding failures
 */
export class PathfinderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MAP_NOT_FOUND"
      | "NODE_NOT_FOUND"
      | "NO_PATH"
      | "GATEWAY_NOT_FOUND"
      | "INVALID_INPUT"
  ) {
    super(message);
    this.name = "PathfinderError";
  }
}

// ============================================================================
// Local Pathfinding (Single Map) - Dijkstra's Algorithm
// ============================================================================

/**
 * Find the shortest path between two nodes on the same map using Dijkstra's algorithm
 *
 * @param mapData - The map containing both nodes
 * @param startId - Starting node ID
 * @param endId - Destination node ID
 * @returns Array of node IDs representing the shortest path
 * @throws PathfinderError if no path exists or nodes not found
 */
export function findLocalPath(
  mapData: MapData,
  startId: string,
  endId: string
): string[] {
  // Edge case: start and end are the same
  if (startId === endId) {
    return [startId];
  }

  // Validate nodes exist in the map
  const nodeIds = new Set(mapData.nodes.map((n) => n.id));
  if (!nodeIds.has(startId)) {
    throw new PathfinderError(
      `Start node '${startId}' not found in map '${mapData.id}'`,
      "NODE_NOT_FOUND"
    );
  }
  if (!nodeIds.has(endId)) {
    throw new PathfinderError(
      `End node '${endId}' not found in map '${mapData.id}'`,
      "NODE_NOT_FOUND"
    );
  }

  // Initialize Dijkstra's data structures
  const distances: Map<string, number> = new Map();
  const previous: Map<string, string | null> = new Map();
  const visited: Set<string> = new Set();

  // Initialize all distances to infinity
  for (const nodeId of nodeIds) {
    distances.set(nodeId, Infinity);
    previous.set(nodeId, null);
  }
  distances.set(startId, 0);

  // Priority queue (using array with sorting - sufficient for small graphs)
  const queue: DijkstraQueueItem[] = [{ nodeId: startId, distance: 0 }];

  while (queue.length > 0) {
    // Sort by distance and get minimum (simple priority queue)
    queue.sort((a, b) => a.distance - b.distance);
    const current = queue.shift()!;

    // Skip if already visited
    if (visited.has(current.nodeId)) {
      continue;
    }
    visited.add(current.nodeId);

    // Early exit if we reached the destination
    if (current.nodeId === endId) {
      break;
    }

    // Get neighbors from adjacency list
    const edges = mapData.adjacencyList[current.nodeId] ?? [];

    for (const edge of edges) {
      if (visited.has(edge.targetNodeId)) {
        continue;
      }

      const newDistance = current.distance + edge.weight;
      const currentBest = distances.get(edge.targetNodeId) ?? Infinity;

      if (newDistance < currentBest) {
        distances.set(edge.targetNodeId, newDistance);
        previous.set(edge.targetNodeId, current.nodeId);
        queue.push({ nodeId: edge.targetNodeId, distance: newDistance });
      }
    }
  }

  // Reconstruct path from end to start
  const path: string[] = [];
  let currentNode: string | null = endId;

  while (currentNode !== null) {
    path.unshift(currentNode);
    currentNode = previous.get(currentNode) ?? null;
  }

  // Verify path starts at startId (if not, no path exists)
  if (path[0] !== startId) {
    throw new PathfinderError(
      `No path exists from '${startId}' to '${endId}' in map '${mapData.id}'`,
      "NO_PATH"
    );
  }

  return path;
}

// ============================================================================
// Global Pathfinding (Map Chain) - BFS
// ============================================================================

/**
 * Build a meta-graph of map connections from all maps
 *
 * @param allMaps - Array of all available maps
 * @returns Adjacency list of map connections (MapID -> connected MapIDs)
 */
function buildMapMetaGraph(allMaps: MapData[]): Record<string, string[]> {
  const metaGraph: Record<string, string[]> = {};

  // Initialize all maps in the meta-graph
  for (const map of allMaps) {
    metaGraph[map.id] = [];
  }

  // Scan for gateway connections
  for (const map of allMaps) {
    for (const node of map.nodes) {
      if (isGatewayNode(node)) {
        const targetMapId = node.gatewayConfig.targetMapId;
        // Add connection if not already present
        if (!metaGraph[map.id].includes(targetMapId)) {
          metaGraph[map.id].push(targetMapId);
        }
      }
    }
  }

  return metaGraph;
}

/**
 * Find the shortest sequence of maps to traverse using BFS
 *
 * @param startMapId - Starting map ID
 * @param endMapId - Destination map ID
 * @param allMaps - Array of all available maps
 * @returns Array of map IDs representing the traversal order
 * @throws PathfinderError if no path exists between maps
 */
export function findMapChain(
  startMapId: string,
  endMapId: string,
  allMaps: MapData[]
): string[] {
  // Edge case: same map
  if (startMapId === endMapId) {
    return [startMapId];
  }

  // Build the meta-graph
  const metaGraph = buildMapMetaGraph(allMaps);

  // Validate map IDs exist
  if (!(startMapId in metaGraph)) {
    throw new PathfinderError(
      `Start map '${startMapId}' not found`,
      "MAP_NOT_FOUND"
    );
  }
  if (!(endMapId in metaGraph)) {
    throw new PathfinderError(
      `End map '${endMapId}' not found`,
      "MAP_NOT_FOUND"
    );
  }

  // BFS to find shortest map sequence
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

    // Explore connected maps
    const connectedMaps = metaGraph[current.mapId] ?? [];
    for (const nextMapId of connectedMaps) {
      if (!visited.has(nextMapId)) {
        queue.push({
          mapId: nextMapId,
          path: [...current.path, nextMapId],
        });
      }
    }
  }

  throw new PathfinderError(
    `No route exists from map '${startMapId}' to map '${endMapId}'`,
    "NO_PATH"
  );
}

// ============================================================================
// Gateway Utilities
// ============================================================================

/**
 * Find a gateway node that connects to a specific target map
 *
 * @param mapData - The map to search in
 * @param targetMapId - The map ID we want to connect to
 * @returns The gateway node or null if not found
 */
function findGatewayToMap(mapData: MapData, targetMapId: string): Node | null {
  for (const node of mapData.nodes) {
    if (isGatewayNode(node) && node.gatewayConfig.targetMapId === targetMapId) {
      return node;
    }
  }
  return null;
}

/**
 * Find all gateway nodes in a map that connect to a specific target map
 *
 * @param mapData - The map to search in
 * @param targetMapId - The map ID we want to connect to
 * @returns Array of gateway nodes
 */
function findAllGatewaysToMap(mapData: MapData, targetMapId: string): Node[] {
  // Debug logging to identify gateway detection issues
  console.log(
    `[Pathfinder] Searching for gateways in map '${mapData.id}' to target '${targetMapId}'`
  );
  console.log(`[Pathfinder] Total nodes in map: ${mapData.nodes.length}`);

  const gatewayNodes = mapData.nodes.filter((node) => node.type === "GATEWAY");
  console.log(`[Pathfinder] Gateway type nodes found: ${gatewayNodes.length}`);

  for (const node of gatewayNodes) {
    console.log(`[Pathfinder] Gateway node '${node.id}' (${node.name}):`, {
      type: node.type,
      hasGatewayConfig: !!node.gatewayConfig,
      gatewayConfig: node.gatewayConfig,
      isValidGateway: isGatewayNode(node),
    });
  }

  return mapData.nodes.filter(
    (node) =>
      isGatewayNode(node) && node.gatewayConfig.targetMapId === targetMapId
  );
}

/**
 * Find the best gateway to use when multiple gateways connect to the same map
 * Uses Dijkstra to find which gateway results in shortest path from start node
 *
 * @param mapData - The current map
 * @param startNodeId - Where we're starting from on this map
 * @param targetMapId - The map we want to go to
 * @returns The best gateway node and the path to it
 */
function findBestGateway(
  mapData: MapData,
  startNodeId: string,
  targetMapId: string
): { gateway: Node; path: string[] } | null {
  const gateways = findAllGatewaysToMap(mapData, targetMapId);

  if (gateways.length === 0) {
    return null;
  }

  let bestGateway: Node | null = null;
  let bestPath: string[] = [];
  let bestDistance = Infinity;

  for (const gateway of gateways) {
    try {
      const path = findLocalPath(mapData, startNodeId, gateway.id);
      // Calculate total distance for this path
      let distance = 0;
      for (let i = 0; i < path.length - 1; i++) {
        const edges = mapData.adjacencyList[path[i]] ?? [];
        const edge = edges.find((e) => e.targetNodeId === path[i + 1]);
        distance += edge?.weight ?? 0;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestGateway = gateway;
        bestPath = path;
      }
    } catch {
      // This gateway is not reachable, skip it
      continue;
    }
  }

  if (bestGateway === null) {
    return null;
  }

  return { gateway: bestGateway, path: bestPath };
}

// ============================================================================
// Main Navigation Function
// ============================================================================

/**
 * Generate a complete navigation path from start to destination across multiple maps
 *
 * This is the main entry point for multi-map navigation. It:
 * 1. Determines which maps need to be traversed (map chain)
 * 2. For each map, calculates the optimal path between entry and exit points
 * 3. Returns a sequence of NavigationSegments for the UI to render
 *
 * @param startMapId - Map ID where navigation begins
 * @param startNodeId - Node ID where navigation begins
 * @param endMapId - Map ID of the destination
 * @param endNodeId - Node ID of the destination
 * @returns NavigationResult containing all segments or error information
 */
export async function generateNavigationPath(
  startMapId: string,
  startNodeId: string,
  endMapId: string,
  endNodeId: string
): Promise<NavigationResult> {
  try {
    // Validate inputs
    if (!startMapId || !startNodeId || !endMapId || !endNodeId) {
      throw new PathfinderError(
        "All parameters (startMapId, startNodeId, endMapId, endNodeId) are required",
        "INVALID_INPUT"
      );
    }

    // Fetch all maps
    const allMaps = await getAllMaps();

    // Step A: Find the sequence of maps to traverse
    const mapChain = findMapChain(startMapId, endMapId, allMaps);

    const segments: NavigationSegment[] = [];
    let currentEntryNodeId = startNodeId;

    // Step B: Build navigation segments for each map in the chain
    for (let i = 0; i < mapChain.length; i++) {
      const currentMapId = mapChain[i];
      const isFirstMap = i === 0;
      const isLastMap = i === mapChain.length - 1;
      const nextMapId = isLastMap ? null : mapChain[i + 1];

      // Fetch current map data
      const mapData = await getMap(currentMapId);
      if (!mapData) {
        throw new PathfinderError(
          `Map '${currentMapId}' not found`,
          "MAP_NOT_FOUND"
        );
      }

      let pathNodeIds: string[];
      let transitionTarget: NavigationSegment["transitionTarget"];

      if (isLastMap) {
        // Last map: path from entry node to final destination
        pathNodeIds = findLocalPath(mapData, currentEntryNodeId, endNodeId);
        transitionTarget = undefined;
      } else {
        // Not last map: find path to gateway leading to next map
        const gatewayResult = findBestGateway(
          mapData,
          currentEntryNodeId,
          nextMapId!
        );

        if (!gatewayResult) {
          throw new PathfinderError(
            `No gateway found from map '${currentMapId}' to map '${nextMapId}'`,
            "GATEWAY_NOT_FOUND"
          );
        }

        const { gateway, path } = gatewayResult;
        pathNodeIds = path;

        // Get the gateway config to know where we enter the next map
        const gatewayConfig = gateway.gatewayConfig as GatewayConfig;
        transitionTarget = {
          mapId: gatewayConfig.targetMapId,
          nodeId: gatewayConfig.targetNodeId,
        };

        // Update entry node for next iteration
        currentEntryNodeId = gatewayConfig.targetNodeId;
      }

      segments.push({
        mapId: currentMapId,
        pathNodeIds,
        transitionTarget,
      });
    }

    // Calculate totals
    const totalNodes = segments.reduce(
      (sum, seg) => sum + seg.pathNodeIds.length,
      0
    );

    return {
      success: true,
      totalMaps: mapChain.length,
      totalNodes,
      segments,
    };
  } catch (error) {
    if (error instanceof PathfinderError) {
      return {
        success: false,
        totalMaps: 0,
        totalNodes: 0,
        segments: [],
        error: error.message,
      };
    }

    // Unknown error
    return {
      success: false,
      totalMaps: 0,
      totalNodes: 0,
      segments: [],
      error:
        error instanceof Error ? error.message : "Unknown pathfinding error",
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Calculate the total distance of a path on a map
 *
 * @param mapData - The map containing the path
 * @param pathNodeIds - Array of node IDs in the path
 * @returns Total weight/distance of the path
 */
export function calculatePathDistance(
  mapData: MapData,
  pathNodeIds: string[]
): number {
  let totalDistance = 0;

  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const currentNodeId = pathNodeIds[i];
    const nextNodeId = pathNodeIds[i + 1];
    const edges = mapData.adjacencyList[currentNodeId] ?? [];
    const edge = edges.find((e) => e.targetNodeId === nextNodeId);

    if (edge) {
      totalDistance += edge.weight;
    }
  }

  return totalDistance;
}

/**
 * Get detailed node information for a path
 *
 * @param mapData - The map containing the nodes
 * @param pathNodeIds - Array of node IDs
 * @returns Array of Node objects with full details
 */
export function getPathNodes(mapData: MapData, pathNodeIds: string[]): Node[] {
  const nodeMap = new Map(mapData.nodes.map((n) => [n.id, n]));
  return pathNodeIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is Node => n !== undefined);
}

/**
 * Validate that a navigation result is executable
 * Checks that all segments have valid paths and transitions align
 *
 * @param result - The navigation result to validate
 * @returns true if valid, false otherwise
 */
export function validateNavigationResult(result: NavigationResult): boolean {
  if (!result.success || result.segments.length === 0) {
    return false;
  }

  for (let i = 0; i < result.segments.length - 1; i++) {
    const current = result.segments[i];
    const next = result.segments[i + 1];

    // Each non-final segment must have a transition target
    if (!current.transitionTarget) {
      return false;
    }

    // Transition target must match next segment's map
    if (current.transitionTarget.mapId !== next.mapId) {
      return false;
    }

    // Next segment must start at the transition target node
    if (next.pathNodeIds[0] !== current.transitionTarget.nodeId) {
      return false;
    }
  }

  // Last segment should not have transition target
  const lastSegment = result.segments[result.segments.length - 1];
  if (lastSegment.transitionTarget !== undefined) {
    return false;
  }

  return true;
}
