"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Save,
  Plus,
  Trash2,
  X,
  Loader2,
  Link as LinkIcon,
  MapPin,
  DoorOpen,
  Circle,
  Undo,
  Redo,
  QrCode,
  Copy,
  Check,
  Download,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { MapData, Node, Edge, NodeType } from "@/types/navigation";
import { useImageDimensions } from "@/hooks/useImageDimensions";

// ============================================================================
// Types
// ============================================================================

interface MapEditorProps {
  mapData: MapData;
  onMapUpdate: (updatedMap: MapData) => void;
}

interface HistoryState {
  nodes: Node[];
  adjacencyList: Record<string, Edge[]>;
}

type EditorMode = "select" | "add" | "connect";

// ============================================================================
// Helper Functions
// ============================================================================

function generateNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getNodeColor(type: NodeType): string {
  switch (type) {
    case "GATEWAY":
      return "#f59e0b"; // amber-500
    case "ROOM":
      return "#3b82f6"; // blue-500
    default:
      return "#6b7280"; // gray-500
  }
}

function getNodeIcon(type: NodeType) {
  switch (type) {
    case "GATEWAY":
      return DoorOpen;
    case "ROOM":
      return MapPin;
    default:
      return Circle;
  }
}

// ============================================================================
// Main Component
// ============================================================================

export default function MapEditor({ mapData, onMapUpdate }: MapEditorProps) {
  // Refs
  const containerRef = useRef<HTMLDivElement>(null);

  // Use the image dimensions hook for accurate coordinate conversion
  const { imageBounds, isReady, toPixels, toPercent } = useImageDimensions(
    containerRef,
    mapData.imageUrl,
    "top-left" // background-position: top left
  );

  // Helper to convert percentage to SVG-local coordinates
  const toSvgCoords = useCallback(
    (percentX: number, percentY: number) => {
      return {
        x: (percentX / 100) * imageBounds.width,
        y: (percentY / 100) * imageBounds.height,
      };
    },
    [imageBounds.width, imageBounds.height]
  );

  // Helper to convert click position to percentage
  const clickToPercent = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return { x: 0, y: 0 };
      const rect = containerRef.current.getBoundingClientRect();
      const pixelX = clientX - rect.left - imageBounds.offsetX;
      const pixelY = clientY - rect.top - imageBounds.offsetY;

      if (imageBounds.width === 0 || imageBounds.height === 0) {
        return { x: 0, y: 0 };
      }

      return {
        x: (pixelX / imageBounds.width) * 100,
        y: (pixelY / imageBounds.height) * 100,
      };
    },
    [imageBounds]
  );

  // Editor state
  const [nodes, setNodes] = useState<Node[]>(mapData.nodes || []);
  const [adjacencyList, setAdjacencyList] = useState<Record<string, Edge[]>>(
    mapData.adjacencyList || {}
  );
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [connectSourceId, setConnectSourceId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>("select");
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Node being edited in sidebar
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  // Drag state
  const [isDragging, setIsDragging] = useState(false);
  const [dragNodeId, setDragNodeId] = useState<string | null>(null);

  // History for undo/redo
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // All available maps for gateway selection
  const [availableMaps, setAvailableMaps] = useState<
    { id: string; name: string }[]
  >([]);

  // Target map nodes for gateway node selection
  const [targetMapNodes, setTargetMapNodes] = useState<Node[]>([]);
  const [loadingTargetNodes, setLoadingTargetNodes] = useState(false);

  // QR Code URL copy state
  const [qrUrlCopied, setQrUrlCopied] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const qrCodeRef = useRef<HTMLDivElement>(null);

  // Fetch available maps for gateway dropdown
  useEffect(() => {
    const fetchMaps = async () => {
      try {
        const response = await fetch("/api/maps");
        const result = await response.json();
        if (result.success) {
          setAvailableMaps(
            result.data.filter((m: { id: string }) => m.id !== mapData.id)
          );
        }
      } catch (err) {
        console.error("Failed to fetch maps for gateway selection:", err);
      }
    };
    fetchMaps();
  }, [mapData.id]);

  // Fetch target map nodes when gateway target map changes
  useEffect(() => {
    const targetMapId = editingNode?.gatewayConfig?.targetMapId;
    if (!targetMapId || editingNode?.type !== "GATEWAY") {
      setTargetMapNodes([]);
      return;
    }

    const fetchTargetMapNodes = async () => {
      setLoadingTargetNodes(true);
      try {
        const response = await fetch(`/api/maps/${targetMapId}`);
        const result = await response.json();
        if (result.success && result.data.nodes) {
          setTargetMapNodes(result.data.nodes);
        } else {
          setTargetMapNodes([]);
        }
      } catch (err) {
        console.error("Failed to fetch target map nodes:", err);
        setTargetMapNodes([]);
      } finally {
        setLoadingTargetNodes(false);
      }
    };
    fetchTargetMapNodes();
  }, [editingNode?.gatewayConfig?.targetMapId, editingNode?.type]);

  // Initialize history
  useEffect(() => {
    if (history.length === 0) {
      pushHistory();
    }
  }, []);

  // Mark changes as unsaved when nodes/edges change
  useEffect(() => {
    if (history.length > 1) {
      setHasUnsavedChanges(true);
    }
  }, [nodes, adjacencyList]);

  // Push current state to history
  const pushHistory = useCallback(() => {
    const newState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      adjacencyList: JSON.parse(JSON.stringify(adjacencyList)),
    };

    setHistory((prev) => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(newState);
      return newHistory;
    });
    setHistoryIndex((prev) => prev + 1);
  }, [nodes, adjacencyList, historyIndex]);

  // Undo
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setNodes(prevState.nodes);
      setAdjacencyList(prevState.adjacencyList);
      setHistoryIndex((prev) => prev - 1);
    }
  }, [history, historyIndex]);

  // Redo
  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setNodes(nextState.nodes);
      setAdjacencyList(nextState.adjacencyList);
      setHistoryIndex((prev) => prev + 1);
    }
  }, [history, historyIndex]);

  // Handle canvas double-click to add node
  const handleCanvasDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (mode !== "add" || !containerRef.current) return;

      // Use clickToPercent to account for image offset
      const { x: percentX, y: percentY } = clickToPercent(e.clientX, e.clientY);

      const newNode: Node = {
        id: generateNodeId(),
        x: Math.round(percentX * 100) / 100,
        y: Math.round(percentY * 100) / 100,
        type: "NORMAL",
        name: `Node ${nodes.length + 1}`,
      };

      setNodes((prev) => [...prev, newNode]);
      setAdjacencyList((prev) => ({ ...prev, [newNode.id]: [] }));
      setSelectedNodeId(newNode.id);
      setEditingNode(newNode);

      setTimeout(() => pushHistory(), 0);
    },
    [mode, clickToPercent, nodes.length, pushHistory]
  );

  // Handle node click
  const handleNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.stopPropagation();

      if (mode === "connect") {
        if (connectSourceId === null) {
          // First node selected
          setConnectSourceId(node.id);
        } else if (connectSourceId !== node.id) {
          // Second node selected - toggle edge
          toggleEdge(connectSourceId, node.id);
          setConnectSourceId(null);
        }
      } else {
        setSelectedNodeId(node.id);
        setEditingNode(node);
      }
    },
    [mode, connectSourceId]
  );

  // Toggle edge between two nodes
  const toggleEdge = useCallback(
    (fromId: string, toId: string) => {
      setAdjacencyList((prev) => {
        const newList = { ...prev };

        // Check if edge exists
        const fromEdges = newList[fromId] || [];
        const existingEdgeIndex = fromEdges.findIndex(
          (e) => e.targetNodeId === toId
        );

        if (existingEdgeIndex >= 0) {
          // Remove edge (both directions)
          newList[fromId] = fromEdges.filter((e) => e.targetNodeId !== toId);
          newList[toId] = (newList[toId] || []).filter(
            (e) => e.targetNodeId !== fromId
          );
        } else {
          // Add edge (both directions)
          const weight = calculateDistance(fromId, toId);
          newList[fromId] = [...fromEdges, { targetNodeId: toId, weight }];
          newList[toId] = [
            ...(newList[toId] || []),
            { targetNodeId: fromId, weight },
          ];
        }

        return newList;
      });

      setTimeout(() => pushHistory(), 0);
    },
    [pushHistory]
  );

  // Calculate distance between two nodes
  const calculateDistance = useCallback(
    (nodeId1: string, nodeId2: string): number => {
      const node1 = nodes.find((n) => n.id === nodeId1);
      const node2 = nodes.find((n) => n.id === nodeId2);
      if (!node1 || !node2) return 10;

      const dx = node2.x - node1.x;
      const dy = node2.y - node1.y;
      return Math.round(Math.sqrt(dx * dx + dy * dy));
    },
    [nodes]
  );

  // Handle node drag start
  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      if (mode !== "select") return;
      e.preventDefault();
      setIsDragging(true);
      setDragNodeId(nodeId);
    },
    [mode]
  );

  // Handle mouse move for dragging
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !dragNodeId || !containerRef.current) return;

      // Use clickToPercent to account for image offset
      const { x: percentX, y: percentY } = clickToPercent(e.clientX, e.clientY);

      // Clamp to 0-100
      const clampedX = Math.max(0, Math.min(100, percentX));
      const clampedY = Math.max(0, Math.min(100, percentY));

      setNodes((prev) =>
        prev.map((node) =>
          node.id === dragNodeId
            ? {
                ...node,
                x: Math.round(clampedX * 100) / 100,
                y: Math.round(clampedY * 100) / 100,
              }
            : node
        )
      );
    },
    [isDragging, dragNodeId, clickToPercent]
  );

  // Handle mouse up to stop dragging
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false);
      setDragNodeId(null);
      pushHistory();
    }
  }, [isDragging, pushHistory]);

  // Delete selected node
  const handleDeleteNode = useCallback(() => {
    if (!selectedNodeId) return;

    setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
    setAdjacencyList((prev) => {
      const newList = { ...prev };
      delete newList[selectedNodeId];
      // Remove edges pointing to deleted node
      Object.keys(newList).forEach((key) => {
        newList[key] = newList[key].filter(
          (e) => e.targetNodeId !== selectedNodeId
        );
      });
      return newList;
    });

    setSelectedNodeId(null);
    setEditingNode(null);
    setTimeout(() => pushHistory(), 0);
  }, [selectedNodeId, pushHistory]);

  // Update node properties
  const updateNode = useCallback(
    (updates: Partial<Node>) => {
      if (!editingNode) return;

      const updatedNode = { ...editingNode, ...updates };
      setNodes((prev) =>
        prev.map((n) => (n.id === editingNode.id ? updatedNode : n))
      );
      setEditingNode(updatedNode);
    },
    [editingNode]
  );

  // Save changes
  const handleSave = async () => {
    setIsSaving(true);

    try {
      const updatedMapData: MapData = {
        ...mapData,
        nodes,
        adjacencyList,
      };

      const response = await fetch(`/api/maps/${mapData.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedMapData),
      });

      const result = await response.json();

      if (result.success) {
        onMapUpdate(result.data);
        setHasUnsavedChanges(false);
        alert("Map saved successfully!");
      } else {
        alert(result.error || "Failed to save map");
      }
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save map");
    } finally {
      setIsSaving(false);
    }
  };

  // Get selected node
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  // Generate QR Code URL for selected node
  const generateQRCodeURL = useCallback(() => {
    if (!selectedNode) return "";

    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

    return `${baseUrl}/navigate?mapId=${encodeURIComponent(
      mapData.id
    )}&nodeId=${encodeURIComponent(selectedNode.id)}`;
  }, [selectedNode, mapData.id]);

  // Copy QR URL to clipboard
  const handleCopyQRUrl = useCallback(async () => {
    const url = generateQRCodeURL();
    if (!url) return;

    // Check if we're in a browser environment
    if (typeof window === "undefined") {
      return;
    }

    // Try modern Clipboard API first
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(url);
        setQrUrlCopied(true);
        setTimeout(() => setQrUrlCopied(false), 2000);
        return;
      } catch (err) {
        console.warn("Clipboard API failed, trying fallback:", err);
      }
    }

    // Fallback: Use legacy document.execCommand method
    try {
      const textArea = document.createElement("textarea");
      textArea.value = url;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        setQrUrlCopied(true);
        setTimeout(() => setQrUrlCopied(false), 2000);
      } else {
        throw new Error("execCommand failed");
      }
    } catch (err) {
      console.error("All copy methods failed:", err);
      // Last resort: show alert with URL
      alert(`Copy this URL:\n${url}`);
    }
  }, [generateQRCodeURL]);

  // Download QR Code as PNG
  const handleDownloadQR = useCallback(() => {
    if (!qrCodeRef.current || !selectedNode) return;

    const svg = qrCodeRef.current.querySelector("svg");
    if (!svg) return;

    // Create a canvas element
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size (add padding)
    const padding = 40;
    const qrSize = 256;
    canvas.width = qrSize + padding * 2;
    canvas.height = qrSize + padding * 2 + 60; // Extra space for text

    // Fill white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], {
      type: "image/svg+xml;charset=utf-8",
    });
    const svgUrl = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      // Draw QR code centered
      ctx.drawImage(img, padding, padding, qrSize, qrSize);

      // Add text below QR code
      ctx.fillStyle = "#1f2937";
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText(selectedNode.name, canvas.width / 2, qrSize + padding + 30);

      ctx.font = "12px Arial";
      ctx.fillStyle = "#6b7280";
      ctx.fillText(mapData.name, canvas.width / 2, qrSize + padding + 50);

      // Convert to blob and download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `QR-${selectedNode.name.replace(/\s+/g, "-")}.png`;
        link.click();
        URL.revokeObjectURL(url);
      });

      URL.revokeObjectURL(svgUrl);
    };

    img.src = svgUrl;
  }, [selectedNode, mapData.name]);

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Toolbar */}
      <div className="w-14 bg-white border-r flex flex-col items-center py-4 gap-2">
        {/* Mode buttons */}
        <button
          onClick={() => {
            setMode("select");
            setConnectSourceId(null);
          }}
          className={`p-3 rounded-lg transition-colors ${
            mode === "select"
              ? "bg-blue-100 text-blue-600"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title="Select & Move (S)"
        >
          <Circle className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setMode("add");
            setConnectSourceId(null);
          }}
          className={`p-3 rounded-lg transition-colors ${
            mode === "add"
              ? "bg-green-100 text-green-600"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title="Add Node (A) - Double-click to place"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          onClick={() => {
            setMode("connect");
            setConnectSourceId(null);
          }}
          className={`p-3 rounded-lg transition-colors ${
            mode === "connect"
              ? "bg-purple-100 text-purple-600"
              : "hover:bg-gray-100 text-gray-600"
          }`}
          title="Connect Nodes (C) - Click two nodes"
        >
          <LinkIcon className="w-5 h-5" />
        </button>

        <div className="border-t w-8 my-2" />

        {/* Undo/Redo */}
        <button
          onClick={handleUndo}
          disabled={historyIndex <= 0}
          className="p-3 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo"
        >
          <Undo className="w-5 h-5" />
        </button>
        <button
          onClick={handleRedo}
          disabled={historyIndex >= history.length - 1}
          className="p-3 rounded-lg hover:bg-gray-100 text-gray-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo"
        >
          <Redo className="w-5 h-5" />
        </button>

        <div className="border-t w-8 my-2" />

        {/* Delete */}
        <button
          onClick={handleDeleteNode}
          disabled={!selectedNodeId}
          className="p-3 rounded-lg hover:bg-red-100 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Delete Node (Del)"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="flex-1" />

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`p-3 rounded-lg transition-colors ${
            hasUnsavedChanges
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400"
          }`}
          title="Save Changes"
        >
          {isSaving ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Save className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Canvas Area - Scrollable Container */}
      <div className="flex-1 overflow-auto p-4">
        <div
          ref={containerRef}
          className="relative bg-gray-200 rounded-lg shadow-inner cursor-crosshair"
          style={{
            minWidth: "1200px",
            minHeight: "800px",
            width: "max-content",
            height: "max-content",
            backgroundImage: mapData.imageUrl
              ? `url(${mapData.imageUrl})`
              : undefined,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "top left",
          }}
          onDoubleClick={handleCanvasDoubleClick}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* No Image Placeholder */}
          {!mapData.imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <MapPin className="w-16 h-16 mx-auto mb-2 opacity-30" />
                <p>No map image set</p>
                <p className="text-sm">Add an image URL in map settings</p>
              </div>
            </div>
          )}

          {/* Mode indicator */}
          <div className="absolute top-2 left-2 px-3 py-1 bg-black/50 text-white text-sm rounded-full z-10">
            {mode === "select" && "Select Mode - Drag nodes to move"}
            {mode === "add" && "Add Mode - Double-click to add node"}
            {mode === "connect" &&
              (connectSourceId
                ? "Click target node to connect"
                : "Click first node to start connection")}
          </div>

          {/* Image URL debug info */}
          {mapData.imageUrl && (
            <div className="absolute top-2 right-2 px-2 py-1 bg-black/30 text-white text-xs rounded max-w-xs truncate z-10">
              {mapData.imageUrl}
            </div>
          )}

          {/* SVG Overlay - positioned over the actual rendered image */}
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
            >
              {/* Edges */}
              {Object.entries(adjacencyList).map(([fromId, edges]) => {
                const fromNode = nodes.find((n) => n.id === fromId);
                if (!fromNode) return null;

                return edges.map((edge) => {
                  const toNode = nodes.find((n) => n.id === edge.targetNodeId);
                  if (!toNode) return null;

                  const from = toSvgCoords(fromNode.x, fromNode.y);

                  const to = toSvgCoords(toNode.x, toNode.y);

                  // Only draw edge once (from smaller to larger ID)
                  if (fromId > edge.targetNodeId) return null;

                  return (
                    <line
                      key={`${fromId}-${edge.targetNodeId}`}
                      x1={from.x}
                      y1={from.y}
                      x2={to.x}
                      y2={to.y}
                      stroke="#6b7280"
                      strokeWidth={2}
                      strokeDasharray={
                        fromNode.type === "GATEWAY" || toNode.type === "GATEWAY"
                          ? "5,5"
                          : undefined
                      }
                    />
                  );
                });
              })}

              {/* Connection preview line */}
              {connectSourceId &&
                (() => {
                  const sourceNode = nodes.find(
                    (n) => n.id === connectSourceId
                  );
                  if (!sourceNode) return null;
                  const sourcePos = toSvgCoords(sourceNode.x, sourceNode.y);
                  return (
                    <line
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={imageBounds.width / 2}
                      y2={imageBounds.height / 2}
                      stroke="#9333ea"
                      strokeWidth={2}
                      strokeDasharray="5,5"
                      opacity={0.5}
                      className="pointer-events-none"
                    />
                  );
                })()}
            </svg>
          )}

          {/* Nodes */}
          {isReady &&
            nodes.map((node) => {
              const pos = toPixels(node.x, node.y);
              const isSelected = node.id === selectedNodeId;
              const isConnectSource = node.id === connectSourceId;
              const NodeIcon = getNodeIcon(node.type);

              return (
                <div
                  key={node.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform ${
                    isDragging && dragNodeId === node.id ? "scale-110" : ""
                  }`}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    zIndex: isSelected ? 20 : 10,
                  }}
                  onClick={(e) => handleNodeClick(e, node)}
                  onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                >
                  {/* Selection ring */}
                  {(isSelected || isConnectSource) && (
                    <div
                      className={`absolute inset-0 -m-2 rounded-full border-2 ${
                        isConnectSource
                          ? "border-purple-500 animate-pulse"
                          : "border-blue-500"
                      }`}
                      style={{ width: 36, height: 36 }}
                    />
                  )}

                  {/* Node circle */}
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center shadow-md border-2 border-white"
                    style={{ backgroundColor: getNodeColor(node.type) }}
                  >
                    <NodeIcon className="w-4 h-4 text-white" />
                  </div>

                  {/* Label */}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-0.5 bg-white/90 rounded text-xs font-medium whitespace-nowrap shadow text-black">
                    {node.name}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Properties Sidebar */}
      <div className="w-80 bg-white border-l flex flex-col">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Node Properties</h3>
        </div>

        {editingNode ? (
          <div className="flex-1 p-4 space-y-4 overflow-auto">
            {/* Node ID */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Node ID
              </label>
              <input
                type="text"
                value={editingNode.id}
                disabled
                className="w-full px-3 py-2 bg-gray-50 border rounded-lg text-sm text-gray-500"
              />
            </div>

            {/* Name */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Name
              </label>
              <input
                type="text"
                value={editingNode.name}
                onChange={(e) => updateNode({ name: e.target.value })}
                onBlur={() => pushHistory()}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Type
              </label>
              <select
                value={editingNode.type}
                onChange={(e) => {
                  const newType = e.target.value as NodeType;
                  updateNode({
                    type: newType,
                    gatewayConfig:
                      newType === "GATEWAY"
                        ? { targetMapId: "", targetNodeId: "" }
                        : undefined,
                  });
                  pushHistory();
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="NORMAL">Normal</option>
                <option value="ROOM">Room</option>
                <option value="GATEWAY">Gateway</option>
              </select>
            </div>

            {/* Category / Type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Category / Type
              </label>
              <select
                value={editingNode.category || "none"}
                onChange={(e) => {
                  updateNode({ category: e.target.value });
                  pushHistory();
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              >
                <option value="none">None (Default)</option>
                <option value="canteen">Canteen</option>
                <option value="library">Library</option>
                <option value="medical">Medical</option>
                <option value="restroom_men">Restroom (Men)</option>
                <option value="restroom_women">Restroom (Women)</option>
                <option value="staff_room">Staff Room</option>
                <option value="office_principal">Office - Principal</option>
                <option value="office_chairman">Office - Chairman</option>
                <option value="parking">Parking</option>
                <option value="staff_room">Staff Room</option>
                <option value="accounts">Accounts</option>
                <option value="ground">Ground</option>
                <option value="office_hod_cse">Office - HOD CSE</option>
                <option value="office_hod_ece">Office - HOD ECE</option>
                <option value="office_hod_mech">Office - HOD Mechanical</option>
                <option value="office_hod_civil">Office - HOD Civil</option>
                <option value="office_hod_it">Office - HOD IT</option>
                <option value="office_hod_aiml">Office - HOD AIML</option>
                <option value="office_hod_aids">Office - HOD AIDS</option>
                <option value="ground">Ground (Playground/Gym)</option>
                <option value="gate">Gate (Main Entrance/Exit)</option>
                <option value="gym">Gym</option>
                <option value="auditorium_kaveri">Kaveri Auditorium</option>
                <option value="auditorium_parthasarathy">
                  Parthasarathy Auditorium
                </option>
                <option value="drinking_water">Drinking Water</option>
                <option value="computer_lab">Computer lab</option>
              </select>
            </div>

            {/* Gateway Config */}
            {editingNode.type === "GATEWAY" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <h4 className="text-sm font-medium text-amber-800">
                  Gateway Configuration
                </h4>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Target Map
                  </label>
                  <select
                    value={editingNode.gatewayConfig?.targetMapId || ""}
                    onChange={(e) => {
                      updateNode({
                        gatewayConfig: {
                          targetMapId: e.target.value,
                          targetNodeId:
                            editingNode.gatewayConfig?.targetNodeId || "",
                        },
                      });
                      pushHistory();
                    }}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-black"
                  >
                    <option value="">Select target map...</option>
                    {availableMaps.map((map) => (
                      <option key={map.id} value={map.id}>
                        {map.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Target Node
                  </label>
                  {loadingTargetNodes ? (
                    <div className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-400">
                      Loading nodes...
                    </div>
                  ) : targetMapNodes.length > 0 ? (
                    <select
                      value={editingNode.gatewayConfig?.targetNodeId || ""}
                      onChange={(e) => {
                        updateNode({
                          gatewayConfig: {
                            targetMapId:
                              editingNode.gatewayConfig?.targetMapId || "",
                            targetNodeId: e.target.value,
                          },
                        });
                        pushHistory();
                      }}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-black"
                    >
                      <option value="">Select target node...</option>
                      {targetMapNodes.map((node) => (
                        <option key={node.id} value={node.id}>
                          {node.name} ({node.type})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-400">
                      {editingNode.gatewayConfig?.targetMapId
                        ? "No nodes in target map"
                        : "Select a target map first"}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Coordinates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  X (%)
                </label>
                <input
                  type="number"
                  value={editingNode.x}
                  onChange={(e) =>
                    updateNode({
                      x: Math.max(0, Math.min(100, parseFloat(e.target.value))),
                    })
                  }
                  onBlur={() => pushHistory()}
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Y (%)
                </label>
                <input
                  type="number"
                  value={editingNode.y}
                  onChange={(e) =>
                    updateNode({
                      y: Math.max(0, Math.min(100, parseFloat(e.target.value))),
                    })
                  }
                  onBlur={() => pushHistory()}
                  min={0}
                  max={100}
                  step={0.1}
                  className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Description (optional)
              </label>
              <textarea
                value={editingNode.description || ""}
                onChange={(e) => updateNode({ description: e.target.value })}
                onBlur={() => pushHistory()}
                rows={2}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-black"
                placeholder="Additional info about this node..."
              />
            </div>

            {/* QR Code Generator */}
            <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-blue-600" />
                <h4 className="text-sm font-medium text-blue-800">
                  QR Code for This Location
                </h4>
              </div>

              <p className="text-xs text-gray-600">
                Generate a scannable QR code that opens the navigation app with
                this location pre-selected as the starting point.
              </p>

              <button
                onClick={() => setShowQRModal(true)}
                className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm font-medium"
              >
                <QrCode className="w-4 h-4" />
                Generate QR Code
              </button>
            </div>

            {/* Connections */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Connected To
              </label>
              <div className="space-y-1">
                {(adjacencyList[editingNode.id] || []).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No connections</p>
                ) : (
                  (adjacencyList[editingNode.id] || []).map((edge) => {
                    const targetNode = nodes.find(
                      (n) => n.id === edge.targetNodeId
                    );
                    return (
                      <div
                        key={edge.targetNodeId}
                        className="flex items-center justify-between px-2 py-1 bg-gray-50 rounded text-sm text-black"
                      >
                        <span>{targetNode?.name || edge.targetNodeId}</span>
                        <span className="text-gray-400">w: {edge.weight}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Delete button */}
            <button
              onClick={handleDeleteNode}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete Node
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-gray-400">
            <div>
              <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Select a node to edit its properties</p>
            </div>
          </div>
        )}

        {/* Stats footer */}
        <div className="p-4 border-t bg-gray-50 text-xs text-gray-500">
          <div className="flex justify-between">
            <span>{nodes.length} nodes</span>
            <span>
              {Object.values(adjacencyList).reduce(
                (sum, edges) => sum + edges.length,
                0
              ) / 2}{" "}
              edges
            </span>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && selectedNode && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowQRModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <QrCode className="w-6 h-6 text-blue-600" />
                  QR Code Generated
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Scan to navigate to {selectedNode.name}
                </p>
              </div>
              <button
                onClick={() => setShowQRModal(false)}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* QR Code Display */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 flex flex-col items-center">
              <div
                ref={qrCodeRef}
                className="bg-white p-4 rounded-lg shadow-md"
              >
                <QRCodeSVG
                  value={generateQRCodeURL()}
                  size={256}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-gray-800">
                  {selectedNode.name}
                </p>
                <p className="text-xs text-gray-600">{mapData.name}</p>
              </div>
            </div>

            {/* URL Display */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-500">URL:</label>
              <div className="flex items-stretch gap-2">
                <input
                  type="text"
                  value={generateQRCodeURL()}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 overflow-x-auto"
                />
                <button
                  onClick={handleCopyQRUrl}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium"
                  title="Copy URL"
                >
                  {qrUrlCopied ? (
                    <>
                      <Check className="w-4 h-4 text-green-600" />
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleDownloadQR}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <Download className="w-5 h-5" />
                Download PNG
              </button>
              <button
                onClick={() => setShowQRModal(false)}
                className="px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors font-medium"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              💡 Print this QR code and place it at the physical location for
              easy navigation
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
