"use client";

import { useState, useEffect, useCallback, RefObject } from "react";

/**
 * Rendered image dimensions and position within its container
 */
export interface RenderedImageDimensions {
  /** Width of the actually rendered image content (not container) */
  width: number;
  /** Height of the actually rendered image content (not container) */
  height: number;
  /** Offset from container's left edge to image's left edge */
  offsetX: number;
  /** Offset from container's top edge to image's top edge */
  offsetY: number;
  /** The container's total width */
  containerWidth: number;
  /** The container's total height */
  containerHeight: number;
}

/**
 * Pixel coordinate after conversion from percentage
 */
export interface PixelCoordinate {
  x: number;
  y: number;
}

/**
 * Return type for the useImageDimensions hook
 */
export interface UseImageDimensionsReturn {
  /** Rendered image dimensions and offsets */
  imageBounds: RenderedImageDimensions;
  /** Whether dimensions have been calculated */
  isReady: boolean;
  /** Convert percentage coordinate (0-100) to pixel coordinate relative to container */
  toPixels: (percentX: number, percentY: number) => PixelCoordinate;
  /** Convert pixel coordinate (relative to image) to percentage (0-100) */
  toPercent: (pixelX: number, pixelY: number) => { x: number; y: number };
}

/**
 * Calculate the rendered dimensions of an image using object-fit: contain logic
 *
 * When an image is displayed with object-fit: contain (or background-size: contain),
 * it maintains aspect ratio and fits within the container. This function calculates
 * the actual visible dimensions and position of the image.
 *
 * @param naturalWidth - The image's natural/intrinsic width
 * @param naturalHeight - The image's natural/intrinsic height
 * @param containerWidth - The container's width
 * @param containerHeight - The container's height
 * @returns The rendered dimensions and offsets
 */
export function calculateContainedImageDimensions(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number
): RenderedImageDimensions {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return {
      width: containerWidth,
      height: containerHeight,
      offsetX: 0,
      offsetY: 0,
      containerWidth,
      containerHeight,
    };
  }

  const imageAspectRatio = naturalWidth / naturalHeight;
  const containerAspectRatio = containerWidth / containerHeight;

  let renderedWidth: number;
  let renderedHeight: number;
  let offsetX: number;
  let offsetY: number;

  if (imageAspectRatio > containerAspectRatio) {
    // Image is wider than container (relative to height)
    // Width is the limiting factor - image fills container width
    renderedWidth = containerWidth;
    renderedHeight = containerWidth / imageAspectRatio;
    offsetX = 0;
    offsetY = (containerHeight - renderedHeight) / 2; // Centered vertically
  } else {
    // Image is taller than container (relative to width)
    // Height is the limiting factor - image fills container height
    renderedHeight = containerHeight;
    renderedWidth = containerHeight * imageAspectRatio;
    offsetX = (containerWidth - renderedWidth) / 2; // Centered horizontally
    offsetY = 0;
  }

  return {
    width: renderedWidth,
    height: renderedHeight,
    offsetX,
    offsetY,
    containerWidth,
    containerHeight,
  };
}

/**
 * Calculate rendered dimensions for background-position: top left (no centering)
 */
export function calculateContainedImageDimensionsTopLeft(
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number
): RenderedImageDimensions {
  if (
    naturalWidth <= 0 ||
    naturalHeight <= 0 ||
    containerWidth <= 0 ||
    containerHeight <= 0
  ) {
    return {
      width: containerWidth,
      height: containerHeight,
      offsetX: 0,
      offsetY: 0,
      containerWidth,
      containerHeight,
    };
  }

  const imageAspectRatio = naturalWidth / naturalHeight;
  const containerAspectRatio = containerWidth / containerHeight;

  let renderedWidth: number;
  let renderedHeight: number;

  if (imageAspectRatio > containerAspectRatio) {
    // Width is limiting factor
    renderedWidth = containerWidth;
    renderedHeight = containerWidth / imageAspectRatio;
  } else {
    // Height is limiting factor
    renderedHeight = containerHeight;
    renderedWidth = containerHeight * imageAspectRatio;
  }

  return {
    width: renderedWidth,
    height: renderedHeight,
    offsetX: 0, // Top-left positioning
    offsetY: 0,
    containerWidth,
    containerHeight,
  };
}

/**
 * Hook to track the actual rendered dimensions of an image within a container
 *
 * This hook solves the "drifting coordinate" problem by calculating the exact
 * pixel dimensions of an image displayed with object-fit: contain or
 * background-size: contain, even when the container and image have different
 * aspect ratios.
 *
 * @param containerRef - React ref to the container element
 * @param imageUrl - URL of the image being displayed
 * @param positioning - 'center' for object-fit centered, 'top-left' for background-position: top left
 * @returns Object with rendered dimensions and coordinate conversion functions
 *
 * @example
 * ```tsx
 * const containerRef = useRef<HTMLDivElement>(null);
 * const { imageBounds, toPixels, isReady } = useImageDimensions(
 *   containerRef,
 *   mapData.imageUrl,
 *   'top-left'
 * );
 *
 * // Convert node percentage coordinates to pixels
 * const pixelPos = toPixels(node.x, node.y);
 * // pixelPos.x and pixelPos.y are now relative to container but aligned to image
 * ```
 */
export function useImageDimensions(
  containerRef: RefObject<HTMLDivElement | null>,
  imageUrl: string | undefined | null,
  positioning: "center" | "top-left" = "center"
): UseImageDimensionsReturn {
  // Natural image dimensions
  const [naturalDimensions, setNaturalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);

  // Container dimensions
  const [containerDimensions, setContainerDimensions] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  const [isReady, setIsReady] = useState(false);

  // Load image to get natural dimensions
  useEffect(() => {
    if (!imageUrl) {
      setNaturalDimensions(null);
      setIsReady(false);
      return;
    }

    const img = new Image();
    img.onload = () => {
      setNaturalDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    };
    img.onerror = () => {
      setNaturalDimensions(null);
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Track container size with ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateDimensions = () => {
      const rect = container.getBoundingClientRect();
      setContainerDimensions({
        width: rect.width,
        height: rect.height,
      });
    };

    // Initial measurement
    updateDimensions();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === container) {
          const { width, height } = entry.contentRect;
          setContainerDimensions({ width, height });
        }
      }
    });

    resizeObserver.observe(container);
    window.addEventListener("resize", updateDimensions);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateDimensions);
    };
  }, [containerRef]);

  // Calculate rendered image bounds
  const imageBounds = useCallback((): RenderedImageDimensions => {
    if (!naturalDimensions) {
      // Fallback: use container dimensions if image not loaded
      return {
        width: containerDimensions.width,
        height: containerDimensions.height,
        offsetX: 0,
        offsetY: 0,
        containerWidth: containerDimensions.width,
        containerHeight: containerDimensions.height,
      };
    }

    const calcFn =
      positioning === "center"
        ? calculateContainedImageDimensions
        : calculateContainedImageDimensionsTopLeft;

    return calcFn(
      naturalDimensions.width,
      naturalDimensions.height,
      containerDimensions.width,
      containerDimensions.height
    );
  }, [naturalDimensions, containerDimensions, positioning]);

  // Update ready state
  useEffect(() => {
    const hasContainer =
      containerDimensions.width > 0 && containerDimensions.height > 0;
    const hasImage = naturalDimensions !== null;
    setIsReady(hasContainer && hasImage);
  }, [containerDimensions, naturalDimensions]);

  // Convert percentage (0-100) to pixel coordinate relative to container
  const toPixels = useCallback(
    (percentX: number, percentY: number): PixelCoordinate => {
      const bounds = imageBounds();
      return {
        x: bounds.offsetX + (percentX / 100) * bounds.width,
        y: bounds.offsetY + (percentY / 100) * bounds.height,
      };
    },
    [imageBounds]
  );

  // Convert pixel coordinate to percentage (0-100)
  const toPercent = useCallback(
    (pixelX: number, pixelY: number): { x: number; y: number } => {
      const bounds = imageBounds();
      if (bounds.width === 0 || bounds.height === 0) {
        return { x: 0, y: 0 };
      }
      return {
        x: ((pixelX - bounds.offsetX) / bounds.width) * 100,
        y: ((pixelY - bounds.offsetY) / bounds.height) * 100,
      };
    },
    [imageBounds]
  );

  return {
    imageBounds: imageBounds(),
    isReady,
    toPixels,
    toPercent,
  };
}

/**
 * Helper: Generate SVG path points string from pixel coordinates
 */
export function generateSvgPathPoints(points: PixelCoordinate[]): string {
  if (points.length === 0) return "";
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/**
 * Helper: Calculate total path length from points
 */
export function calculatePathLength(points: PixelCoordinate[]): number {
  let length = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    length += Math.sqrt(dx * dx + dy * dy);
  }
  return length;
}

/**
 * Helper: Get point at progress (0-1) along path
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
  const targetLength = progress * totalLength;

  let accumulatedLength = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const segmentLength = Math.sqrt(dx * dx + dy * dy);

    if (accumulatedLength + segmentLength >= targetLength) {
      const remainingLength = targetLength - accumulatedLength;
      const t = segmentLength > 0 ? remainingLength / segmentLength : 0;
      return {
        x: points[i - 1].x + dx * t,
        y: points[i - 1].y + dy * t,
      };
    }
    accumulatedLength += segmentLength;
  }

  return points[points.length - 1];
}

/**
 * Helper: Calculate angle between two points in degrees
 */
export function calculateAngle(
  from: PixelCoordinate,
  to: PixelCoordinate
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}
