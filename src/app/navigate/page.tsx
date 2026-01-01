// app/navigate/page.tsx
"use client";

import { useState, useCallback } from "react";
import { ArrowLeft, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import IndoorNavigation from "@/components/IndoorNavigation";
import LocationSelector from "@/components/LocationSelector";

// ============================================================================
// Types
// ============================================================================

interface NavigationState {
  isNavigating: boolean;
  startMapId: string;
  startNodeId: string;
  endMapId: string;
  endNodeId: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function NavigatePage() {
  // Navigation state
  const [navState, setNavState] = useState<NavigationState>({
    isNavigating: false,
    startMapId: "",
    startNodeId: "",
    endMapId: "",
    endNodeId: "",
  });

  // Handle navigation start from LocationSelector
  const handleStartNavigation = useCallback(
    (
      startMapId: string,
      startNodeId: string,
      endMapId: string,
      endNodeId: string
    ) => {
      setNavState({
        isNavigating: true,
        startMapId,
        startNodeId,
        endMapId,
        endNodeId,
      });
    },
    []
  );

  // Reset to selector view
  const handleReset = useCallback(() => {
    setNavState({
      isNavigating: false,
      startMapId: "",
      startNodeId: "",
      endMapId: "",
      endNodeId: "",
    });
  }, []);

  // Handle navigation complete
  const handleNavigationComplete = useCallback(() => {
    // Optional: Could auto-reset or show a completion message
    console.log("Navigation completed!");
  }, []);

  // Handle navigation error
  const handleNavigationError = useCallback((error: string) => {
    console.error("Navigation error:", error);
    // Could show a toast or error UI
  }, []);

  // ============================================================================
  // Render: Location Selector View
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

        {/* Header */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-2">
            Campus Navigation
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Find your way around the campus with ease
          </p>
        </div>

        {/* Location Selector */}
        <LocationSelector onStartNavigation={handleStartNavigation} />

        {/* Footer */}
        <div className="mt-8 sm:mt-12 text-center">
          <p className="text-xs sm:text-sm text-gray-500">
            Indoor Navigation System • Multi-Map Routing
          </p>
        </div>
      </main>
    );
  }

  // ============================================================================
  // Render: Navigation View
  // ============================================================================

  return (
    <main className="h-screen bg-gray-100 flex flex-col overflow-hidden">
      {/* Top Bar - Compact on Mobile */}
      <div className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-h-[44px] text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base font-medium hidden sm:inline">
              Back to Search
            </span>
            <span className="text-sm font-medium sm:hidden">Back</span>
          </button>

          <h1 className="text-sm sm:text-lg font-semibold text-gray-800">
            Route Navigation
          </h1>

          <button
            onClick={handleReset}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 min-h-[44px] text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm font-medium hidden sm:inline">
              New Route
            </span>
            <span className="text-sm font-medium sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Navigation Map Container - Full Viewport */}
      <div className="flex-1 overflow-hidden">
        <IndoorNavigation
          startMapId={navState.startMapId}
          startNodeId={navState.startNodeId}
          endMapId={navState.endMapId}
          endNodeId={navState.endNodeId}
          animationSpeed={1}
          showLabels={true}
          onComplete={handleNavigationComplete}
          onError={handleNavigationError}
        />
      </div>
    </main>
  );
}
