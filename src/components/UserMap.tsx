"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TransformWrapper,
  TransformComponent,
  useControls,
} from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize2, Navigation } from "lucide-react";
import type { MapData, Node } from "@/types/navigation";
import {
  useImageDimensions,
  type PixelCoordinate,
} from "@/hooks/useImageDimensions";
import { getMapImageSrc } from "@/lib/imageUtils";

// ============================================================================
// Types
// ============================================================================

export interface UserMapProps {
  /** The map data to display */
  mapData: MapData | null;
  /** The currently active node (walker position) - triggers auto-pan */
  activeNode: Node | null;
  /** Path node IDs to highlight */
  pathNodeIds?: string[];
  /** All pixel coordinates for the path line */
  pathCoords?: PixelCoordinate[];
  /** Whether to show node labels */
  showLabels?: boolean;
  /** Zoom scale for auto-panning (default: 1.5) */
  autoPanScale?: number;
  /** Animation duration for auto-pan in ms (default: 800) */
  autoPanDuration?: number;
  /** Whether auto-panning is enabled (default: true) */
  autoPanEnabled?: boolean;
}

// ============================================================================
// MapController - Handles Auto-Panning to Active Node
// ============================================================================

interface MapControllerProps {
  activeNode: Node | null;
  imageBounds: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  targetScale: number;
  duration: number;
  enabled: boolean;
}

/**
 * MapController - Internal component that must be placed INSIDE TransformWrapper.
 * Uses useControls() hook to programmatically pan the view to the active node.
 * This solves the problem where scrollIntoView() doesn't work with react-zoom-pan-pinch.
 */
function MapController({
  activeNode,
  imageBounds,
  targetScale,
  duration,
  enabled,
}: MapControllerProps) {
  const { setTransform } = useControls();
  const lastNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if disabled or no node
    if (!enabled || !activeNode) return;

    // Skip if same node (avoid re-panning on every render)
    if (lastNodeIdRef.current === activeNode.id) return;
    lastNodeIdRef.current = activeNode.id;

    // Convert node percentage coordinates to pixel coordinates within the image
    const nodePixelX =
      (activeNode.x / 100) * imageBounds.width + imageBounds.offsetX;
    const nodePixelY =
      (activeNode.y / 100) * imageBounds.height + imageBounds.offsetY;

    // Calculate transform to center the node in the viewport
    // Formula: targetX = (viewportWidth / 2) - (nodeX * scale)
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const targetX = viewportWidth / 2 - nodePixelX * targetScale;
    const targetY = viewportHeight / 2 - nodePixelY * targetScale;

    // Animate to the target position
    setTransform(targetX, targetY, targetScale, duration);
  }, [activeNode, imageBounds, targetScale, duration, enabled, setTransform]);

  return null; // This component only handles side effects
}

// ============================================================================
// ZoomControls - Floating Buttons for Zoom In/Out/Reset
// ============================================================================

function ZoomControls() {
  const { zoomIn, zoomOut, resetTransform } = useControls();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      <button
        onClick={() => zoomIn(0.5)}
        className="p-3 min-h-11 min-w-11 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center justify-center"
        title="Zoom In"
        aria-label="Zoom In"
      >
        <ZoomIn className="w-5 h-5" />
      </button>
      <button
        onClick={() => zoomOut(0.5)}
        className="p-3 min-h-11 min-w-11 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center justify-center"
        title="Zoom Out"
        aria-label="Zoom Out"
      >
        <ZoomOut className="w-5 h-5" />
      </button>
      <button
        onClick={() => resetTransform()}
        className="p-3 min-h-11 min-w-11 rounded-xl bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors flex items-center justify-center"
        title="Reset View"
        aria-label="Reset View"
      >
        <Maximize2 className="w-5 h-5" />
      </button>
    </div>
  );
}

// ============================================================================
// PathLine - SVG Path with Non-Scaling Stroke
// ============================================================================

interface PathLineProps {
  points: PixelCoordinate[];
  isActive?: boolean;
}

function PathLine({ points, isActive = true }: PathLineProps) {
  if (points.length < 2) return null;

  const pathD = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <g>
      {/* Background stroke (white outline for visibility) */}
      <path
        d={pathD}
        fill="none"
        stroke="white"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Main path stroke */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={isActive ? "#3b82f6" : "#9ca3af"}
        strokeWidth={4}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.8, ease: "easeInOut" }}
      />
    </g>
  );
}

// ============================================================================
// MapNode - Individual Node Marker
// ============================================================================

interface MapNodeProps {
  node: Node;
  pixelCoord: PixelCoordinate;
  isOnPath: boolean;
  isActive: boolean;
  showLabel: boolean;
}

function MapNode({
  node,
  pixelCoord,
  isOnPath,
  isActive,
  showLabel,
}: MapNodeProps) {
  const normalizedType =
    typeof node.type === "string" ? node.type.toLowerCase() : "";
  const isGateway = normalizedType === "gateway" || normalizedType === "portal";

  const getNodeColor = () => {
    if (isActive) return "#22c55e"; // green-500 for active
    if (isGateway) return "#f59e0b"; // amber-500
    if (isOnPath) return "#3b82f6"; // blue-500
    return "#6b7280"; // gray-500
  };

  const nodeSize = isActive ? 14 : isGateway ? 10 : 8;

  return (
    <g>
      {/* Pulse animation for active node */}
      {isActive && (
        <motion.circle
          cx={pixelCoord.x}
          cy={pixelCoord.y}
          r={nodeSize + 8}
          fill="none"
          stroke="#22c55e"
          strokeWidth={2}
          initial={{ scale: 1, opacity: 1 }}
          animate={{ scale: 1.8, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Gateway double ring */}
      {isGateway && (
        <circle
          cx={pixelCoord.x}
          cy={pixelCoord.y}
          r={nodeSize + 4}
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="4 2"
          vectorEffect="non-scaling-stroke"
        />
      )}

      {/* Main node circle */}
      <circle
        cx={pixelCoord.x}
        cy={pixelCoord.y}
        r={nodeSize}
        fill={getNodeColor()}
        stroke="white"
        strokeWidth={2}
        className="drop-shadow-md"
        vectorEffect="non-scaling-stroke"
      />

      {/* Active node icon */}
      {isActive && (
        <g transform={`translate(${pixelCoord.x - 6}, ${pixelCoord.y - 6})`}>
          <Navigation className="w-3 h-3 text-white" fill="white" />
        </g>
      )}

      {/* Label */}
      {showLabel && (
        <text
          x={pixelCoord.x}
          y={pixelCoord.y - nodeSize - 8}
          textAnchor="middle"
          className="fill-gray-800 font-medium pointer-events-none"
          style={{ fontSize: "11px" }}
        >
          {node.name}
        </text>
      )}
    </g>
  );
}

// ============================================================================
// Main UserMap Component
// ============================================================================

export default function UserMap({
  mapData,
  activeNode,
  pathNodeIds = [],
  pathCoords = [],
  showLabels = true,
  autoPanScale = 1.5,
  autoPanDuration = 800,
  autoPanEnabled = true,
}: UserMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Get map image source
  const imageSrc = getMapImageSrc(mapData?.mapImage, mapData?.imageUrl);

  // Calculate actual rendered image dimensions
  const { imageBounds, isReady } = useImageDimensions(
    containerRef,
    imageSrc,
    "top-left",
  );

  // Convert percentage coords to pixel coords for SVG
  const toSvgCoords = useCallback(
    (percentX: number, percentY: number): PixelCoordinate => ({
      x: (percentX / 100) * imageBounds.width,
      y: (percentY / 100) * imageBounds.height,
    }),
    [imageBounds.width, imageBounds.height],
  );

  // Convert path nodes to pixel coordinates
  const pathPixelCoords = useMemo(() => {
    if (!isReady || imageBounds.width === 0 || pathCoords.length === 0) {
      // If pathCoords not provided, compute from mapData nodes
      if (!mapData || pathNodeIds.length === 0) return [];
      const nodeMap = new Map(mapData.nodes.map((n) => [n.id, n]));
      return pathNodeIds
        .map((id) => nodeMap.get(id))
        .filter((n): n is Node => n !== undefined)
        .map((node) => toSvgCoords(node.x, node.y));
    }
    return pathCoords;
  }, [
    isReady,
    imageBounds.width,
    pathCoords,
    mapData,
    pathNodeIds,
    toSvgCoords,
  ]);

  // Create set for quick path lookup
  const pathNodeIdSet = useMemo(() => new Set(pathNodeIds), [pathNodeIds]);

  // Nodes to render
  const nodesToRender = useMemo(() => {
    if (!mapData) return [];
    // Only show path nodes for cleaner view
    return mapData.nodes.filter((n) => pathNodeIdSet.has(n.id));
  }, [mapData, pathNodeIdSet]);

  if (!mapData || !imageSrc) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">No map data available</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-gray-200 overflow-hidden">
      <TransformWrapper
        initialScale={1}
        minScale={0.3}
        maxScale={5}
        centerOnInit={true}
        limitToBounds={false}
        doubleClick={{ disabled: false, mode: "zoomIn" }}
        panning={{ velocityDisabled: true }}
        wheel={{ step: 0.1 }}
      >
        {/* MapController - MUST be inside TransformWrapper but outside TransformComponent */}
        <MapController
          activeNode={activeNode}
          imageBounds={imageBounds}
          targetScale={autoPanScale}
          duration={autoPanDuration}
          enabled={autoPanEnabled && isReady}
        />

        {/* Zoom Controls */}
        <ZoomControls />

        <TransformComponent
          wrapperStyle={{
            width: "100%",
            height: "100%",
          }}
          contentStyle={{
            width: "fit-content",
            height: "fit-content",
          }}
        >
          {/* Map Container */}
          <div
            ref={containerRef}
            className="relative"
            style={{
              minWidth: "1200px",
              minHeight: "800px",
              width: Math.max(imageBounds.containerWidth || 1200, 1200),
              height: Math.max(imageBounds.containerHeight || 800, 800),
              backgroundImage: `url(${imageSrc})`,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "top left",
            }}
          >
            {/* SVG Overlay */}
            {isReady && (
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: imageBounds.offsetX,
                  top: imageBounds.offsetY,
                  width: imageBounds.width,
                  height: imageBounds.height,
                }}
                viewBox={`0 0 ${imageBounds.width} ${imageBounds.height}`}
                preserveAspectRatio="none"
              >
                {/* Defs for effects */}
                <defs>
                  <radialGradient id="activeNodeGlow">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Navigation Path */}
                {pathPixelCoords.length >= 2 && (
                  <PathLine points={pathPixelCoords} isActive={true} />
                )}

                {/* Nodes */}
                {nodesToRender.map((node) => {
                  const pixelCoord = toSvgCoords(node.x, node.y);
                  const isOnPath = pathNodeIdSet.has(node.id);
                  const isActiveNode = activeNode?.id === node.id;

                  return (
                    <MapNode
                      key={node.id}
                      node={node}
                      pixelCoord={pixelCoord}
                      isOnPath={isOnPath}
                      isActive={isActiveNode}
                      showLabel={showLabels}
                    />
                  );
                })}
              </svg>
            )}
          </div>
        </TransformComponent>
      </TransformWrapper>
    </div>
  );
}
