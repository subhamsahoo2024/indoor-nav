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
  MapPin,
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="bg-white/5 backdrop-blur-sm border-b border-white/10 sticky top-0 z-50 animate-fadeInDown">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          {/* Back to Home Link */}
          <div className="mb-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-slate-300 hover:text-white hover:bg-white/5 px-4 py-2 rounded-lg transition-all duration-300 border border-white/10 hover:border-white/20"
            >
              <Home className="w-4 h-4" />
              <span className="text-sm font-medium">Back to Home</span>
            </Link>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Map className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Map Admin Dashboard
                </h1>
                <p className="text-sm text-slate-400">
                  Manage indoor navigation maps
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create New Map
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8 relative z-10">
        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20 animate-fadeInUp">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin mx-auto mb-4" />
              <span className="text-slate-300">Loading maps...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isLoading && (
          <div className="bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-4 flex items-center gap-3 animate-slideInDown">
            <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-red-200 font-medium">Error loading maps</p>
              <p className="text-red-300/80 text-sm">{error}</p>
            </div>
            <button
              onClick={fetchMaps}
              className="px-4 py-2 bg-red-500/30 text-red-200 rounded-lg hover:bg-red-500/40 transition-all duration-300 font-medium flex-shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && maps.length === 0 && (
          <div className="text-center py-20 animate-fadeInUp">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
              <Map className="w-10 h-10 text-slate-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">No maps yet</h2>
            <p className="text-slate-400 mb-8">
              Create your first map to get started with indoor navigation
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 font-semibold"
            >
              <Plus className="w-5 h-5" />
              Create New Map
            </button>
          </div>
        )}

        {/* Map Grid */}
        {!isLoading && !error && maps.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {maps.map((map, index) => (
              <Link href={`/admin/map/${map.id}`} key={map.id}>
                <div
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:border-white/20 hover:bg-white/10 hover:scale-105 hover:shadow-2xl hover:shadow-blue-500/20 animate-fadeInUp text-black"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Glow Effect */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-cyan-500/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Map Image */}
                  <div className="relative aspect-video bg-gray-900 border-b border-white/5">
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{
                        backgroundImage: map.imageUrl
                          ? `url(${map.imageUrl})`
                          : undefined,
                      }}
                    >
                      {!map.imageUrl && (
                        <div className="flex items-center justify-center h-full">
                          <Map className="w-8 h-8 text-slate-500" />
                        </div>
                      )}
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteMap(map.id, map.name);
                      }}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-600 hover:scale-110"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Map Info */}
                  <div className="p-4 relative z-10">
                    <h3 className="font-semibold text-white group-hover:text-cyan-400 transition-colors mb-1">
                      {map.name}
                    </h3>
                    <p className="text-white/70">ID: {map.id}</p>
                    <div className="flex items-center gap-4 text-xs text-white/70">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {(map as MapData & { nodes?: unknown[] }).nodes
                          ?.length ?? 0}{" "}
                        nodes
                      </span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Create Map Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeInUp">
          <div className="bg-gradient-to-b from-blue-500/20 to-blue-500/10 backdrop-blur-md border border-white/20 rounded-3xl shadow-2xl w-full max-w-md animate-scaleIn">
            <div className="p-8">
              <h2 className="text-2xl font-bold text-white mb-6">
                Create New Map
              </h2>

              <form onSubmit={handleCreateMap} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Map ID
                  </label>
                  <input
                    type="text"
                    value={newMapId}
                    onChange={(e) => setNewMapId(e.target.value)}
                    placeholder="e.g., campus_main"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-white placeholder:text-slate-500 transition-all duration-300"
                    required
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    Unique identifier (lowercase, underscores)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
                    Map Name
                  </label>
                  <input
                    type="text"
                    value={newMapName}
                    onChange={(e) => setNewMapName(e.target.value)}
                    placeholder="e.g., Campus Main"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 text-white placeholder:text-slate-500 transition-all duration-300"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-200 mb-2">
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
                        className={`border-2 border-dashed rounded-xl p-6 text-center transition-all duration-300 ${
                          isUploading
                            ? "border-cyan-400 bg-cyan-500/10"
                            : "border-white/20 hover:border-cyan-400 hover:bg-cyan-500/5"
                        }`}
                      >
                        {isUploading ? (
                          <div className="flex flex-col items-center">
                            <div className="w-8 h-8 rounded-full border-2 border-transparent border-t-cyan-400 animate-spin mb-2" />
                            <span className="text-sm text-cyan-300">
                              Uploading {selectedFileName}...
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center">
                            <Upload className="w-8 h-8 text-slate-400 mb-2" />
                            <span className="text-sm text-slate-300">
                              Click or drag to upload image
                            </span>
                            <span className="text-xs text-slate-500 mt-1">
                              PNG, JPG, WebP up to 10MB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Preview uploaded image */
                    <div className="relative border border-white/10 rounded-xl overflow-hidden">
                      <div
                        className="aspect-video bg-gray-900 bg-cover bg-center"
                        style={{ backgroundImage: `url(${newMapImageUrl})` }}
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button
                          type="button"
                          onClick={handleClearFile}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-300 font-medium"
                        >
                          <X className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                      <div className="p-3 bg-white/5 border-t border-white/10 flex items-center gap-2 text-sm text-slate-400">
                        <ImageIcon className="w-4 h-4" />
                        <span className="truncate">
                          {selectedFileName || newMapImageUrl}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Upload Error */}
                  {uploadError && (
                    <p className="text-sm text-red-400 mt-2 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {uploadError}
                    </p>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsModalOpen(false);
                      resetForm();
                    }}
                    className="flex-1 px-4 py-3 border border-white/20 text-slate-300 rounded-xl hover:bg-white/5 hover:border-white/30 transition-all duration-300 font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating || isUploading || !newMapImageUrl}
                    className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-lg hover:shadow-blue-500/50 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
                  >
                    {isCreating && (
                      <div className="w-4 h-4 rounded-full border-2 border-transparent border-t-white animate-spin" />
                    )}
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
