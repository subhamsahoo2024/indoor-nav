import type { MapData, Node, Edge } from "@/types/navigation";

/**
 * Mock Graph Data for Multi-Map Indoor Navigation System
 *
 * Scenario: Navigate from Main Gate → Block A → Floor 1 → Dean's Office
 *
 * Map Hierarchy:
 * ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
 * │  CAMPUS MAIN    │     │  BLOCK A LOBBY  │     │    FLOOR 1      │
 * │                 │     │                 │     │                 │
 * │  main_gate ─────┼──►  │  lobby_entry    │     │                 │
 * │       │        │     │       │         │     │                 │
 * │       ▼        │     │       ▼         │     │                 │
 * │  block_a_entry ─┼──►──┼► lobby_entry   │     │                 │
 * │  (GATEWAY)     │     │  (GATEWAY)      │     │                 │
 * │                 │     │       │         │     │                 │
 * │                 │     │       ▼         │     │                 │
 * │                 │     │  lobby_stairs ──┼──►──┼► stairs_down    │
 * │                 │     │  (GATEWAY)      │     │  (GATEWAY)      │
 * │                 │     │                 │     │       │         │
 * │                 │     │                 │     │       ▼         │
 * │                 │     │                 │     │  corridor_1     │
 * │                 │     │                 │     │       │         │
 * │                 │     │                 │     │       ▼         │
 * │                 │     │                 │     │  deans_office   │
 * │                 │     │                 │     │  (ROOM)         │
 * └─────────────────┘     └─────────────────┘     └─────────────────┘
 */

// ============================================================================
// MAP 1: Campus Main
// ============================================================================

const campusMainNodes: Node[] = [
  {
    id: "main_gate",
    x: 15,
    y: 50,
    type: "NORMAL",
    name: "Main Gate",
    description: "Campus main entrance",
  },
  {
    id: "campus_path_1",
    x: 35,
    y: 50,
    type: "NORMAL",
    name: "Campus Path 1",
    description: "Main walkway intersection",
  },
  {
    id: "campus_path_2",
    x: 55,
    y: 50,
    type: "NORMAL",
    name: "Campus Path 2",
    description: "Path towards Block A",
  },
  {
    id: "block_a_entry",
    x: 75,
    y: 50,
    type: "GATEWAY",
    name: "Block A Entrance",
    description: "Entrance to Block A building",
    gatewayConfig: {
      targetMapId: "block_a_lobby",
      targetNodeId: "lobby_entry",
    },
  },
  {
    id: "block_b_entry",
    x: 55,
    y: 25,
    type: "GATEWAY",
    name: "Block B Entrance",
    description: "Entrance to Block B building (future)",
    gatewayConfig: {
      targetMapId: "block_b_lobby",
      targetNodeId: "lobby_entry_b",
    },
  },
  {
    id: "parking_area",
    x: 35,
    y: 80,
    type: "NORMAL",
    name: "Parking Area",
    description: "Main parking lot",
  },
];

const campusMainAdjacency: Record<string, Edge[]> = {
  main_gate: [{ targetNodeId: "campus_path_1", weight: 20 }],
  campus_path_1: [
    { targetNodeId: "main_gate", weight: 20 },
    { targetNodeId: "campus_path_2", weight: 20 },
    { targetNodeId: "parking_area", weight: 30 },
  ],
  campus_path_2: [
    { targetNodeId: "campus_path_1", weight: 20 },
    { targetNodeId: "block_a_entry", weight: 20 },
    { targetNodeId: "block_b_entry", weight: 25 },
  ],
  block_a_entry: [{ targetNodeId: "campus_path_2", weight: 20 }],
  block_b_entry: [{ targetNodeId: "campus_path_2", weight: 25 }],
  parking_area: [{ targetNodeId: "campus_path_1", weight: 30 }],
};

export const campusMainMap: MapData = {
  id: "campus_main",
  name: "Campus Main",
  imageUrl: "/maps/campus_main.png",
  nodes: campusMainNodes,
  adjacencyList: campusMainAdjacency,
};

// ============================================================================
// MAP 2: Block A Lobby
// ============================================================================

const blockALobbyNodes: Node[] = [
  {
    id: "lobby_entry",
    x: 20,
    y: 50,
    type: "GATEWAY",
    name: "Lobby Entry",
    description: "Main entrance from campus",
    gatewayConfig: {
      targetMapId: "campus_main",
      targetNodeId: "block_a_entry",
    },
  },
  {
    id: "lobby_center",
    x: 50,
    y: 50,
    type: "NORMAL",
    name: "Lobby Center",
    description: "Central lobby area",
  },
  {
    id: "reception_desk",
    x: 50,
    y: 30,
    type: "ROOM",
    name: "Reception Desk",
    description: "Building reception and information",
  },
  {
    id: "lobby_stairs",
    x: 80,
    y: 50,
    type: "GATEWAY",
    name: "Stairs to Floor 1",
    description: "Staircase leading to first floor",
    gatewayConfig: {
      targetMapId: "floor_1",
      targetNodeId: "stairs_down",
    },
  },
  {
    id: "elevator_lobby",
    x: 80,
    y: 30,
    type: "GATEWAY",
    name: "Elevator",
    description: "Elevator to all floors",
    gatewayConfig: {
      targetMapId: "floor_1",
      targetNodeId: "elevator_f1",
    },
  },
  {
    id: "restroom_lobby",
    x: 50,
    y: 75,
    type: "ROOM",
    name: "Restroom",
    description: "Ground floor restroom",
  },
];

const blockALobbyAdjacency: Record<string, Edge[]> = {
  lobby_entry: [{ targetNodeId: "lobby_center", weight: 15 }],
  lobby_center: [
    { targetNodeId: "lobby_entry", weight: 15 },
    { targetNodeId: "reception_desk", weight: 10 },
    { targetNodeId: "lobby_stairs", weight: 15 },
    { targetNodeId: "elevator_lobby", weight: 18 },
    { targetNodeId: "restroom_lobby", weight: 12 },
  ],
  reception_desk: [{ targetNodeId: "lobby_center", weight: 10 }],
  lobby_stairs: [
    { targetNodeId: "lobby_center", weight: 15 },
    { targetNodeId: "elevator_lobby", weight: 10 },
  ],
  elevator_lobby: [
    { targetNodeId: "lobby_center", weight: 18 },
    { targetNodeId: "lobby_stairs", weight: 10 },
  ],
  restroom_lobby: [{ targetNodeId: "lobby_center", weight: 12 }],
};

export const blockALobbyMap: MapData = {
  id: "block_a_lobby",
  name: "Block A - Ground Floor",
  imageUrl: "/maps/block_a_lobby.png",
  nodes: blockALobbyNodes,
  adjacencyList: blockALobbyAdjacency,
};

// ============================================================================
// MAP 3: Floor 1
// ============================================================================

const floor1Nodes: Node[] = [
  {
    id: "stairs_down",
    x: 20,
    y: 50,
    type: "GATEWAY",
    name: "Stairs Down",
    description: "Staircase to ground floor",
    gatewayConfig: {
      targetMapId: "block_a_lobby",
      targetNodeId: "lobby_stairs",
    },
  },
  {
    id: "elevator_f1",
    x: 20,
    y: 30,
    type: "GATEWAY",
    name: "Elevator",
    description: "Elevator to all floors",
    gatewayConfig: {
      targetMapId: "block_a_lobby",
      targetNodeId: "elevator_lobby",
    },
  },
  {
    id: "corridor_1",
    x: 40,
    y: 50,
    type: "NORMAL",
    name: "Corridor Junction",
    description: "Main corridor intersection",
  },
  {
    id: "corridor_north",
    x: 40,
    y: 25,
    type: "NORMAL",
    name: "North Corridor",
    description: "Corridor towards admin offices",
  },
  {
    id: "corridor_east",
    x: 70,
    y: 50,
    type: "NORMAL",
    name: "East Corridor",
    description: "Corridor towards faculty rooms",
  },
  {
    id: "deans_office",
    x: 60,
    y: 25,
    type: "ROOM",
    name: "Dean's Office",
    description: "Office of the Dean of Engineering",
  },
  {
    id: "admin_office",
    x: 40,
    y: 10,
    type: "ROOM",
    name: "Admin Office",
    description: "Administrative office",
  },
  {
    id: "faculty_room_101",
    x: 85,
    y: 35,
    type: "ROOM",
    name: "Faculty Room 101",
    description: "Prof. Smith office",
  },
  {
    id: "faculty_room_102",
    x: 85,
    y: 65,
    type: "ROOM",
    name: "Faculty Room 102",
    description: "Prof. Johnson office",
  },
  {
    id: "conference_room",
    x: 60,
    y: 75,
    type: "ROOM",
    name: "Conference Room A",
    description: "Large meeting room",
  },
];

const floor1Adjacency: Record<string, Edge[]> = {
  stairs_down: [
    { targetNodeId: "corridor_1", weight: 15 },
    { targetNodeId: "elevator_f1", weight: 10 },
  ],
  elevator_f1: [
    { targetNodeId: "stairs_down", weight: 10 },
    { targetNodeId: "corridor_1", weight: 12 },
  ],
  corridor_1: [
    { targetNodeId: "stairs_down", weight: 15 },
    { targetNodeId: "elevator_f1", weight: 12 },
    { targetNodeId: "corridor_north", weight: 15 },
    { targetNodeId: "corridor_east", weight: 20 },
    { targetNodeId: "conference_room", weight: 18 },
  ],
  corridor_north: [
    { targetNodeId: "corridor_1", weight: 15 },
    { targetNodeId: "deans_office", weight: 12 },
    { targetNodeId: "admin_office", weight: 10 },
  ],
  corridor_east: [
    { targetNodeId: "corridor_1", weight: 20 },
    { targetNodeId: "faculty_room_101", weight: 12 },
    { targetNodeId: "faculty_room_102", weight: 12 },
  ],
  deans_office: [{ targetNodeId: "corridor_north", weight: 12 }],
  admin_office: [{ targetNodeId: "corridor_north", weight: 10 }],
  faculty_room_101: [{ targetNodeId: "corridor_east", weight: 12 }],
  faculty_room_102: [{ targetNodeId: "corridor_east", weight: 12 }],
  conference_room: [{ targetNodeId: "corridor_1", weight: 18 }],
};

export const floor1Map: MapData = {
  id: "floor_1",
  name: "Block A - Floor 1",
  imageUrl: "/maps/floor_1.png",
  nodes: floor1Nodes,
  adjacencyList: floor1Adjacency,
};

// ============================================================================
// All Maps Collection
// ============================================================================

export const allMaps: MapData[] = [campusMainMap, blockALobbyMap, floor1Map];

export const mapsById: Record<string, MapData> = {
  campus_main: campusMainMap,
  block_a_lobby: blockALobbyMap,
  floor_1: floor1Map,
};
