"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, useAnimation, AnimatePresence } from "framer-motion";
import type { MapData, Node } from "@/types/navigation";
import type { NavigationSegment, NavigationResult } from "@/lib/pathfinder";
import { generateNavigationPath } from "@/lib/pathfinder";
import { getMap } from "@/lib/mapService";
import {
  useImageDimensions,
  type PixelCoordinate,
  calculatePathLength,
  getPointAtProgress,
  calculateAngle,
} from "@/hooks/useImageDimensions";

// ============================================================================
// Types
// ============================================================================

export type NavigationStatus =
  | "IDLE"
  | "LOADING"
  | "NAVIGATING"
  | "WAITING_AT_GATEWAY"
  | "COMPLETED"
  | "ERROR";

export interface IndoorNavigationProps {
  /** Starting map ID */
  startMapId: string;
  /** Starting node ID on the start map */
  startNodeId: string;
  /** Destination map ID */
  endMapId: string;
  /** Destination node ID on the end map */
  endNodeId: string;
  /** Animation speed multiplier (default: 1) */
  animationSpeed?: number;
  /** Whether to show node labels */
  showLabels?: boolean;
  /** Whether to show all nodes or just path nodes */
  showAllNodes?: boolean;
  /** Callback when navigation completes */
  onComplete?: () => void;
  /** Callback when an error occurs */
  onError?: (error: string) => void;
}

// ============================================================================
// Sub-Components
// ============================================================================

interface MapNodeProps {
  node: Node;
  pixelCoord: PixelCoordinate;
  isOnPath: boolean;
  isStart: boolean;
  isEnd: boolean;
  isGateway: boolean;
  showLabel: boolean;
}

function MapNode({
  node,
  pixelCoord,
  isOnPath,
  isStart,
  isEnd,
  isGateway,
  showLabel,
}: MapNodeProps) {
  const getNodeColor = () => {
    if (isStart) return "#22c55e"; // green-500
    if (isEnd) return "#ef4444"; // red-500
    if (isGateway) return "#f59e0b"; // amber-500
    if (isOnPath) return "#3b82f6"; // blue-500
    return "#6b7280"; // gray-500
  };

  const nodeSize = isStart || isEnd ? 12 : isGateway ? 10 : 8;

  return (
    <g>
      {/* Node circle */}
      <circle
        cx={pixelCoord.x}
        cy={pixelCoord.y}
        r={nodeSize}
        fill={getNodeColor()}
        stroke="white"
        strokeWidth={2}
        className="drop-shadow-md"
      />

      {/* Gateway indicator (double ring) */}
      {isGateway && (
        <circle
          cx={pixelCoord.x}
          cy={pixelCoord.y}
          r={nodeSize + 4}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="4 2"
        />
      )}

      {/* Label */}
      {showLabel && (
        <text
          x={pixelCoord.x}
          y={pixelCoord.y - nodeSize - 8}
          textAnchor="middle"
          className="fill-gray-800 text-xs font-medium"
          style={{ fontSize: "11px" }}
        >
          {node.name}
        </text>
      )}
    </g>
  );
}

interface PathLineProps {
  points: PixelCoordinate[];
  isActive: boolean;
}

function PathLine({ points, isActive }: PathLineProps) {
  if (points.length < 2) return null;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <g>
      {/* Background path (wider, for visibility) */}
      <path
        d={pathD}
        fill="none"
        stroke="white"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Main path */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={isActive ? "#3b82f6" : "#9ca3af"}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </g>
  );
}

interface GhostWalkerProps {
  position: PixelCoordinate;
  angle: number;
  isMoving: boolean;
}

function GhostWalker({ position, angle, isMoving }: GhostWalkerProps) {
  return (
    <motion.g
      initial={{ scale: 0 }}
      animate={{
        scale: 1,
        x: position.x,
        y: position.y,
        rotate: angle,
      }}
      transition={{
        x: { type: "tween", duration: 0.1 },
        y: { type: "tween", duration: 0.1 },
        rotate: { type: "spring", stiffness: 100 },
        scale: { type: "spring", stiffness: 200 },
      }}
    >
      {/* Glow effect */}
      <circle
        cx={0}
        cy={0}
        r={20}
        fill="url(#walkerGlow)"
        opacity={isMoving ? 0.6 : 0.3}
      />

      {/* Arrow body */}
      <polygon
        points="-8,-6 12,0 -8,6 -4,0"
        fill="#3b82f6"
        stroke="white"
        strokeWidth={2}
      />

      {/* Pulse animation when stopped */}
      {!isMoving && (
        <motion.circle
          cx={0}
          cy={0}
          r={16}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.5, opacity: 0 }}
          transition={{ duration: 1, repeat: Infinity }}
        />
      )}
    </motion.g>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function IndoorNavigation({
  startMapId,
  startNodeId,
  endMapId,
  endNodeId,
  animationSpeed = 1,
  showLabels = true,
  showAllNodes = false,
  onComplete,
  onError,
}: IndoorNavigationProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Navigation state
  const [navigationResult, setNavigationResult] =
    useState<NavigationResult | null>(null);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
  const [status, setStatus] = useState<NavigationStatus>("IDLE");
  const [currentMapData, setCurrentMapData] = useState<MapData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Animation state
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);

  // Use the new image dimensions hook - calculates ACTUAL rendered image size
  // This fixes the "drifting coordinates" bug when image aspect ratio differs from container
  const { imageBounds, isReady, toPixels } = useImageDimensions(
    containerRef,
    currentMapData?.imageUrl,
    "top-left" // Our background-position is top-left
  );

  // Current segment
  const currentSegment = useMemo(() => {
    if (!navigationResult?.segments) return null;
    return navigationResult.segments[currentSegmentIndex] ?? null;
  }, [navigationResult, currentSegmentIndex]);

  // Path nodes for current segment
  const pathNodes = useMemo(() => {
    if (!currentMapData || !currentSegment) return [];
    const nodeMap = new Map(currentMapData.nodes.map((n) => [n.id, n]));
    return currentSegment.pathNodeIds
      .map((id) => nodeMap.get(id))
      .filter((n): n is Node => n !== undefined);
  }, [currentMapData, currentSegment]);

  // Helper: Convert percentage to SVG-local coordinates (not container-relative)
  // Since our SVG viewBox matches the rendered image size, we convert directly
  const toSvgCoords = useCallback(
    (percentX: number, percentY: number): PixelCoordinate => {
      return {
        x: (percentX / 100) * imageBounds.width,
        y: (percentY / 100) * imageBounds.height,
      };
    },
    [imageBounds.width, imageBounds.height]
  );

  // Path pixel coordinates (relative to SVG viewBox)
  const pathPixelCoords = useMemo(() => {
    if (!isReady || imageBounds.width === 0) return [];
    return pathNodes.map((node) => toSvgCoords(node.x, node.y));
  }, [pathNodes, toSvgCoords, isReady, imageBounds.width]);

  // Walker position and angle
  const walkerPosition = useMemo(() => {
    return getPointAtProgress(pathPixelCoords, progress);
  }, [pathPixelCoords, progress]);

  const walkerAngle = useMemo(() => {
    if (pathPixelCoords.length < 2) return 0;
    const idx = Math.min(
      Math.floor(progress * (pathPixelCoords.length - 1)),
      pathPixelCoords.length - 2
    );
    return calculateAngle(pathPixelCoords[idx], pathPixelCoords[idx + 1]);
  }, [pathPixelCoords, progress]);

  // ============================================================================
  // Effects
  // ============================================================================

  // Initialize navigation on mount or prop change
  useEffect(() => {
    let cancelled = false;

    async function initNavigation() {
      setStatus("LOADING");
      setErrorMessage(null);
      setCurrentSegmentIndex(0);
      setProgress(0);

      try {
        const result = await generateNavigationPath(
          startMapId,
          startNodeId,
          endMapId,
          endNodeId
        );

        if (cancelled) return;

        if (!result.success) {
          setStatus("ERROR");
          setErrorMessage(result.error ?? "Navigation failed");
          onError?.(result.error ?? "Navigation failed");
          return;
        }

        setNavigationResult(result);

        // Load first map
        if (result.segments.length > 0) {
          const firstMap = await getMap(result.segments[0].mapId);
          if (cancelled) return;

          if (firstMap) {
            setCurrentMapData(firstMap);
            setStatus("NAVIGATING");
          } else {
            setStatus("ERROR");
            setErrorMessage("Failed to load map");
          }
        }
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        setStatus("ERROR");
        setErrorMessage(message);
        onError?.(message);
      }
    }

    initNavigation();

    return () => {
      cancelled = true;
    };
  }, [startMapId, startNodeId, endMapId, endNodeId, onError]);

  // Animation loop
  useEffect(() => {
    if (status !== "NAVIGATING" || !isReady || pathPixelCoords.length < 2) {
      return;
    }

    setIsAnimating(true);
    const pathLength = calculatePathLength(pathPixelCoords);
    const baseDuration = pathLength / 100; // pixels per second
    const duration = baseDuration / animationSpeed;

    let startTime: number | null = null;

    function animate(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;
      const newProgress = Math.min(elapsed / duration, 1);

      setProgress(newProgress);

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - check for gateway
        setIsAnimating(false);
        handleSegmentComplete();
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [status, isReady, pathPixelCoords, animationSpeed]);

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleSegmentComplete = useCallback(() => {
    if (!navigationResult || !currentSegment) return;

    const isLastSegment =
      currentSegmentIndex === navigationResult.segments.length - 1;

    if (isLastSegment) {
      setStatus("COMPLETED");
      onComplete?.();
    } else if (currentSegment.transitionTarget) {
      setStatus("WAITING_AT_GATEWAY");
    }
  }, [navigationResult, currentSegment, currentSegmentIndex, onComplete]);

  const handleContinueToNextMap = useCallback(async () => {
    if (!navigationResult || !currentSegment?.transitionTarget) return;

    const nextIndex = currentSegmentIndex + 1;
    const nextSegment = navigationResult.segments[nextIndex];

    if (!nextSegment) return;

    setStatus("LOADING");

    try {
      const nextMap = await getMap(nextSegment.mapId);
      if (nextMap) {
        setCurrentMapData(nextMap);
        setCurrentSegmentIndex(nextIndex);
        setProgress(0);
        setStatus("NAVIGATING");
      } else {
        setStatus("ERROR");
        setErrorMessage("Failed to load next map");
      }
    } catch {
      setStatus("ERROR");
      setErrorMessage("Failed to load next map");
    }
  }, [navigationResult, currentSegment, currentSegmentIndex]);

  const handleRestart = useCallback(() => {
    setCurrentSegmentIndex(0);
    setProgress(0);
    setStatus("LOADING");

    // Reload first map
    if (navigationResult?.segments[0]) {
      getMap(navigationResult.segments[0].mapId).then((map) => {
        if (map) {
          setCurrentMapData(map);
          setStatus("NAVIGATING");
        }
      });
    }
  }, [navigationResult]);

  // ============================================================================
  // Render
  // ============================================================================

  const renderOverlay = () => {
    switch (status) {
      case "LOADING":
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
            <div className="bg-white rounded-xl p-6 shadow-xl flex items-center gap-4">
              <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-700 font-medium">
                Loading navigation...
              </span>
            </div>
          </div>
        );

      case "ERROR":
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
            <div className="bg-white rounded-xl p-6 shadow-xl max-w-sm">
              <div className="flex items-center gap-3 text-red-600 mb-4">
                <svg
                  className="w-8 h-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span className="font-semibold">Navigation Error</span>
              </div>
              <p className="text-gray-600 mb-4">{errorMessage}</p>
            </div>
          </div>
        );

      case "WAITING_AT_GATEWAY":
        const nextMapName =
          navigationResult?.segments[currentSegmentIndex + 1]?.mapId ?? "Next";
        const gatewayNode = pathNodes[pathNodes.length - 1];
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-xl p-6 shadow-xl max-w-sm text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-amber-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 9l3 3m0 0l-3 3m3-3H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Arrived at {gatewayNode?.name ?? "Gateway"}
              </h3>
              <p className="text-gray-600 mb-4">
                Continue to the next area to proceed with navigation.
              </p>
              <button
                onClick={handleContinueToNextMap}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
              >
                Continue to {nextMapName}
              </button>
            </motion.div>
          </div>
        );

      case "COMPLETED":
        const destNode = pathNodes[pathNodes.length - 1];
        return (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-sm rounded-lg">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-xl p-6 shadow-xl max-w-sm text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                Destination Reached!
              </h3>
              <p className="text-gray-600 mb-4">
                You have arrived at{" "}
                <span className="font-medium">
                  {destNode?.name ?? "your destination"}
                </span>
                .
              </p>
              <button
                onClick={handleRestart}
                className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                Restart Navigation
              </button>
            </motion.div>
          </div>
        );

      default:
        return null;
    }
  };

  // Determine which nodes to show
  const nodesToRender = useMemo(() => {
    if (!currentMapData) return [];
    if (showAllNodes) return currentMapData.nodes;
    return pathNodes;
  }, [currentMapData, showAllNodes, pathNodes]);

  const pathNodeIdSet = useMemo(() => {
    return new Set(currentSegment?.pathNodeIds ?? []);
  }, [currentSegment]);

  return (
    <div className="w-full h-full flex flex-col bg-gray-100 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-800">
            {currentMapData?.name ?? "Indoor Navigation"}
          </h2>
          {navigationResult && (
            <p className="text-sm text-gray-500">
              Map {currentSegmentIndex + 1} of {navigationResult.totalMaps}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              status === "NAVIGATING"
                ? "bg-blue-100 text-blue-700"
                : status === "COMPLETED"
                ? "bg-green-100 text-green-700"
                : status === "ERROR"
                ? "bg-red-100 text-red-700"
                : "bg-gray-100 text-gray-700"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Map Container - Scrollable */}
      <div className="flex-1 overflow-auto bg-gray-200">
        <div
          ref={containerRef}
          className="relative bg-gradient-to-br from-slate-200 to-slate-300"
          style={{
            // Use container dimensions from imageBounds for proper sizing
            minWidth: Math.max(imageBounds.containerWidth || 800, 800),
            minHeight: Math.max(imageBounds.containerHeight || 600, 600),
            width: imageBounds.containerWidth || "100%",
            height: imageBounds.containerHeight || "100%",
            backgroundImage: currentMapData?.imageUrl
              ? `url(${currentMapData.imageUrl})`
              : undefined,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left",
          }}
        >
          {/* SVG Overlay - positioned and sized to match ACTUAL rendered image */}
          {isReady && (
            <svg
              className="absolute pointer-events-none"
              style={{
                // Position overlay exactly where the image is rendered
                left: imageBounds.offsetX,
                top: imageBounds.offsetY,
                width: imageBounds.width,
                height: imageBounds.height,
              }}
              viewBox={`0 0 ${imageBounds.width} ${imageBounds.height}`}
              preserveAspectRatio="none"
            >
              {/* Defs for gradients */}
              <defs>
                <radialGradient id="walkerGlow">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Path line */}
              {pathPixelCoords.length >= 2 && (
                <PathLine points={pathPixelCoords} isActive={isAnimating} />
              )}

              {/* Nodes */}
              {nodesToRender.map((node) => {
                // Use toSvgCoords for SVG-local coordinates
                const pixelCoord = toSvgCoords(node.x, node.y);
                const isOnPath = pathNodeIdSet.has(node.id);
                const isStart =
                  currentSegmentIndex === 0 &&
                  node.id === currentSegment?.pathNodeIds[0];
                const isEnd =
                  currentSegmentIndex ===
                    (navigationResult?.segments.length ?? 1) - 1 &&
                  node.id ===
                    currentSegment?.pathNodeIds[
                      currentSegment.pathNodeIds.length - 1
                    ];

                return (
                  <MapNode
                    key={node.id}
                    node={node}
                    pixelCoord={pixelCoord}
                    isOnPath={isOnPath}
                    isStart={isStart}
                    isEnd={isEnd}
                    isGateway={node.type === "GATEWAY"}
                    showLabel={showLabels && isOnPath}
                  />
                );
              })}

              {/* Ghost Walker */}
              {pathPixelCoords.length > 0 && status === "NAVIGATING" && (
                <GhostWalker
                  position={walkerPosition}
                  angle={walkerAngle}
                  isMoving={isAnimating}
                />
              )}
            </svg>
          )}

          {/* Overlay UI */}
          <AnimatePresence>{renderOverlay()}</AnimatePresence>
        </div>
      </div>

      {/* Progress indicator */}
      {status === "NAVIGATING" && (
        <div className="bg-white border-t px-4 py-2">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Progress:</span>
            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-blue-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700">
              {Math.round(progress * 100)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
