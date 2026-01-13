// app/navigate/page.tsx
"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { Navigation2, RotateCcw, Home, MapPin, Target } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
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
        <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
          <div className="animate-fadeInUp">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin" />
              <div className="text-slate-300 text-sm">Loading navigation…</div>
            </div>
          </div>
        </main>
      }
    >
      <NavigatePageContent />
    </Suspense>
  );
}

function NavigatePageContent() {
  // Router for navigation
  const router = useRouter();

  // Read URL query parameters for QR Code detection and shared destination
  const searchParams = useSearchParams();
  const qrMapId = searchParams.get("mapId");
  const qrNodeId = searchParams.get("nodeId");
  const destNodeId = searchParams.get("dest");

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

  // Initialize start node from QR code parameters
  useEffect(() => {
    if (navState.startNode) return; // Already set, don't override

    // Check for QR code scan in URL
    if (qrMapId && qrNodeId) {
      const startNode = { mapId: qrMapId, nodeId: qrNodeId };
      setNavState((prev) => ({ ...prev, startNode }));
    }
  }, [qrMapId, qrNodeId, navState.startNode]);

  // Set destination from shared link (dest parameter)
  useEffect(() => {
    if (!destNodeId || allMaps.length === 0) return;

    // Find the node across all maps
    let foundNode: { mapId: string; nodeId: string } | null = null;

    for (const map of allMaps) {
      const node = map.nodes?.find((n) => n.id === destNodeId);
      if (node) {
        foundNode = { mapId: map.id, nodeId: node.id };
        break;
      }
    }

    if (foundNode) {
      setNavState((prev) => {
        // Only update if the endNode is not already set to this node
        if (
          prev.endNode?.nodeId === foundNode.nodeId &&
          prev.endNode?.mapId === foundNode.mapId
        ) {
          return prev;
        }
        return {
          ...prev,
          endNode: foundNode,
        };
      });
    } else {
      console.warn(`Destination node '${destNodeId}' not found in any map`);
    }
  }, [destNodeId, allMaps]);

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
    // Reset state - clear all navigation data
    setNavState({
      startNode: null,
      endNode: null,
      isNavigating: false,
    });

    // Redirect to clean navigate page without query parameters
    router.push("/navigate");
  }, [router]);

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
      <main className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 py-6 sm:py-12 px-4 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          {/* Back to Home */}
          <div className="max-w-4xl mx-auto mb-4 sm:mb-6 animate-fadeInDown">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-all duration-300 min-h-[44px] border border-white/10 hover:border-white/20"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
          </div>

          {/* Logo */}
          <div className="flex justify-center mb-8 animate-fadeInUp delay-100">
            <div className="w-40 h-40 sm:w-48 sm:h-48">
              <img
                src="/navigation-logo.png"
                alt="Indoor Navigation Logo"
                className="w-full h-full object-contain drop-shadow-lg hover:scale-110 transition-transform duration-500"
              />
            </div>
          </div>

          {/* Header */}
          <div className="text-center mb-6 sm:mb-12 animate-fadeInUp delay-200">
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-4">
              Smart Navigation
            </h1>
            <p className="text-sm sm:text-lg text-slate-400">
              Find your way around the indoor spaces with ease
            </p>
          </div>

          {/* Location Selector */}
          <div className="animate-fadeInUp delay-300">
            <LocationSelector
              key={`${navState.startNode?.mapId}-${navState.startNode?.nodeId}-${navState.endNode?.mapId}-${navState.endNode?.nodeId}`}
              onStartNavigation={handleManualSelection}
              initialStartMapId={navState.startNode?.mapId}
              initialStartNodeId={navState.startNode?.nodeId}
              initialEndMapId={navState.endNode?.mapId}
              initialEndNodeId={navState.endNode?.nodeId}
              onNavigationTrigger={handleStartNavigation}
            />
          </div>

          {/* Footer */}
          <div className="mt-8 sm:mt-12 text-center animate-fadeInUp delay-400">
            <p className="text-xs sm:text-sm text-slate-500">
              Indoor Navigation System • Multi-Map Routing with AI
            </p>
          </div>

          {/* AI Chatbot */}
          {!isLoadingMaps && allMaps.length > 0 && (
            <div className="animate-fadeInUp delay-500">
              <AIChatbot
                onSetDestination={handleBotSetDestination}
                onSetCurrentLocation={handleBotSetCurrentLocation}
                allMaps={allMaps}
                currentMapId={navState.startNode?.mapId}
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  // ============================================================================
  // Render: Active Navigation View
  // ============================================================================

  return (
    <main className="h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex flex-col overflow-hidden relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl" />
      </div>

      {/* Top Bar */}
      <div className="bg-white/5 backdrop-blur-sm border-b border-white/10 flex-shrink-0 relative z-20">
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-h-[44px] text-cyan-400 hover:text-cyan-300 hover:bg-white/10 rounded-lg transition-all duration-300 border border-white/10 hover:border-white/20"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium">New Route</span>
          </button>

          <div className="text-center">
            <h1 className="text-sm sm:text-lg font-semibold text-white">
              Navigating to{" "}
              <span className="text-cyan-400">
                {getNodeName(navState.endNode)}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              From {getNodeName(navState.startNode)}
            </p>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-h-[44px] text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-all duration-300 border border-white/10 hover:border-white/20"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">Home</span>
          </Link>
        </div>
      </div>

      {/* Navigation Map Container */}
      <div className="flex-1 overflow-hidden relative z-10">
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
    </main>
  );
}
