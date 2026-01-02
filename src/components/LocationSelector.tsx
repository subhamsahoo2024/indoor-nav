"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  MapPin,
  Navigation,
  ArrowRight,
  Loader2,
  AlertCircle,
  Building2,
  DoorOpen,
  Compass,
  Search,
  X,
  ChevronDown,
  QrCode,
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
  initialStartMapId?: string;
  initialStartNodeId?: string;
}

interface SearchOption {
  nodeId: string;
  mapId: string;
  nodeName: string;
  mapName: string;
  label: string; // Format: "Node Name (Map Name)"
  type: NodeType;
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
// Searchable Combobox Component
// ============================================================================

interface SearchableSelectProps {
  options: SearchOption[];
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  placeholder: string;
  label: string;
  icon: React.ReactNode;
  excludeNodeId?: string; // To prevent selecting same node as start/end
}

function SearchableSelect({
  options,
  value,
  onChange,
  placeholder,
  label,
  icon,
  excludeNodeId,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query and exclusion
  const filteredOptions = useMemo(() => {
    let filtered = options;

    // Exclude specified node
    if (excludeNodeId) {
      filtered = filtered.filter((opt) => opt.nodeId !== excludeNodeId);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (opt) =>
          opt.nodeName.toLowerCase().includes(query) ||
          opt.mapName.toLowerCase().includes(query) ||
          opt.label.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [options, searchQuery, excludeNodeId]);

  // Group options by map for better organization
  const groupedOptions = useMemo(() => {
    const groups: Record<string, SearchOption[]> = {};
    filteredOptions.forEach((opt) => {
      if (!groups[opt.mapName]) {
        groups[opt.mapName] = [];
      }
      groups[opt.mapName].push(opt);
    });
    return groups;
  }, [filteredOptions]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as globalThis.Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle option selection
  const handleSelect = useCallback(
    (option: SearchOption) => {
      onChange(option);
      setIsOpen(false);
      setSearchQuery("");
    },
    [onChange]
  );

  // Handle clear selection
  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange(null);
      setSearchQuery("");
    },
    [onChange]
  );

  // Handle input focus
  const handleInputClick = () => {
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
        {icon}
        {label}
      </label>

      <div ref={containerRef} className="relative">
        {/* Input/Display Field */}
        <div
          onClick={handleInputClick}
          className={`w-full px-4 py-3 border rounded-xl bg-gray-50 cursor-pointer transition-all flex items-center gap-2 ${
            isOpen
              ? "border-blue-500 ring-2 ring-blue-500 bg-white"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />

          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={placeholder}
              className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400"
              onClick={(e) => e.stopPropagation()}
            />
          ) : value ? (
            <div className="flex-1 flex items-center justify-between">
              <div className="truncate">
                <span className="text-gray-800 font-medium">
                  {value.nodeName}
                </span>
                <span className="text-gray-500 text-sm ml-2">
                  ({value.mapName})
                </span>
              </div>
            </div>
          ) : (
            <span className="flex-1 text-gray-400">{placeholder}</span>
          )}

          {value && !isOpen ? (
            <button
              onClick={handleClear}
              className="p-1 hover:bg-gray-200 rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          ) : (
            <ChevronDown
              className={`w-4 h-4 text-gray-400 transition-transform ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          )}
        </div>

        {/* Dropdown */}
        {isOpen && (
          <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-64 overflow-auto">
            {Object.keys(groupedOptions).length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No locations found</p>
                {searchQuery && (
                  <p className="text-xs mt-1">Try a different search term</p>
                )}
              </div>
            ) : (
              Object.entries(groupedOptions).map(([mapName, mapOptions]) => (
                <div key={mapName}>
                  {/* Map Name Header */}
                  <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      {mapName}
                    </span>
                  </div>

                  {/* Options */}
                  {mapOptions.map((option) => {
                    const Icon = getNodeIcon(option.type);
                    const isSelected = value?.nodeId === option.nodeId;

                    return (
                      <button
                        key={`${option.mapId}-${option.nodeId}`}
                        onClick={() => handleSelect(option)}
                        className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left ${
                          isSelected ? "bg-blue-50" : ""
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                            option.type === "ROOM"
                              ? "bg-blue-100 text-blue-600"
                              : option.type === "GATEWAY"
                              ? "bg-amber-100 text-amber-600"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">
                            {option.nodeName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {getNodeTypeLabel(option.type)}
                          </p>
                        </div>
                        {isSelected && (
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function LocationSelector({
  onStartNavigation,
  initialStartMapId,
  initialStartNodeId,
}: LocationSelectorProps) {
  // Data state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Flattened search options
  const [allOptions, setAllOptions] = useState<SearchOption[]>([]);

  // Selection state
  const [startLocation, setStartLocation] = useState<SearchOption | null>(null);
  const [endLocation, setEndLocation] = useState<SearchOption | null>(null);
  const [isStartLockedByQR, setIsStartLockedByQR] = useState(false);

  // Auto-set start location from URL parameters (QR Code)
  useEffect(() => {
    if (!initialStartMapId || !initialStartNodeId || allOptions.length === 0) {
      return;
    }

    // Find matching option
    const matchingOption = allOptions.find(
      (opt) =>
        opt.mapId === initialStartMapId && opt.nodeId === initialStartNodeId
    );

    if (matchingOption && !startLocation) {
      setStartLocation(matchingOption);
      setIsStartLockedByQR(true);
    }
  }, [initialStartMapId, initialStartNodeId, allOptions, startLocation]);

  // Fetch all maps and flatten to search options
  useEffect(() => {
    const fetchAndFlattenMaps = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get list of maps
        const listResponse = await fetch("/api/maps");
        const listResult = await listResponse.json();

        if (!listResult.success) {
          throw new Error(listResult.error || "Failed to fetch maps");
        }

        // Fetch full data for each map
        const allMaps: MapData[] = await Promise.all(
          listResult.data.map(async (mapMeta: { id: string; name: string }) => {
            const mapResponse = await fetch(`/api/maps/${mapMeta.id}`);
            const mapResult = await mapResponse.json();
            return mapResult.success ? mapResult.data : null;
          })
        );

        // Flatten to SearchOption array
        const options: SearchOption[] = [];

        allMaps
          .filter((m): m is MapData => m !== null && m.nodes?.length > 0)
          .forEach((map) => {
            map.nodes.forEach((node) => {
              options.push({
                nodeId: node.id,
                mapId: map.id,
                nodeName: node.name,
                mapName: map.name,
                label: `${node.name} (${map.name})`,
                type: node.type,
              });
            });
          });

        // Sort by name for better UX
        options.sort((a, b) => a.nodeName.localeCompare(b.nodeName));

        setAllOptions(options);
      } catch (err) {
        console.error("Failed to fetch maps:", err);
        setError(err instanceof Error ? err.message : "Failed to load maps");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndFlattenMaps();
  }, []);

  // Filter options for destination (exclude gateways for better UX)
  const destinationOptions = useMemo(() => {
    return allOptions.filter((opt) => opt.type !== "GATEWAY");
  }, [allOptions]);

  // Validation
  const isValid =
    startLocation && endLocation && startLocation.nodeId !== endLocation.nodeId;

  // Handle clearing QR-locked start location
  const handleClearStartLocation = useCallback(() => {
    setStartLocation(null);
    setIsStartLockedByQR(false);
  }, []);

  // Handle navigation start
  const handleStartNavigation = () => {
    if (isValid && startLocation && endLocation) {
      onStartNavigation(
        startLocation.mapId,
        startLocation.nodeId,
        endLocation.mapId,
        endLocation.nodeId
      );
    }
  };

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

  if (allOptions.length === 0) {
    return (
      <div className="w-full max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="flex flex-col items-center justify-center py-12">
            <MapPin className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-gray-600 font-medium mb-2">
              No locations available
            </p>
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
                Search for any location to get directions
              </p>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* QR Code Lock Banner */}
          {isStartLockedByQR && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 sm:p-4 flex items-start gap-3">
              <QrCode className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800">
                  Starting location set by QR Code
                </p>
                <p className="text-xs text-green-600 mt-1">
                  Scanned from:{" "}
                  <span className="font-semibold">
                    {startLocation?.nodeName}
                  </span>
                </p>
              </div>
              <button
                onClick={handleClearStartLocation}
                className="text-green-600 hover:text-green-800 transition-colors p-1 hover:bg-green-100 rounded"
                title="Clear QR location"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Start Location - Global Search */}
          <SearchableSelect
            options={allOptions}
            value={startLocation}
            onChange={(option) => {
              setStartLocation(option);
              if (option) {
                setIsStartLockedByQR(false);
              }
            }}
            placeholder="Search for starting point..."
            label="Starting Point"
            icon={
              <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-green-500" />
              </div>
            }
            excludeNodeId={endLocation?.nodeId}
          />

          {/* Direction Arrow */}
          <div className="flex justify-center">
            <div className="p-2 bg-gray-100 rounded-full">
              <ArrowRight className="w-5 h-5 text-gray-400 rotate-90" />
            </div>
          </div>

          {/* End Location - Global Search (excludes gateways) */}
          <SearchableSelect
            options={destinationOptions}
            value={endLocation}
            onChange={setEndLocation}
            placeholder="Search for destination..."
            label="Destination"
            icon={
              <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-red-500" />
              </div>
            }
            excludeNodeId={startLocation?.nodeId}
          />

          {/* Route Summary */}
          {startLocation && endLocation && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 sm:p-4">
              <p className="text-xs sm:text-sm text-blue-800">
                <span className="font-medium">Route: </span>
                <span className="text-green-600 font-medium">
                  {startLocation.nodeName}
                </span>
                {startLocation.mapId !== endLocation.mapId && (
                  <span className="text-gray-500">
                    {" "}
                    ({startLocation.mapName})
                  </span>
                )}
                <span className="mx-2">→</span>
                <span className="text-red-600 font-medium">
                  {endLocation.nodeName}
                </span>
                {startLocation.mapId !== endLocation.mapId && (
                  <span className="text-gray-500">
                    {" "}
                    ({endLocation.mapName})
                  </span>
                )}
              </p>
              {startLocation.mapId !== endLocation.mapId && (
                <p className="text-xs text-blue-600 mt-1">
                  Multi-building route - gateways will be used automatically
                </p>
              )}
            </div>
          )}

          {/* Same Node Warning */}
          {startLocation &&
            endLocation &&
            startLocation.nodeId === endLocation.nodeId && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
                <p className="text-xs sm:text-sm text-amber-800">
                  ⚠️ Start and destination cannot be the same location.
                </p>
              </div>
            )}

          {/* Start Button - Touch Friendly */}
          <button
            onClick={handleStartNavigation}
            disabled={!isValid}
            className="w-full py-4 min-h-[52px] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 text-white font-semibold text-base sm:text-lg rounded-xl shadow-lg shadow-blue-500/25 disabled:shadow-none transition-all flex items-center justify-center gap-3"
          >
            <Navigation className="w-5 h-5 sm:w-6 sm:h-6" />
            Start Navigation
          </button>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-4 sm:px-6 py-3 sm:py-4 border-t">
          <p className="text-xs text-gray-500 text-center">
            Tip: Just type a location name like &quot;Dean&apos;s Office&quot; -
            no need to select a building first!
          </p>
        </div>
      </div>
    </div>
  );
}
