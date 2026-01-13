"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import type { MapData } from "@/types/navigation";
import MapEditor from "@/components/admin/MapEditor";

interface PageProps {
  params: Promise<{ id: string }>;
}

/**
 * Map Editor Page
 * Fetches map data and renders the visual editor
 */
export default function MapEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMap = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/maps/${id}`);
        const result = await response.json();

        if (result.success) {
          setMapData(result.data);
        } else {
          setError(result.error || "Failed to fetch map");
        }
      } catch (err) {
        setError("Failed to connect to server");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMap();
  }, [id]);

  // Handle map updates from editor
  const handleMapUpdate = (updatedMap: MapData) => {
    setMapData(updatedMap);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      {/* Header stays blue, main canvas uses a clean white backdrop */}
      <header className="bg-gradient-to-r from-blue-900 to-blue-700 text-white border-b border-blue-600/40 sticky top-0 z-50 shadow-sm animate-fadeInDown">
        <div className="max-w-full mx-auto px-4 py-3">
          <div className="flex items-center gap-4">
            <Link
              href="/admin"
              className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 border border-white/10 hover:border-white/20"
            >
              <ArrowLeft className="w-5 h-5 text-slate-200" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-semibold text-white">
                {mapData?.name || "Loading..."}
              </h1>
              <p className="text-sm text-slate-200">Map ID: {id}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-white">
        {/* Loading State */}
        {isLoading && (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-gray-600">Loading map data...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-red-800 mb-2">
                Error Loading Map
              </h2>
              <p className="text-red-600 mb-4">{error}</p>
              <Link
                href="/admin"
                className="inline-flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
              </Link>
            </div>
          </div>
        )}

        {/* Map Editor */}
        {!isLoading && !error && mapData && (
          <MapEditor mapData={mapData} onMapUpdate={handleMapUpdate} />
        )}
      </main>
    </div>
  );
}
