"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
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
  const [selectedFromMapId, setSelectedFromMapId] = useState<string | null>(null);
  const [selectedFromNodeId, setSelectedFromNodeId] = useState<string | null>(null);
  const [fromSearchQuery, setFromSearchQuery] = useState("");
  const [showFromDropdown, setShowFromDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const addMessage = (text: string, sender: "user" | "bot") => {
    const newMessage: Message = {
      id: Date.now().toString() + Math.random(),
      text,
      sender,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
  };

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

  const filteredLocations = useMemo(() => {
    if (!fromSearchQuery.trim()) return getAllLocations;
    const query = fromSearchQuery.toLowerCase();
    return getAllLocations.filter(
      (loc) =>
        loc.nodeName.toLowerCase().includes(query) ||
        loc.mapName.toLowerCase().includes(query)
    );
  }, [getAllLocations, fromSearchQuery]);

  const groupedLocations = useMemo(() => {
    const groups: Record<string, any[]> = {};
    filteredLocations.forEach((loc) => {
      if (!groups[loc.mapName]) groups[loc.mapName] = [];
      groups[loc.mapName].push(loc);
    });
    return groups;
  }, [filteredLocations]);

  const handleSelectFromLocation = useCallback(
    (mapId: string, nodeId: string) => {
      setSelectedFromMapId(mapId);
      setSelectedFromNodeId(nodeId);
      setShowFromDropdown(false);
      setFromSearchQuery("");
      if (onSetCurrentLocation) onSetCurrentLocation(nodeId, mapId);
    },
    [onSetCurrentLocation]
  );

  const getSelectedLocationName = useCallback(() => {
    if (!selectedFromMapId || !selectedFromNodeId) return null;
    const map = allMaps.find((m) => m.id === selectedFromMapId);
    const node = map?.nodes.find((n) => n.id === selectedFromNodeId);
    return node ? `${node.name} (${map?.name})` : null;
  }, [selectedFromMapId, selectedFromNodeId, allMaps]);

  const findNearestNodeByCategory = async (category: string) => {
    const allMatches: Array<{ node: Node; map: MapData }> = [];
    for (const map of allMaps) {
      const matchingNodes = map.nodes.filter((node) => node.category === category);
      for (const node of matchingNodes) allMatches.push({ node, map });
    }
    if (allMatches.length === 0) return null;
    if (allMatches.length === 1 || !selectedFromMapId || !selectedFromNodeId) return allMatches[0];

    const matchesWithDistance = await Promise.all(
      allMatches.map(async (match) => {
        try {
          const pathResult = await generateNavigationPath(
            selectedFromMapId!, selectedFromNodeId!, match.map.id, match.node.id
          );
          return { ...match, distance: pathResult.success ? pathResult.totalNodes : Infinity };
        } catch {
          return { ...match, distance: Infinity };
        }
      })
    );
    matchesWithDistance.sort((a, b) => a.distance - b.distance);
    return matchesWithDistance[0];
  };

  const handleSendMessage = async () => {
    const trimmedText = inputText.trim();
    if (!trimmedText) return;
    setHasInteracted(true);
    addMessage(trimmedText, "user");
    setInputText("");
    setIsTyping(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmedText }),
      });
      const data = await response.json();
      const { intent, score } = data;
      await new Promise((resolve) => setTimeout(resolve, 800));

      if (intent === "unknown" || !intent || score === 0) {
        addMessage("I'm sorry, I didn't quite understand that. Try 'Canteen' or 'Library'.", "bot");
      } else if (intent === "restroom_general") {
        addMessage("Do you want to go to boys restroom or girls restroom?", "bot");
      } else {
        if (!selectedFromMapId || !selectedFromNodeId) {
          addMessage("Please select the start location first!", "bot");
          return;
        }
        const result = await findNearestNodeByCategory(intent);
        if (result) {
          onSetDestination(result.node.id, result.map.id);
          addMessage(`Great! I'm navigating you to the ${result.node.name}.`, "bot");
        } else {
          addMessage("I couldn't find that location on the map yet.", "bot");
        }
      }
    } catch {
      addMessage("Oops! Something went wrong.", "bot");
    } finally {
      setIsTyping(false);
    }
  };

  const toggleChat = () => { setIsOpen(!isOpen); setHasInteracted(true); };

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const id = "ai-chatbot-portal";
    let el = document.getElementById(id) as HTMLElement | null;
    if (!el) {
      el = document.createElement("div"); el.id = id; document.body.appendChild(el);
    }
    setPortalEl(el);
  }, []);

  const fab = (
    <motion.button
      onClick={toggleChat}
      className={`fixed bottom-6 right-6 z-[9999] w-20 h-20 rounded-full shadow-2xl flex items-center justify-center text-white transition-all ${
        isOpen ? "bg-red-500 hover:bg-red-600" : "bg-transparent"
      }`}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
    >
      {isOpen ? <X size={28} /> : (
        <>
          <motion.span
            className="absolute inset-0 flex items-center justify-center"
            animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0.1, 0.6] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="block w-24 h-24 rounded-full bg-blue-400/40 blur-lg" />
          </motion.span>
          <motion.div
            className="relative z-10 flex items-center justify-center"
            animate={{ scale: [1, 1.35, 1] }} 
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image 
              src="/fantastic-4-bot.png" 
              alt="Chatbot" 
              width={80} 
              height={80} 
              className="rounded-full drop-shadow-2xl" 
            />
          </motion.div>
        </>
      )}
    </motion.button>
  );

  return (
    <div className="relative">
      {portalEl ? createPortal(fab, portalEl) : fab}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={toggleChat}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed z-50 bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col
                         md:bottom-28 md:right-6 md:w-[380px] md:h-[600px]
                         bottom-0 left-0 right-0 h-[85vh] max-md:rounded-b-none"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-4 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"><Sparkles size={20} /></div>
                  <div>
                    <h3 className="font-semibold text-lg">Campus Assistant</h3>
                    <p className="text-xs text-indigo-100">AI-Powered Navigation</p>
                  </div>
                </div>
                <button onClick={toggleChat} className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center"><X size={20} /></button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.map((m) => (
                  <div key={m.id} className={`flex items-start gap-2 ${m.sender === "user" ? "flex-row-reverse" : "flex-row"}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${m.sender === "user" ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-700"}`}>
                      {m.sender === "user" ? <User size={18} /> : <Bot size={18} />}
                    </div>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${m.sender === "user" ? "bg-indigo-500 text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                      <p className="text-sm leading-relaxed">{m.text}</p>
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex items-start gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center"><Bot size={18} /></div>
                    <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                       <div className="flex gap-1">
                         {[0, 0.2, 0.4].map((d) => (
                           <motion.div key={d} className="w-2 h-2 bg-gray-400 rounded-full" animate={{ y: [0, -8, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: d }} />
                         ))}
                       </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t bg-gray-50 p-4 space-y-3 flex-shrink-0">
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-700"><MapPin size={16} /> From</label>
                  <div className="relative">
                    {/* ONLY OPEN DROPDOWN ON CLICK OF THIS BOX */}
                    <div onClick={() => setShowFromDropdown(!showFromDropdown)} className={`w-full px-4 py-2.5 border rounded-lg bg-gray-50 cursor-pointer flex items-center gap-2 ${showFromDropdown ? "border-indigo-500 ring-2 ring-indigo-500 bg-white" : "border-gray-200"}`}>
                      <Search className="w-4 h-4 text-gray-400" />
                      {showFromDropdown ? (
                        <input type="text" value={fromSearchQuery} onChange={(e) => setFromSearchQuery(e.target.value)} placeholder="Search location..." className="flex-1 bg-transparent outline-none text-sm text-black placeholder:text-gray-400" onClick={(e) => e.stopPropagation()} autoFocus />
                      ) : (
                        <span className={`flex-1 text-sm ${selectedFromNodeId ? "text-black" : "text-gray-400"}`}>{getSelectedLocationName() || "Select your location..."}</span>
                      )}
                      <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFromDropdown ? "rotate-180" : ""}`} />
                    </div>

                    {/* UPDATED: DROPDOWN OPENS UPWARD ABOVE THE BOX */}
                    {showFromDropdown && (
                      <div className="absolute bottom-full mb-2 z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                        {Object.entries(groupedLocations).map(([mapName, locs]) => (
                          <div key={mapName}>
                            <div className="px-3 py-2 bg-gray-50 text-xs font-bold text-gray-500 uppercase">{mapName}</div>
                            {locs.map((loc) => (
                              /* FIXED: Labels now strictly pure black for visibility */
                              <button key={loc.nodeId} onClick={() => handleSelectFromLocation(loc.mapId, loc.nodeId)} className={`w-full px-4 py-2 text-sm text-black font-medium text-left hover:bg-indigo-50 flex items-center gap-2 ${selectedFromNodeId === loc.nodeId ? "bg-indigo-50" : ""}`}>
                                <MapPin size={12} className="text-gray-400" /> {loc.nodeName}
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} placeholder="Type destination..." disabled={isTyping} className="flex-1 px-4 py-2.5 rounded-full border border-gray-300 text-sm text-black" />
                  <button onClick={handleSendMessage} disabled={!inputText.trim() || isTyping} className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center disabled:bg-gray-300"><Send size={18} /></button>
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {["Canteen", "Library", "Restroom"].map((s) => (
                    <button key={s} onClick={() => setInputText(s)} className="px-3 py-1 text-xs rounded-full bg-white border border-gray-300 text-black font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap">{s}</button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}