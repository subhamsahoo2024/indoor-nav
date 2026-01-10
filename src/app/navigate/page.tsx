// app/navigate/page.tsx
"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { Navigation2, RotateCcw, Home, MapPin, Target } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import IndoorNavigation from "@/components/IndoorNavigation";
import LocationSelector from "@/components/LocationSelector";
import AIChatbot from "@/components/AIChatbot";
import { getAllMaps } from "@/lib/mapService";
import { generateNavigationPath } from "@/lib/pathfinder";
import type { MapData } from "@/types/navigation";

// ============================================================================
// Types
// ============================================================================

interface LocationPoint {
  mapId: string;
  nodeId: string;
}

interface NavigationState {
  startNode: LocationPoint | null;
  endNode: LocationPoint | null;
  isNavigating: boolean;
}

// ============================================================================
// Main Component
// ============================================================================

export default function NavigatePage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100">
          <div className="text-gray-700 text-sm">Loading navigation…</div>
        </main>
      }
    >
      <NavigatePageContent />
    </Suspense>
  );
}

function NavigatePageContent() {
  // Read URL query parameters for QR Code detection
  const searchParams = useSearchParams();
  const qrMapId = searchParams.get("mapId");
  const qrNodeId = searchParams.get("nodeId");

  // Navigation state (refactored)
  const [navState, setNavState] = useState<NavigationState>({
    startNode: null,
    endNode: null,
    isNavigating: false,
  });

  // Maps data
  const [allMaps, setAllMaps] = useState<MapData[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(true);

  // Load all maps on mount
  useEffect(() => {
    const loadMaps = async () => {
      try {
        setIsLoadingMaps(true);
        const maps = await getAllMaps();
        setAllMaps(maps);
      } catch (error) {
        console.error("Failed to load maps:", error);
      } finally {
        setIsLoadingMaps(false);
      }
    };
    loadMaps();
  }, []);

  // Set start node from QR code parameters
  useEffect(() => {
    if (qrMapId && qrNodeId && !navState.startNode) {
      setNavState((prev) => ({
        ...prev,
        startNode: { mapId: qrMapId, nodeId: qrNodeId },
      }));
    }
  }, [qrMapId, qrNodeId, navState.startNode]);

  // Calculate distance between two nodes (using pathfinder)
  const calculateDistance = useCallback(
    async (from: LocationPoint, to: LocationPoint): Promise<number | null> => {
      try {
        const result = await generateNavigationPath(
          from.mapId,
          from.nodeId,
          to.mapId,
          to.nodeId
        );
        if (result.success) {
          return result.totalNodes; // Use node count as distance metric
        }
        return null;
      } catch {
        return null;
      }
    },
    []
  );

  // Handle manual navigation start from LocationSelector
  const handleManualSelection = useCallback(
    (
      startMapId: string,
      startNodeId: string,
      endMapId: string,
      endNodeId: string
    ) => {
      // Update both start and end nodes from manual selection
      setNavState((prev) => ({
        ...prev,
        startNode: { mapId: startMapId, nodeId: startNodeId },
        endNode: { mapId: endMapId, nodeId: endNodeId },
        // Start navigating immediately to avoid double-click race with onNavigationTrigger
        isNavigating: true,
      }));
    },
    []
  );

  // Handle chatbot destination selection (ONLY sets destination)
  const handleBotSetDestination = useCallback(
    async (destinationNodeId: string, destinationMapId: string) => {
      // Simply set the end node - DO NOT change start node
      // This will auto-fill the destination dropdown in LocationSelector
      setNavState((prev) => ({
        ...prev,
        endNode: { mapId: destinationMapId, nodeId: destinationNodeId },
      }));
    },
    []
  );

  // Handle chatbot location selection (sets starting location)
  const handleBotSetCurrentLocation = useCallback(
    (nodeId: string, mapId: string) => {
      // Set the start node from chatbot
      setNavState((prev) => ({
        ...prev,
        startNode: { mapId, nodeId },
      }));
    },
    []
  );

  // Start navigation (manual trigger)
  const handleStartNavigation = useCallback(() => {
    if (navState.startNode && navState.endNode) {
      setNavState((prev) => ({ ...prev, isNavigating: true }));
    }
  }, [navState.startNode, navState.endNode]);

  // Reset navigation
  const handleReset = useCallback(() => {
    setNavState({
      startNode:
        qrMapId && qrNodeId ? { mapId: qrMapId, nodeId: qrNodeId } : null,
      endNode: null,
      isNavigating: false,
    });
  }, [qrMapId, qrNodeId]);

  // Handle navigation complete
  const handleNavigationComplete = useCallback(() => {
    console.log("Navigation completed!");
  }, []);

  // Handle navigation error
  const handleNavigationError = useCallback((error: string) => {
    console.error("Navigation error:", error);
  }, []);

  // Get node display name
  const getNodeName = useCallback(
    (location: LocationPoint | null): string => {
      if (!location) return "Not selected";
      const map = allMaps.find((m) => m.id === location.mapId);
      const node = map?.nodes.find((n) => n.id === location.nodeId);
      return node?.name || location.nodeId;
    },
    [allMaps]
  );

  // Check if navigation can start
  const canStartNavigation =
    navState.startNode && navState.endNode && !navState.isNavigating;

  // ============================================================================
  // Render: Setup View (Before Navigation Starts)
  // ============================================================================

  if (!navState.isNavigating) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 py-6 sm:py-12 px-4">
        {/* Back to Home */}
        <div className="max-w-4xl mx-auto mb-4 sm:mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
        </div>

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-48 h-48">
            <img
              src="/navigation-logo.png"
              alt="Indoor Navigation Logo"
              className="w-full h-full object-contain drop-shadow-lg hover:scale-105 transition-transform duration-300"
            />
          </div>
        </div>

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Smart Navigation
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Find your way around the indoor spaces with ease
          </p>
        </div>

        {/* Location Selector */}
        <LocationSelector
          key={`${navState.startNode?.mapId}-${navState.startNode?.nodeId}-${navState.endNode?.mapId}-${navState.endNode?.nodeId}`}
          onStartNavigation={handleManualSelection}
          initialStartMapId={navState.startNode?.mapId}
          initialStartNodeId={navState.startNode?.nodeId}
          initialEndMapId={navState.endNode?.mapId}
          initialEndNodeId={navState.endNode?.nodeId}
          onNavigationTrigger={handleStartNavigation}
        />

        {/* Footer */}
        <div className="mt-8 sm:mt-12 text-center">
          <p className="text-xs sm:text-sm text-gray-500">
            Indoor Navigation System • Multi-Map Routing
          </p>
        </div>

        {/* AI Chatbot */}
        {!isLoadingMaps && allMaps.length > 0 && (
          <AIChatbot
            onSetDestination={handleBotSetDestination}
            onSetCurrentLocation={handleBotSetCurrentLocation}
            allMaps={allMaps}
            currentMapId={navState.startNode?.mapId}
          />
        )}
      </main>
    );
  }

  // ============================================================================
  // Render: Active Navigation View
  // ============================================================================

  return (
    <main className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-h-[44px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">New Route</span>
          </button>

          <div className="text-center">
            <h1 className="text-sm sm:text-lg font-semibold text-gray-800">
              Navigating to {getNodeName(navState.endNode)}
            </h1>
            <p className="text-xs text-gray-500">
              From {getNodeName(navState.startNode)}
            </p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-h-[44px] text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Home</span>
          </Link>
        </div>
      </div>

      {/* Navigation Map Container */}
      <div className="flex-1 overflow-hidden">
        {navState.startNode && navState.endNode && (
          <IndoorNavigation
            startMapId={navState.startNode.mapId}
            startNodeId={navState.startNode.nodeId}
            endMapId={navState.endNode.mapId}
            endNodeId={navState.endNode.nodeId}
            animationSpeed={1}
            showLabels={true}
            onComplete={handleNavigationComplete}
            onError={handleNavigationError}
          />
        )}
      </div>

      {/* AI Chatbot - Change destination during navigation */}
      {!isLoadingMaps && allMaps.length > 0 && (
        <AIChatbot
          onSetDestination={handleBotSetDestination}
          onSetCurrentLocation={handleBotSetCurrentLocation}
          allMaps={allMaps}
          currentMapId={navState.startNode?.mapId}
        />
      )}
    </main>
  );
}
