"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

/**
 * Dimensions of the map container in pixels
 */
export interface MapDimensions {
  width: number;
  height: number;
}

/**
 * Pixel coordinate after conversion from percentage
 */
export interface PixelCoordinate {
  x: number;
  y: number;
}

/**
 * Return type for the useMapDimensions hook
 */
export interface UseMapDimensionsReturn {
  /** Current dimensions of the container */
  dimensions: MapDimensions;
  /** Whether dimensions have been measured */
  isReady: boolean;
  /** Convert percentage coordinate to pixel coordinate */
  toPixels: (percentX: number, percentY: number) => PixelCoordinate;
  /** Convert pixel coordinate to percentage coordinate */
  toPercent: (pixelX: number, pixelY: number) => { x: number; y: number };
  /** Convert a single percentage value to pixels (for width) */
  percentToPixelX: (percent: number) => number;
  /** Convert a single percentage value to pixels (for height) */
  percentToPixelY: (percent: number) => number;
}

/**
 * Hook to track map container dimensions and provide coordinate conversion utilities
 *
 * Uses ResizeObserver to reactively track container size changes,
 * enabling responsive coordinate conversion from percentage (0-100) to pixels.
 *
 * @param containerRef - React ref to the map container element
 * @returns Object with dimensions and conversion functions
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { dimensions, toPixels, isReady } = useMapDimensions(containerRef);
 *
 * // Convert node coordinates
 * const pixelPos = toPixels(node.x, node.y);
 * ```
 */
export function useMapDimensions(
  containerRef: RefObject<HTMLDivElement | null>
): UseMapDimensionsReturn {
  const [dimensions, setDimensions] = useState<MapDimensions>({
    width: 0,
    height: 0,
  });
  const [isReady, setIsReady] = useState(false);

  // Set up ResizeObserver to track container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setDimensions({
        width: rect.width,
        height: rect.height,
      });
      setIsReady(true);
    };

    // Initial measurement
    updateDimensions();

    // Create ResizeObserver for responsive updates
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          const { width, height } = entry.contentRect;
          setDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(container);

    // Also listen for window resize as fallback
    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [containerRef]);

  /**
   * Convert percentage coordinates (0-100) to pixel coordinates
   */
  const toPixels = useCallback(
    (percentX: number, percentY: number): PixelCoordinate => {
      return {
        x: (percentX / 100) * dimensions.width,
        y: (percentY / 100) * dimensions.height,
      };
    },
    [dimensions]
  );

  /**
   * Convert pixel coordinates to percentage coordinates (0-100)
   */
  const toPercent = useCallback(
    (pixelX: number, pixelY: number): { x: number; y: number } => {
      if (dimensions.width === 0 || dimensions.height === 0) {
        return { x: 0, y: 0 };
      }
      return {
        x: (pixelX / dimensions.width) * 100,
        y: (pixelY / dimensions.height) * 100,
      };
    },
    [dimensions]
  );

  /**
   * Convert a single percentage X value to pixels
   */
  const percentToPixelX = useCallback(
    (percent: number): number => {
      return (percent / 100) * dimensions.width;
    },
    [dimensions.width]
  );

  /**
   * Convert a single percentage Y value to pixels
   */
  const percentToPixelY = useCallback(
    (percent: number): number => {
      return (percent / 100) * dimensions.height;
    },
    [dimensions.height]
  );

  return {
    dimensions,
    isReady,
    toPixels,
    toPercent,
    percentToPixelX,
    percentToPixelY,
  };
}

/**
 * Generate SVG path points string from an array of pixel coordinates
 *
 * @param points - Array of pixel coordinates
 * @returns SVG points string for polyline/polygon
 */
export function generateSvgPathPoints(points: PixelCoordinate[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Calculate the total length of a path (for animation duration calculation)
 *
 * @param points - Array of pixel coordinates
 * @returns Total path length in pixels
 */
export function calculatePathLength(points: PixelCoordinate[]): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Get a point along a path at a given progress (0-1)
 *
 * @param points - Array of pixel coordinates forming the path
 * @param progress - Progress along the path (0 = start, 1 = end)
 * @returns Interpolated pixel coordinate at the given progress
 */
export function getPointAtProgress(
  points: PixelCoordinate[],
  progress: number
): PixelCoordinate {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];
  if (progress <= 0) return points[0];
  if (progress >= 1) return points[points.length - 1];

  const totalLength = calculatePathLength(points);
  const targetLength = totalLength * progress;

  let accumulatedLength = 0;

  for (let i = 0; i < points.length - 1; i++) {
    const dx = points[i + 1].x - points[i].x;
    const dy = points[i + 1].y - points[i].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (accumulatedLength + segmentLength >= targetLength) {
      // Target is within this segment
      const remainingLength = targetLength - accumulatedLength;
      const ratio = segmentLength > 0 ? remainingLength / segmentLength : 0;

      return {
        x: points[i].x + dx * ratio,
        y: points[i].y + dy * ratio,
      };
    }

    accumulatedLength += segmentLength;
  }

  return points[points.length - 1];
}

/**
 * Calculate the angle of direction between two points (for rotating arrow indicator)
 *
 * @param from - Starting point
 * @param to - Ending point
 * @returns Angle in degrees (0 = right, 90 = down, etc.)
 */
export function calculateAngle(
  from: PixelCoordinate,
  to: PixelCoordinate
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
