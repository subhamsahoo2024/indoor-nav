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
      <main className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100 py-12 px-4">
        {/* Back to Home */}
        <div className="max-w-4xl mx-auto mb-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <Home className="w-4 h-4" />
            <span className="text-sm font-medium">Back to Home</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Campus Navigation
          </h1>
          <p className="text-gray-600">
            Find your way around the campus with ease
          </p>
        </div>

        {/* Location Selector */}
        <LocationSelector onStartNavigation={handleStartNavigation} />

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-sm text-gray-500">
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
    <main className="min-h-screen bg-gray-100 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Search</span>
          </button>

          <h1 className="text-lg font-semibold text-gray-800">
            Route Navigation
          </h1>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="font-medium">New Route</span>
          </button>
        </div>
      </div>

      {/* Navigation Map Container */}
      <div className="flex-1 p-4">
        <div className="h-full min-h-[calc(100vh-120px)] border-2 border-gray-200 rounded-xl overflow-hidden shadow-xl bg-white">
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
      </div>
    </main>
  );
}
