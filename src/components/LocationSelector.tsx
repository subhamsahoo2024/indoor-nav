"use client";

import { useState, useEffect, useMemo } from "react";
import {
  MapPin,
  Navigation,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  DoorOpen,
  Compass,
} from "lucide-react";
import type { MapData, Node, NodeType } from "@/types/navigation";

// ============================================================================
// Types
// ============================================================================

interface LocationSelectorProps {
  onStartNavigation: (
    startMapId: string,
    startNodeId: string,
    endMapId: string,
    endNodeId: string
  ) => void;
}

interface MapOption {
  id: string;
  name: string;
  nodes: Node[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function getNodeIcon(type: NodeType) {
  switch (type) {
    case "GATEWAY":
      return DoorOpen;
    case "ROOM":
      return Building2;
    default:
      return MapPin;
  }
}

function getNodeTypeLabel(type: NodeType): string {
  switch (type) {
    case "GATEWAY":
      return "Gateway";
    case "ROOM":
      return "Room";
    default:
      return "Point";
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function LocationSelector({
  onStartNavigation,
}: LocationSelectorProps) {
  // Data state
  const [maps, setMaps] = useState<MapOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state - Start
  const [startMapId, setStartMapId] = useState<string>("");
  const [startNodeId, setStartNodeId] = useState<string>("");

  // Selection state - End
  const [endMapId, setEndMapId] = useState<string>("");
  const [endNodeId, setEndNodeId] = useState<string>("");

  // Fetch all maps on mount
  useEffect(() => {
    const fetchMaps = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // First get the list of maps
        const listResponse = await fetch("/api/maps");
        const listResult = await listResponse.json();

        if (!listResult.success) {
          throw new Error(listResult.error || "Failed to fetch maps");
        }

        // Fetch full data for each map to get nodes
        const mapsWithNodes: MapOption[] = await Promise.all(
          listResult.data.map(async (mapMeta: { id: string; name: string }) => {
            const mapResponse = await fetch(`/api/maps/${mapMeta.id}`);
            const mapResult = await mapResponse.json();

            if (mapResult.success) {
              return {
                id: mapResult.data.id,
                name: mapResult.data.name,
                nodes: mapResult.data.nodes || [],
              };
            }
            return {
              id: mapMeta.id,
              name: mapMeta.name,
              nodes: [],
            };
          })
        );

        setMaps(mapsWithNodes.filter((m) => m.nodes.length > 0));
      } catch (err) {
        console.error("Failed to fetch maps:", err);
        setError(err instanceof Error ? err.message : "Failed to load maps");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMaps();
  }, []);

  // Get nodes for start selection (all node types)
  const startNodes = useMemo(() => {
    const selectedMap = maps.find((m) => m.id === startMapId);
    if (!selectedMap) return [];
    // Return all nodes for start selection
    return selectedMap.nodes;
  }, [maps, startMapId]);

  // Get nodes for end selection (prefer non-gateway, but include all if needed)
  const endNodes = useMemo(() => {
    const selectedMap = maps.find((m) => m.id === endMapId);
    if (!selectedMap) return [];

    // Filter out GATEWAY nodes for destination (users navigate to rooms, not connectors)
    const nonGatewayNodes = selectedMap.nodes.filter(
      (n) => n.type !== "GATEWAY"
    );

    // If there are non-gateway nodes, return those; otherwise return all
    return nonGatewayNodes.length > 0 ? nonGatewayNodes : selectedMap.nodes;
  }, [maps, endMapId]);

  // Reset node selection when map changes
  useEffect(() => {
    setStartNodeId("");
  }, [startMapId]);

  useEffect(() => {
    setEndNodeId("");
  }, [endMapId]);

  // Validation
  const isValid =
    startMapId &&
    startNodeId &&
    endMapId &&
    endNodeId &&
    startNodeId !== endNodeId;

  // Handle navigation start
  const handleStartNavigation = () => {
    if (isValid) {
      onStartNavigation(startMapId, startNodeId, endMapId, endNodeId);
    }
  };

  // Get selected node names for summary
  const startNodeName = startNodes.find((n) => n.id === startNodeId)?.name;
  const endNodeName = endNodes.find((n) => n.id === endNodeId)?.name;
  const startMapName = maps.find((m) => m.id === startMapId)?.name;
  const endMapName = maps.find((m) => m.id === endMapId)?.name;

  // ============================================================================
  // Render
  // ============================================================================

  if (isLoading) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
            <p className="text-gray-600">Loading available locations...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
            <p className="text-red-600 font-medium mb-2">
              Failed to load locations
            </p>
            <p className="text-gray-500 text-sm">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium mb-2">No maps available</p>
            <p className="text-gray-500 text-sm">
              Please add maps with nodes in the admin dashboard.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                Indoor Navigation
              </h2>
              <p className="text-blue-100 text-sm">
                Find the best route to your destination
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-6 space-y-6">
          {/* Start Location */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
              Starting Point
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* Start Map Select */}
              <div>
                <select
                  value={startMapId}
                  onChange={(e) => setStartMapId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select building/area...</option>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Start Node Select */}
              <div>
                <select
                  value={startNodeId}
                  onChange={(e) => setStartNodeId(e.target.value)}
                  disabled={!startMapId}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {startMapId ? "Select location..." : "Select area first"}
                  </option>
                  {startNodes.map((node) => {
                    const Icon = getNodeIcon(node.type);
                    return (
                      <option key={node.id} value={node.id}>
                        {node.name} ({getNodeTypeLabel(node.type)})
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* Direction Arrow */}
          <div className="flex justify-center">
            <div className="p-2 bg-gray-100 rounded-full">
              <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* End Location */}
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-red-500" />
              </div>
              Destination
            </label>

            <div className="grid grid-cols-2 gap-3">
              {/* End Map Select */}
              <div>
                <select
                  value={endMapId}
                  onChange={(e) => setEndMapId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                >
                  <option value="">Select building/area...</option>
                  {maps.map((map) => (
                    <option key={map.id} value={map.id}>
                      {map.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* End Node Select */}
              <div>
                <select
                  value={endNodeId}
                  onChange={(e) => setEndNodeId(e.target.value)}
                  disabled={!endMapId}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-gray-800 bg-gray-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {endMapId ? "Select destination..." : "Select area first"}
                  </option>
                  {endNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({getNodeTypeLabel(node.type)})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Route Summary */}
          {startNodeName && endNodeName && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Route: </span>
                <span className="text-green-600 font-medium">
                  {startNodeName}
                </span>
                {startMapId !== endMapId && (
                  <span className="text-gray-500"> ({startMapName})</span>
                )}
                <span className="mx-2">→</span>
                <span className="text-red-600 font-medium">{endNodeName}</span>
                {startMapId !== endMapId && (
                  <span className="text-gray-500"> ({endMapName})</span>
                )}
              </p>
              {startMapId !== endMapId && (
                <p className="text-xs text-blue-600 mt-1">
                  Multi-building route - gateways will be used
                </p>
              )}
            </div>
          )}

          {/* Same Node Warning */}
          {startNodeId && endNodeId && startNodeId === endNodeId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm text-amber-800">
                ⚠️ Start and destination cannot be the same location.
              </p>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={handleStartNavigation}
            disabled={!isValid}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 disabled:shadow-none transition-all flex items-center justify-center gap-3"
          >
            <Navigation className="w-5 h-5" />
            Start Navigation
          </button>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            Tip: The system will automatically find the optimal route, including
            any necessary building transitions.
          </p>
        </div>
      </div>
    </div>
  );
}
