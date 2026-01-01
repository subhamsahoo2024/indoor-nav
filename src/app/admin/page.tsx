"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  Map,
  Loader2,
  AlertCircle,
  Trash2,
  Upload,
  X,
  Image as ImageIcon,
  Home,
} from "lucide-react";
import type { MapData } from "@/types/navigation";

/**
 * Admin Dashboard - Map List Page
 * Displays all maps and allows creating new ones
 */
export default function AdminPage() {
  const [maps, setMaps] = useState<MapData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // New map form state
  const [newMapId, setNewMapId] = useState("");
  const [newMapName, setNewMapName] = useState("");
  const [newMapImageUrl, setNewMapImageUrl] = useState("");

  // File upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);

  // Fetch all maps on mount
  useEffect(() => {
    fetchMaps();
  }, []);

  const fetchMaps = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/maps");
      const result = await response.json();

      if (result.success) {
        setMaps(result.data);
      } else {
        setError(result.error || "Failed to fetch maps");
      }
    } catch (err) {
      setError("Failed to connect to server");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file selection and upload
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setIsUploading(true);
    setSelectedFileName(file.name);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (result.success) {
        setNewMapImageUrl(result.data.url);
      } else {
        setUploadError(result.error || "Failed to upload file");
        setSelectedFileName(null);
        setNewMapImageUrl("");
      }
    } catch (err) {
      setUploadError("Failed to upload file");
      setSelectedFileName(null);
      setNewMapImageUrl("");
      console.error(err);
    } finally {
      setIsUploading(false);
    }
  };

  // Clear selected file
  const handleClearFile = () => {
    setNewMapImageUrl("");
    setSelectedFileName(null);
    setUploadError(null);
  };

  const handleCreateMap = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMapId.trim() || !newMapName.trim() || !newMapImageUrl.trim()) {
      return;
    }

    setIsCreating(true);

    try {
      const response = await fetch("/api/maps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newMapId.trim().toLowerCase().replace(/\s+/g, "_"),
          name: newMapName.trim(),
          imageUrl: newMapImageUrl.trim(),
          nodes: [],
          adjacencyList: {},
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMaps((prev) => [...prev, result.data]);
        setIsModalOpen(false);
        resetForm();
      } else {
        alert(result.error || "Failed to create map");
      }
    } catch (err) {
      alert("Failed to create map");
      console.error(err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteMap = async (mapId: string, mapName: string) => {
    if (!confirm(`Are you sure you want to delete "${mapName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/maps/${mapId}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        setMaps((prev) => prev.filter((m) => m.id !== mapId));
      } else {
        alert(result.error || "Failed to delete map");
      }
    } catch (err) {
      alert("Failed to delete map");
      console.error(err);
    }
  };

  const resetForm = () => {
    setNewMapId("");
    setNewMapName("");
    setNewMapImageUrl("");
    setSelectedFileName(null);
    setUploadError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Back to Home Link */}
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Map className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  Map Admin Dashboard
                </h1>
                <p className="text-sm text-gray-500">
                  Manage indoor navigation maps
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create New Map
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            <span className="ml-3 text-gray-600">Loading maps...</span>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500" />
            <div>
              <p className="text-red-800 font-medium">Error loading maps</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
            <button
              onClick={fetchMaps}
              className="ml-auto px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && maps.length === 0 && (
          <div className="text-center py-20">
            <Map className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              No maps yet
            </h2>
            <p className="text-gray-500 mb-6">
              Create your first map to get started
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create New Map
            </button>
          </div>
        )}

        {/* Map Grid */}
        {!isLoading && !error && maps.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {maps.map((map) => (
              <div
                key={map.id}
                className="bg-white rounded-xl shadow-sm border overflow-hidden group hover:shadow-md transition-shadow"
              >
                {/* Map Image */}
                <div className="relative aspect-video bg-gray-100">
                  <div
                    className="absolute inset-0 bg-cover bg-center bg-gray-200"
                    style={{
                      backgroundImage: map.imageUrl
                        ? `url(${map.imageUrl})`
                        : undefined,
                    }}
                  >
                    {!map.imageUrl && (
                      <div className="flex items-center justify-center h-full">
                        <Map className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Delete Button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteMap(map.id, map.name);
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Map Info */}
                <Link href={`/admin/map/${map.id}`}>
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {map.name}
                    </h3>
                    <p className="text-sm text-gray-500">ID: {map.id}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-400">
                      <span>
                        {(map as MapData & { nodes?: unknown[] }).nodes
                          ?.length ?? 0}{" "}
                        nodes
                      </span>
                    </div>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Map Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Create New Map
              </h2>

              <form onSubmit={handleCreateMap} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Map ID
                  </label>
                  <input
                    type="text"
                    value={newMapId}
                    onChange={(e) => setNewMapId(e.target.value)}
                    placeholder="e.g., campus_main"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Unique identifier (lowercase, underscores)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Map Name
                  </label>
                  <input
                    type="text"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    placeholder="e.g., Campus Main"
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Map Image
                  </label>

                  {/* File Upload Area */}
                  {!newMapImageUrl ? (
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        disabled={isUploading}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                        id="map-image-upload"
                      />
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          isUploading
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
                        }`}
                      >
                        {isUploading ? (
                          <div className="flex flex-col items-center">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                            <span className="text-sm text-blue-600">
                              Uploading {selectedFileName}...
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-sm text-gray-600">
                              Click or drag to upload image
                            </span>
                            <span className="text-xs text-gray-400 mt-1">
                              PNG, JPG, WebP up to 10MB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Preview uploaded image */
                    <div className="relative border rounded-lg overflow-hidden">
                      <div
                        className="aspect-video bg-gray-100 bg-cover bg-center"
                        style={{ backgroundImage: `url(${newMapImageUrl})` }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      <div className="p-2 bg-gray-50 border-t flex items-center gap-2 text-sm text-gray-600">
                        <ImageIcon className="w-4 h-4" />
                        <span className="truncate">
                          {selectedFileName || newMapImageUrl}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Upload Error */}
                  {uploadError && (
                    <p className="text-sm text-red-500 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {uploadError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || isUploading || !newMapImageUrl}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                    Create Map
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
