/**
 * Core Type Definitions for Multi-Map Indoor Navigation System
 * All coordinates are stored as percentages (0-100) relative to map container
 */

/** Node classification types */
export type NodeType = "NORMAL" | "ROOM" | "GATEWAY";

/**
 * Coordinate in percentage (0-100) relative to map container
 * Ensures responsiveness across different screen sizes
 */
export interface Coordinate {
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

/**
 * Gateway configuration for nodes that connect different maps
 * Only applicable when node type is 'GATEWAY'
 */
export interface GatewayConfig {
  /** The map ID this gateway leads to */
  targetMapId: string;
  /** The entry node ID on the target map */
  targetNodeId: string;
}

/**
 * Navigation Node representing a point on a map
 * Can be a normal waypoint, a room, or a gateway between maps
 */
export interface Node {
  /** Unique identifier for the node */
  id: string;
  /** X coordinate as percentage (0-100) of map width */
  x: number;
  /** Y coordinate as percentage (0-100) of map height */
  y: number;
  /** Classification of the node */
  type: NodeType;
  /** Human-readable name for the node */
  name: string;
  /** Optional description or additional info */
  description?: string;
  /** Gateway configuration - required when type is 'GATEWAY' */
  gatewayConfig?: GatewayConfig;
}

/**
 * Edge representing a connection between two nodes
 * Used in adjacency list to define graph connections
 */
export interface Edge {
  /** The node ID this edge connects to */
  targetNodeId: string;
  /** Weight/distance of this connection (used in pathfinding) */
  weight: number;
}

/**
 * Complete map data structure containing nodes and their connections
 */
export interface MapData {
  /** Unique identifier for the map */
  id: string;
  /** Human-readable name for the map */
  name: string;
  /** URL or path to the map image */
  imageUrl: string;
  /** Array of all nodes on this map */
  nodes: Node[];
  /** Adjacency list: NodeID -> Array of connected edges */
  adjacencyList: Record<string, Edge[]>;
}

/**
 * Simplified map connection for global routing
 * Used to determine which maps connect to each other
 */
export interface MapConnection {
  /** Source map ID */
  fromMapId: string;
  /** Target map ID */
  toMapId: string;
  /** Gateway node ID on source map */
  gatewayNodeId: string;
  /** Entry node ID on target map */
  targetNodeId: string;
}

/**
 * Global graph structure showing inter-map connections
 * Essential for multi-map pathfinding
 */
export interface GlobalGraph {
  /** All map IDs in the system */
  mapIds: string[];
  /** Map ID -> Array of connected Map IDs */
  connections: Record<string, string[]>;
  /** Detailed connection information */
  connectionDetails: MapConnection[];
}

/**
 * Type guard to check if a node is a gateway with valid configuration
 * Validates that the node has type GATEWAY and gatewayConfig with non-empty values
 */
export function isGatewayNode(
  node: Node
): node is Node & { gatewayConfig: GatewayConfig } {
  return (
    node.type === "GATEWAY" &&
    node.gatewayConfig !== undefined &&
    node.gatewayConfig !== null &&
    typeof node.gatewayConfig.targetMapId === "string" &&
    node.gatewayConfig.targetMapId.trim() !== "" &&
    typeof node.gatewayConfig.targetNodeId === "string" &&
    node.gatewayConfig.targetNodeId.trim() !== ""
  );
}

/**
 * Validate that coordinates are within valid percentage range
 */
export function isValidCoordinate(coord: Coordinate): boolean {
  return coord.x >= 0 && coord.x <= 100 && coord.y >= 0 && coord.y <= 100;
}

/**
 * Validate a node has proper coordinate values
 */
export function isValidNode(node: Node): boolean {
  const coordValid =
    node.x >= 0 && node.x <= 100 && node.y >= 0 && node.y <= 100;
  const gatewayValid =
    node.type !== "GATEWAY" || node.gatewayConfig !== undefined;
  return coordValid && gatewayValid;
}
