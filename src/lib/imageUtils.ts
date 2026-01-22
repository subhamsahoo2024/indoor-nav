/**
 * Image Utilities for Hybrid Storage System
 *
 * Handles conversion between File objects and Base64 strings,
 * with validation for MongoDB storage limits.
 */

/** Maximum file size in bytes (5MB) before Base64 encoding */
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

/** Maximum file size in MB for display purposes */
export const MAX_FILE_SIZE_MB = 5;

/** Allowed image MIME types */
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
] as const;

export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

/**
 * Result of file to Base64 conversion
 */
export interface FileToBase64Result {
  success: true;
  base64: string;
  mimeType: string;
  originalName: string;
  sizeBytes: number;
}

/**
 * Error result from file to Base64 conversion
 */
export interface FileToBase64Error {
  success: false;
  error: string;
}

/**
 * Convert a File object to a Base64 data URL string
 *
 * @param file - The file to convert
 * @returns Promise resolving to the Base64 result or error
 *
 * @example
 * ```tsx
 * const result = await fileToBase64(file);
 * if (result.success) {
 *   // Use result.base64 for display or API submission
 *   console.log(result.base64); // "data:image/png;base64,..."
 * } else {
 *   console.error(result.error);
 * }
 * ```
 */
export function fileToBase64(
  file: File,
): Promise<FileToBase64Result | FileToBase64Error> {
  return new Promise((resolve) => {
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type as AllowedImageType)) {
      resolve({
        success: false,
        error: `Invalid file type "${file.type}". Allowed types: PNG, JPEG, WebP, GIF`,
      });
      return;
    }

    // Validate file size (5MB limit to stay safe with Base64 ~33% increase)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      resolve({
        success: false,
        error: `File too large (${(file.size / (1024 * 1024)).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE_MB}MB`,
      });
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const base64 = reader.result as string;
      resolve({
        success: true,
        base64,
        mimeType: file.type,
        originalName: file.name,
        sizeBytes: file.size,
      });
    };

    reader.onerror = () => {
      resolve({
        success: false,
        error: "Failed to read file. Please try again.",
      });
    };

    // Read file as data URL (Base64)
    reader.readAsDataURL(file);
  });
}

/**
 * Validate a Base64 image string
 *
 * @param base64 - The Base64 string to validate
 * @returns True if valid data URL format
 */
export function isValidBase64Image(base64: string): boolean {
  if (!base64 || typeof base64 !== "string") return false;

  // Check for data URL format
  const dataUrlPattern = /^data:image\/(png|jpeg|jpg|webp|gif);base64,/;
  return dataUrlPattern.test(base64);
}

/**
 * Get the effective image source for a map
 * Prefers mapImage (Base64) over imageUrl (file path) for new maps
 *
 * @param mapImage - Base64 encoded image (new maps)
 * @param imageUrl - File path URL (old maps)
 * @returns The image source to use, or undefined if neither exists
 */
export function getMapImageSrc(
  mapImage?: string,
  imageUrl?: string,
): string | undefined {
  // Prefer Base64 image (new maps) over file URL (old maps)
  return mapImage || imageUrl || undefined;
}

/**
 * Format file size for display
 *
 * @param bytes - Size in bytes
 * @returns Formatted size string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
