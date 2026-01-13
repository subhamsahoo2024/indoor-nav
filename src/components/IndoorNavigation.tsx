"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  ChevronRight,
  Navigation,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  LogIn,
  Loader2,
  Move,
  GripHorizontal,
} from "lucide-react";
import type { MapData, Node } from "@/types/navigation";
import type { NavigationResult } from "@/lib/pathfinder";
import { generateNavigationPath } from "@/lib/pathfinder";
import { getMap } from "@/lib/mapService";
import {
  useImageDimensions,
  type PixelCoordinate,
  calculatePathLength,
  getPointAtProgress,
  calculateAngle,
} from "@/hooks/useImageDimensions";

// Types

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
        <>
          <circle
            cx={pixelCoord.x}
            cy={pixelCoord.y}
            r={nodeSize + 4}
            fill="none"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="4 2"
          />
          {/* Gateway pictogram to match admin orange marker */}
          <path
            d={`M ${pixelCoord.x - 5} ${pixelCoord.y - 6} h10 v12 h-10 z`}
            fill="#fcd34d"
            stroke="#d97706"
            strokeWidth={1.2}
          />
          <rect
            x={pixelCoord.x - 1}
            y={pixelCoord.y}
            width={2}
            height={3}
            rx={0.5}
            fill="#92400e"
          />
        </>
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
  const mapContainerRef = useRef<HTMLDivElement>(null);

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

  // Playback control state
  const [isPaused, setIsPaused] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1); // 1x or 2x
  const pausedProgressRef = useRef(0); // Store progress when paused
  const startTimeRef = useRef<number | null>(null);
  const baseDurationRef = useRef(0);

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

  // Auto-scroll to follow walker position
  useEffect(() => {
    if (!mapContainerRef.current || !containerRef.current || !isReady) {
      return;
    }

    if (status !== "NAVIGATING" || pathPixelCoords.length < 2) {
      return;
    }

    const walkerPos = getPointAtProgress(pathPixelCoords, progress);
    const scrollContainer = mapContainerRef.current;

    const walkerAbsoluteX = imageBounds.offsetX + walkerPos.x;
    const walkerAbsoluteY = imageBounds.offsetY + walkerPos.y;

    const viewportWidth = scrollContainer.clientWidth;
    const viewportHeight = scrollContainer.clientHeight;

    const targetScrollX = walkerAbsoluteX - viewportWidth / 2;
    const targetScrollY = walkerAbsoluteY - viewportHeight / 2;

    scrollContainer.scrollLeft = Math.max(0, targetScrollX);
    scrollContainer.scrollTop = Math.max(0, targetScrollY);
  }, [progress, status, isReady, pathPixelCoords, imageBounds]);

  // Animation loop
  useEffect(() => {
    if (
      status !== "NAVIGATING" ||
      !isReady ||
      pathPixelCoords.length < 2 ||
      isPaused
    ) {
      return;
    }

    setIsAnimating(true);
    const pathLength = calculatePathLength(pathPixelCoords);
    const baseDuration = pathLength / 100; // pixels per second
    baseDurationRef.current = baseDuration;
    const duration = baseDuration / (animationSpeed * speedMultiplier);

    // Calculate remaining duration based on paused progress
    const startProgress = pausedProgressRef.current;
    const remainingDuration = duration * (1 - startProgress);

    let startTime: number | null = null;

    function animate(timestamp: number) {
      if (startTime === null) startTime = timestamp;
      const elapsed = (timestamp - startTime) / 1000;

      // Calculate new progress from where we left off
      const progressDelta = (elapsed / remainingDuration) * (1 - startProgress);
      const newProgress = Math.min(startProgress + progressDelta, 1);

      setProgress(newProgress);
      pausedProgressRef.current = newProgress;

      if (newProgress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete - check for gateway
        setIsAnimating(false);
        pausedProgressRef.current = 0;
        handleSegmentComplete();
      }
    }

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [
    status,
    isReady,
    pathPixelCoords,
    animationSpeed,
    speedMultiplier,
    isPaused,
  ]);

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
    pausedProgressRef.current = 0;
    setIsPaused(false);
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

  // Playback controls
  const handlePlayPause = useCallback(() => {
    if (isPaused) {
      // Resume - animation will restart from pausedProgressRef
      setIsPaused(false);
    } else {
      // Pause - store current progress
      pausedProgressRef.current = progress;
      setIsPaused(true);
      setIsAnimating(false);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    }
  }, [isPaused, progress]);

  const handleRestartSegment = useCallback(() => {
    // Restart current segment from beginning without leaving the map
    setProgress(0);
    pausedProgressRef.current = 0;
    setIsPaused(false);
    setIsAnimating(false);
    setStatus("NAVIGATING");
  }, []);

  const handleToggleSpeed = useCallback(() => {
    setSpeedMultiplier((prev) => (prev === 1 ? 2 : 1));
  }, []);

  // ============================================================================
  // Render
  // ============================================================================

  // Get current instruction text based on status and progress
  const currentInstruction = useMemo(() => {
    if (status === "LOADING") return "Loading navigation...";
    if (status === "ERROR") return errorMessage ?? "Navigation error";
    if (status === "COMPLETED") {
      const destNode = pathNodes[pathNodes.length - 1];
      return `Arrived at ${destNode?.name ?? "destination"}`;
    }
    if (status === "WAITING_AT_GATEWAY") {
      const gatewayNode = pathNodes[pathNodes.length - 1];
      return `At ${gatewayNode?.name ?? "Gateway"} - Ready to continue`;
    }
    if (status === "NAVIGATING") {
      if (pathNodes.length === 0) return "Preparing route...";
      const currentNodeIndex = Math.min(
        Math.floor(progress * (pathNodes.length - 1)),
        pathNodes.length - 1
      );
      const nextNodeIndex = Math.min(
        currentNodeIndex + 1,
        pathNodes.length - 1
      );
      const nextNode = pathNodes[nextNodeIndex];
      if (progress >= 0.95) {
        return `Arriving at ${nextNode?.name ?? "destination"}`;
      }
      return `Walk towards ${nextNode?.name ?? "next point"}`;
    }
    return "Ready to navigate";
  }, [status, progress, pathNodes, errorMessage]);

  // Only render overlay for LOADING state (minimal, non-blocking)
  const renderOverlay = () => {
    if (status === "LOADING") {
      return (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg z-30">
          <div className="bg-white rounded-xl p-4 shadow-xl flex items-center gap-3">
            <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
            <span className="text-gray-700 font-medium">Loading...</span>
          </div>
        </div>
      );
    }
    return null;
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
      {/* Top Status Bar - Compact for Mobile */}
      <div className="bg-white/95 backdrop-blur-md border-b shadow-sm z-10">
        {/* Main Bar */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Status Icon + Instruction */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            {/* Status Icon */}
            <div
              className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                status === "COMPLETED"
                  ? "bg-green-100"
                  : status === "ERROR"
                  ? "bg-red-100"
                  : status === "WAITING_AT_GATEWAY"
                  ? "bg-amber-100"
                  : status === "LOADING"
                  ? "bg-gray-100"
                  : "bg-blue-100"
              }`}
            >
              {status === "COMPLETED" ? (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              ) : status === "ERROR" ? (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              ) : status === "WAITING_AT_GATEWAY" ? (
                <LogIn className="w-5 h-5 text-amber-600" />
              ) : status === "LOADING" ? (
                <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
              ) : (
                <Navigation className="w-5 h-5 text-blue-600" />
              )}
            </div>

            {/* Instruction Text */}
            <div className="min-w-0 flex-1">
              <p className="text-sm sm:text-base font-semibold text-gray-800 truncate">
                {currentInstruction}
              </p>
              <p className="text-xs sm:text-sm text-gray-500">
                {currentMapData?.name ?? "Indoor Navigation"}
                {navigationResult && navigationResult.totalMaps > 1 && (
                  <span className="ml-2">
                    • Map {currentSegmentIndex + 1}/{navigationResult.totalMaps}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Right: Action Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Gateway: Continue Button */}
            {status === "WAITING_AT_GATEWAY" && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleContinueToNextMap}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors shadow-lg shadow-blue-500/30"
              >
                <LogIn className="w-4 h-4" />
                <span>
                  Enter{" "}
                  {navigationResult?.segments[currentSegmentIndex + 1]?.mapId ??
                    "Next"}
                </span>
              </motion.button>
            )}

            {/* Completed: Restart Button */}
            {status === "COMPLETED" && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                onClick={handleRestart}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restart</span>
              </motion.button>
            )}

            {/* Status Badge - Hidden on small screens */}
            <span
              className={`hidden sm:inline-block px-3 py-1 rounded-full text-xs font-medium ${
                status === "NAVIGATING"
                  ? "bg-blue-100 text-blue-700"
                  : status === "COMPLETED"
                  ? "bg-green-100 text-green-700"
                  : status === "ERROR"
                  ? "bg-red-100 text-red-700"
                  : status === "WAITING_AT_GATEWAY"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {status === "WAITING_AT_GATEWAY" ? "AT GATEWAY" : status}
            </span>
          </div>
        </div>

        {/* Progress Bar (integrated into status bar) */}
        {(status === "NAVIGATING" ||
          status === "WAITING_AT_GATEWAY" ||
          status === "COMPLETED") && (
          <div className="h-1 bg-gray-100">
            <motion.div
              className={`h-full ${
                status === "COMPLETED"
                  ? "bg-green-500"
                  : status === "WAITING_AT_GATEWAY"
                  ? "bg-amber-500"
                  : "bg-blue-500"
              }`}
              style={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>
        )}
      </div>

      {/* Map Container - Native Scrollable Viewport */}
      <div
        ref={mapContainerRef}
        className="flex-1 overflow-auto bg-gray-200 relative"
        style={{
          WebkitOverflowScrolling: "touch", // Smooth scrolling on iOS
        }}
      >
        {/* Scroll Hint - Shows for 3 seconds on mount */}
        <AnimatePresence>
          {status === "NAVIGATING" && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
              onAnimationComplete={() => {
                // Auto-hide after 3 seconds
                setTimeout(() => {
                  const element = document.querySelector("[data-scroll-hint]");
                  if (element) {
                    element.remove();
                  }
                }, 3000);
              }}
            >
              <div
                data-scroll-hint
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/90 text-white text-sm font-medium rounded-full shadow-lg backdrop-blur-sm"
              >
                <Move className="w-4 h-4" />
                <span>Scroll to Pan</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Large Content Wrapper - Forces Scroll on Mobile */}
        <div
          ref={containerRef}
          className="relative bg-gradient-to-br from-slate-200 to-slate-300"
          style={{
            // Large minimum dimensions to trigger scrolling on mobile
            minWidth: "1200px",
            minHeight: "800px",
            width: Math.max(imageBounds.containerWidth || 1200, 1200),
            height: Math.max(imageBounds.containerHeight || 800, 800),
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
                const normalizedType =
                  typeof node.type === "string" ? node.type.toLowerCase() : "";
                const isGatewayType = normalizedType === "gateway";
                const isPortalType = normalizedType === "portal";
                const startNodeId = currentSegment?.pathNodeIds?.[0];
                const endNodeId =
                  currentSegment?.pathNodeIds?.[
                    (currentSegment?.pathNodeIds?.length ?? 1) - 1
                  ];
                const isSegmentStart = node.id === startNodeId;
                const isSegmentEnd = node.id === endNodeId;
                const isStart = isSegmentStart && currentSegmentIndex === 0;
                const isEnd =
                  isSegmentEnd &&
                  currentSegmentIndex ===
                    (navigationResult?.segments.length ?? 1) - 1;
                const shouldShowLabel =
                  showLabels &&
                  (isSegmentStart ||
                    isSegmentEnd ||
                    isGatewayType ||
                    isPortalType);

                return (
                  <MapNode
                    key={node.id}
                    node={node}
                    pixelCoord={pixelCoord}
                    isOnPath={isOnPath}
                    isStart={isStart}
                    isEnd={isEnd}
                    isGateway={isGatewayType || isPortalType}
                    showLabel={shouldShowLabel}
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

          {/* Overlay UI (only for loading) */}
          <AnimatePresence>{renderOverlay()}</AnimatePresence>
        </div>

        {/* Draggable Floating Control Pill */}
        {(status === "NAVIGATING" || status === "WAITING_AT_GATEWAY") && (
          <motion.div
            drag
            dragMomentum={false}
            dragConstraints={{
              top: -window.innerHeight / 2 + 80,
              bottom: window.innerHeight / 2 - 80,
              left: -window.innerWidth / 2 + 150,
              right: window.innerWidth / 2 - 150,
            }}
            dragElastic={0}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            whileDrag={{ scale: 1.05, cursor: "grabbing" }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-auto cursor-grab"
            style={{ touchAction: "none" }}
          >
            <div className="flex items-center gap-3 px-4 py-3 bg-white/95 backdrop-blur-sm rounded-full shadow-2xl border border-gray-200">
              {/* Drag Handle */}
              <div className="flex items-center justify-center text-gray-400 cursor-grab active:cursor-grabbing">
                <GripHorizontal className="w-5 h-5" />
              </div>

              {/* Restart Button - Touch Friendly */}
              <button
                onClick={handleRestartSegment}
                className="p-3 min-h-[44px] min-w-[44px] rounded-xl hover:bg-gray-100 text-gray-600 hover:text-gray-800 transition-colors flex items-center justify-center"
                title="Restart segment"
              >
                <RotateCcw className="w-5 h-5" />
              </button>

              {/* Play/Pause Button - Large and Center */}
              <button
                onClick={handlePlayPause}
                className={`p-4 min-h-[56px] min-w-[56px] rounded-2xl transition-all flex items-center justify-center ${
                  isPaused
                    ? "bg-blue-500 text-white hover:bg-blue-600 shadow-lg shadow-blue-500/30"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={isPaused ? "Play" : "Pause"}
              >
                {isPaused ? (
                  <Play className="w-6 h-6" fill="currentColor" />
                ) : (
                  <Pause className="w-6 h-6" fill="currentColor" />
                )}
              </button>

              {/* Speed Toggle Button - Touch Friendly */}
              <button
                onClick={handleToggleSpeed}
                className={`flex items-center gap-1 px-4 py-3 min-h-[44px] rounded-xl text-sm font-semibold transition-all ${
                  speedMultiplier === 2
                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="Toggle speed"
              >
                <Gauge className="w-4 h-4" />
                <span>{speedMultiplier}x</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
