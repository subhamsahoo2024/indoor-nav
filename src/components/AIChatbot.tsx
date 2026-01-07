"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageCircle,
  X,
  Send,
  Bot,
  User,
  MapPin,
  Sparkles,
  Search,
  ChevronDown,
} from "lucide-react";
import type { MapData, Node, NodeType } from "@/types/navigation";
import { generateNavigationPath } from "@/lib/pathfinder";

// Types

interface Message {
  id: string;
  text: string;
  sender: "user" | "bot";
  timestamp: Date;
}

interface AIChatbotProps {
  onSetDestination: (nodeId: string, mapId: string) => void;
  onSetCurrentLocation?: (nodeId: string, mapId: string) => void;
  allMaps: MapData[];
  currentMapId?: string;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AIChatbot({
  onSetDestination,
  onSetCurrentLocation,
  allMaps,
  currentMapId,
}: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      text: "Hi! I'm your Campus Assistant. Tell me where you'd like to go. Try saying 'Canteen', 'Library', or 'Boys Restroom'.",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Location selector state
  const [selectedFromMapId, setSelectedFromMapId] = useState<string | null>(
    null
  );
  const [selectedFromNodeId, setSelectedFromNodeId] = useState<string | null>(
    null
  );
  const [fromSearchQuery, setFromSearchQuery] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Add a message to the chat
  const addMessage = (text: string, sender: "user" | "bot") => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random(),
      text,
      sender,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

  // Get all locations for "From" selector
  const getAllLocations = useMemo(() => {
    const locations: Array<{
      nodeId: string;
      mapId: string;
      nodeName: string;
      mapName: string;
      type: NodeType;
    }> = [];

    for (const map of allMaps) {
      for (const node of map.nodes) {
        locations.push({
          nodeId: node.id,
          mapId: map.id,
          nodeName: node.name,
          mapName: map.name,
          type: node.type,
        });
      }
    }
    return locations;
  }, [allMaps]);

  // Filter locations based on search query
  const filteredLocations = useMemo(() => {
    if (!fromSearchQuery.trim()) return getAllLocations;

    const query = fromSearchQuery.toLowerCase();
    return getAllLocations.filter(
      (loc) =>
        loc.nodeName.toLowerCase().includes(query) ||
        loc.mapName.toLowerCase().includes(query)
    );
  }, [getAllLocations, fromSearchQuery]);

  // Group filtered locations by map
  const groupedLocations = useMemo(() => {
    const groups: Record<
      string,
      Array<{
        nodeId: string;
        mapId: string;
        nodeName: string;
        mapName: string;
        type: NodeType;
      }>
    > = {};

    filteredLocations.forEach((loc) => {
      if (!groups[loc.mapName]) {
        groups[loc.mapName] = [];
      }
      groups[loc.mapName].push(loc);
    });
    return groups;
  }, [filteredLocations]);

  // Handle location selection
  const handleSelectFromLocation = useCallback(
    (mapId: string, nodeId: string) => {
      setSelectedFromMapId(mapId);
      setSelectedFromNodeId(nodeId);
      setShowFromDropdown(false);
      setFromSearchQuery("");

      // Notify parent component
      if (onSetCurrentLocation) {
        onSetCurrentLocation(nodeId, mapId);
      }
    },
    [onSetCurrentLocation]
  );

  // Get selected location display name
  const getSelectedLocationName = useCallback(() => {
    if (!selectedFromMapId || !selectedFromNodeId) return null;

    const map = allMaps.find((m) => m.id === selectedFromMapId);
    const node = map?.nodes.find((n) => n.id === selectedFromNodeId);
    return node ? `${node.name} (${map?.name})` : null;
  }, [selectedFromMapId, selectedFromNodeId, allMaps]);

  // Find nearest node by category using pathfinding distance
  const findNearestNodeByCategory = async (
    category: string
  ): Promise<{ node: Node; map: MapData } | null> => {
    // Collect all matching nodes
    const allMatches: Array<{ node: Node; map: MapData }> = [];

    for (const map of allMaps) {
      const matchingNodes = map.nodes.filter(
        (node) => node.category === category
      );
      for (const node of matchingNodes) {
        allMatches.push({ node, map });
      }
    }

    if (allMatches.length === 0) return null;
    if (allMatches.length === 1) return allMatches[0];

    // If no starting location selected, return first match
    if (!selectedFromMapId || !selectedFromNodeId) {
      return allMatches[0];
    }

    // Calculate pathfinding distance to each match
    const matchesWithDistance = await Promise.all(
      allMatches.map(async (match) => {
        try {
          const pathResult = await generateNavigationPath(
            selectedFromMapId,
            selectedFromNodeId,
            match.map.id,
            match.node.id
          );

          const distance = pathResult.success
            ? pathResult.totalNodes
            : Infinity;
          return { ...match, distance };
        } catch (error) {
          return { ...match, distance: Infinity };
        }
      })
    );

    // Sort by distance and return nearest
    matchesWithDistance.sort((a, b) => a.distance - b.distance);
    return matchesWithDistance[0];
  };

  // Get friendly name for category
  const getCategoryDisplayName = (category: string): string => {
    const nameMap: Record<string, string> = {
      canteen: "Canteen",
      library: "Library",
      medical: "Medical Room",
      restroom_general: "Restroom",
      restroom_men: "Boys Restroom",
      restroom_women: "Girls Restroom",
      staff_room: "Staff Room",
      office_principal: "Principal's Office",
      office_chairman: "Chairman's Office",
      office_hod: "HOD Office",
      office_hod_cse: "CSE HOD Office",
      office_hod_ece: "ECE HOD Office",
      office_hod_mech: "Mechanical HOD Office",
      office_hod_civil: "Civil HOD Office",
      office_hod_it: "IT HOD Office",
      office_hod_aiml: "AI/ML HOD Office",
      office_hod_aids: "AI/DS HOD Office",
      office: "Office",
      accounts: "Accounts Office",
      ground: "Sports Ground",
      gym: "Gymnasium",
      auditorium: "Auditorium",
      auditorium_kaveri: "Kaveri Auditorium",
      auditorium_parthasarathy: "Parthasarathy Auditorium",
      drinking_water: "Drinking Water",
      parking: "Parking Area",
      computer_lab: "Computer Lab",
      gate: "Main Gate",
    };
    return nameMap[category] || category;
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText) return;

    // Mark as interacted
    setHasInteracted(true);

    // Add user message
    addMessage(trimmedText, "user");
    setInputText("");
    setIsTyping(true);

    try {
      // Call the NLP API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText }),
      });

      const data = await response.json();
      const { intent, score } = data;

      // Simulate thinking time
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (intent === "unknown" || !intent || score === 0) {
        // Intent not recognized
        addMessage(
          "I'm sorry, I didn't quite understand that. Could you try rephrasing? For example, say 'Canteen', 'Library', 'Boys Restroom', or 'Principal Office'.",
          "bot"
        );
      } else if (intent == "restroom_general") {
        addMessage(
          "Do you want to go to boys restroom or girls restroom?",
          "bot"
        );
      } else {
        // Check if start location is selected
        if (!selectedFromMapId || !selectedFromNodeId) {
          addMessage(
            "Please select the start location first before I can help you navigate.",
            "bot"
          );
          return;
        }

        // Intent recognized - find nearest node by pathfinding distance
        const result = await findNearestNodeByCategory(intent);

        if (result) {
          const { node, map } = result;
          const displayName = node.name || getCategoryDisplayName(intent);

          // Navigate to the node
          onSetDestination(node.id, map.id);

          addMessage(
            `Great! I'm navigating you to the ${displayName}. ${
              map.name !== "Campus" ? `It's located in ${map.name}.` : ""
            }`,
            "bot"
          );
        } else {
          // Category recognized but no node tagged with it
          addMessage(
            `I understand you're looking for the ${getCategoryDisplayName(
              intent
            )}, but I couldn't find it on the map yet. It might not be tagged in the system. Please ask the admin to tag this location.`,
            "bot"
          );
        }
      }
    } catch (error) {
      console.error("Chatbot error:", error);
      addMessage(
        "Oops! Something went wrong. Please try again in a moment.",
        "bot"
      );
    } finally {
      setIsTyping(false);
    }
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Toggle chat window
  const toggleChat = () => {
    setIsOpen(!isOpen);
    setHasInteracted(true);
  };

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={toggleChat}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white transition-all ${
          isOpen
            ? "bg-red-500 hover:bg-red-600"
            : "bg-indigo-600 hover:bg-indigo-700"
        }`}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        animate={
          !hasInteracted && !isOpen
            ? {
                scale: [1, 1.15, 1],
                transition: {
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 3,
                },
              }
            : {}
        }
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile: Full-screen overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={toggleChat}
            />

            {/* Chat Card */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed z-50 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col
                         md:bottom-24 md:right-6 md:w-[380px] md:h-[600px]
                         bottom-0 left-0 right-0 h-[85vh] max-md:rounded-b-none"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Campus Assistant</h3>
                    <p className="text-xs text-indigo-100">
                      AI-Powered Navigation
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleChat}
                  className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-start gap-2 ${
                      message.sender === "user"
                        ? "flex-row-reverse"
                        : "flex-row"
                    }`}
                  >
                    {/* Avatar */}
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        message.sender === "user"
                          ? "bg-indigo-500 text-white"
                          : "bg-gray-200 text-gray-700"
                      }`}
                    >
                      {message.sender === "user" ? (
                        <User size={18} />
                      ) : (
                        <Bot size={18} />
                      )}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                        message.sender === "user"
                          ? "bg-indigo-500 text-white rounded-tr-sm"
                          : "bg-gray-100 text-gray-800 rounded-tl-sm"
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{message.text}</p>
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {isTyping && (
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center">
                      <Bot size={18} />
                    </div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="flex gap-1">
                        <motion.div
                          className="w-2 h-2 bg-gray-400 rounded-full"
                          animate={{ y: [0, -8, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: 0,
                          }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-gray-400 rounded-full"
                          animate={{ y: [0, -8, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: 0.2,
                          }}
                        />
                        <motion.div
                          className="w-2 h-2 bg-gray-400 rounded-full"
                          animate={{ y: [0, -8, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: 0.4,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t bg-gray-50 p-4 space-y-3 flex-shrink-0">
                {/* From Location Selector */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                    <MapPin size={16} />
                    From
                  </label>

                  <div className="relative">
                    {/* Input/Display Field */}
                    <div
                      onClick={() => setShowFromDropdown(!showFromDropdown)}
                      className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 cursor-pointer transition-all flex items-center gap-2 ${
                        showFromDropdown
                          ? "border-indigo-500 ring-2 ring-indigo-500 bg-white"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />

                      {showFromDropdown ? (
                        <input
                          type="text"
                          value={fromSearchQuery}
                          onChange={(e) => setFromSearchQuery(e.target.value)}
                          placeholder="Search location..."
                          className="flex-1 bg-transparent outline-none text-gray-800 placeholder-gray-400 text-sm"
                          onClick={(e) => e.stopPropagation()}
                          autoFocus
                        />
                      ) : selectedFromMapId && selectedFromNodeId ? (
                        <span className="flex-1 text-gray-800 font-medium text-sm">
                          {getSelectedLocationName()}
                        </span>
                      ) : (
                        <span className="flex-1 text-gray-400 text-sm">
                          Select your location...
                        </span>
                      )}

                      <ChevronDown
                        className={`w-4 h-4 text-gray-400 transition-transform ${
                          showFromDropdown ? "rotate-180" : ""
                        }`}
                      />
                    </div>

                    {/* Dropdown */}
                    {showFromDropdown && (
                      <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {Object.keys(groupedLocations).length === 0 ? (
                          <div className="px-4 py-6 text-center text-gray-500">
                            <Search className="w-6 h-6 mx-auto mb-2 opacity-50" />
                            <p className="text-xs">No locations found</p>
                          </div>
                        ) : (
                          Object.entries(groupedLocations).map(
                            ([mapName, locations]) => (
                              <div key={mapName}>
                                {/* Map Header */}
                                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 sticky top-0">
                                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                    {mapName}
                                  </span>
                                </div>

                                {/* Locations */}
                                {locations.map((loc) => (
                                  <button
                                    key={`${loc.mapId}-${loc.nodeId}`}
                                    onClick={() =>
                                      handleSelectFromLocation(
                                        loc.mapId,
                                        loc.nodeId
                                      )
                                    }
                                    className={`w-full px-4 py-2.5 flex items-center gap-3 hover:bg-indigo-50 transition-colors text-left border-b last:border-b-0 ${
                                      selectedFromNodeId === loc.nodeId
                                        ? "bg-indigo-50"
                                        : ""
                                    }`}
                                  >
                                    <div
                                      className={`w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 ${
                                        loc.type === "ROOM"
                                          ? "bg-blue-100 text-blue-600"
                                          : loc.type === "GATEWAY"
                                          ? "bg-amber-100 text-amber-600"
                                          : "bg-gray-100 text-gray-600"
                                      }`}
                                    >
                                      <MapPin className="w-3 h-3" />
                                    </div>
                                    <span className="text-sm text-gray-800 font-medium">
                                      {loc.nodeName}
                                    </span>
                                    {selectedFromNodeId === loc.nodeId && (
                                      <div className="ml-auto w-2 h-2 rounded-full bg-indigo-600" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Message Input */}
                <div className="flex items-center gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Type your destination..."
                    disabled={isTyping}
                    className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed text-sm text-gray-800"
                  />
                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || isTyping}
                    className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>

                {/* Quick Suggestions */}
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {["Canteen", "Library", "Restroom"].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => {
                        setInputText(suggestion);
                        inputRef.current?.focus();
                      }}
                      className="px-3 py-1 text-xs rounded-full bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
