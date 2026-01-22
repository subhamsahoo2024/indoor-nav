// app/navigate/page.tsx

"use client";

import { useState, useCallback, useEffect, Suspense } from "react";
import { RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import IndoorNavigation from "@/components/IndoorNavigation";
import LocationSelector from "@/components/LocationSelector";
import AIChatbot from "@/components/AIChatbot";
import { getAllMaps } from "@/lib/mapService";
import type { MapData } from "@/types/navigation";

// ... [Types remain unchanged]


export default function NavigatePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading Navigation...</div>}>
      <NavigatePageContent />
    </Suspense>
  );
}

function NavigatePageContent() {
  const router = useRouter();
  const [navState, setNavState] = useState<NavigationState>({
    startNode: null,
    endNode: null,
    isNavigating: false,
  });

  const [allMaps, setAllMaps] = useState<MapData[]>([]);
  const [isLoadingMaps, setIsLoadingMaps] = useState(true);
  const [butterflies, setButterflies] = useState<Butterfly[]>([]);

  useEffect(() => {
    const loadMaps = async () => {
      try {
        const maps = await getAllMaps();
        setAllMaps(maps);
      } catch (error) {
        console.error("Failed to load maps:", error);
      } finally {
        setIsLoadingMaps(false);
      }
    };
    loadMaps();
  }, []);

  const triggerButterflies = () => {
    setButterflies([]);
    const butterflyImages = ["/butterfly-Photoroom.png", "/bb-photoroom.png"];
    const sizePool: number[] = [...Array(7).fill(0.4), ...Array(20).fill(1.0), ...Array(7).fill(1.8)];
    const shuffledSizes = sizePool.sort(() => Math.random() - 0.5);

    setTimeout(() => {
      const count = shuffledSizes.length; 
      const newButterflies = shuffledSizes.map((assignedSize, i) => {
        const angle = (i / count) * Math.PI * 2 + (Math.random() * 0.5);
        const distance = 250 + Math.random() * 350;
        return {
          id: Date.now() + i,
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          rotation: (angle * 180) / Math.PI + 90,
          size: assignedSize + (Math.random() * 0.2),
          duration: 1.5 + Math.random() * 1.0, 
          image: butterflyImages[Math.floor(Math.random() * butterflyImages.length)]
        };
      });
      setButterflies(newButterflies);
    }, 10);
    setTimeout(() => setButterflies([]), 3000);
  };

  const handleManualSelection = useCallback((startMapId: string, startNodeId: string, endMapId: string, endNodeId: string) => {
    setNavState({
      startNode: { mapId: startMapId, nodeId: startNodeId },
      endNode: { mapId: endMapId, nodeId: endNodeId },
      isNavigating: true,
    });
  }, []);

  const handleReset = useCallback(() => {
    setNavState({ startNode: null, endNode: null, isNavigating: false });
    router.push("/navigate");
  }, [router]);

  const getNodeName = useCallback((location: LocationPoint | null): string => {
    if (!location) return "Not selected";
    const map = allMaps.find((m) => m.id === location.mapId);
    const node = map?.nodes.find((n) => n.id === location.nodeId);
    return node?.name || location.nodeId;
  }, [allMaps]);

  return (
    <div className="relative">
      {/* Changed pb-1 to pb-6 to lift the credits section higher */}
      <main className={`min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 px-4 relative overflow-hidden flex flex-col ${!navState.isNavigating ? 'pt-0 pb-6' : 'h-screen'}`}>
        
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="flex-grow">
          {!navState.isNavigating ? (
            <div className="relative z-10">
              {/* ... [Butterfly and Logo Section remains unchanged] */}
              <div className="flex justify-center mb-8 mt-8 relative">
                <div className="absolute inset-0 pointer-events-none z-[100] flex items-center justify-center">
                  <AnimatePresence mode="popLayout">
                    {butterflies.map((b) => (
                      <motion.div
                        key={b.id}
                        initial={{ opacity: 1, scale: 0.1, x: 0, y: 0 }}
                        animate={{ opacity: 0, scale: b.size, x: b.x, y: b.y, rotate: b.rotation }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: b.duration, ease: "easeOut" }}
                        className="absolute"
                      >
                        <img src={b.image} alt="" style={{ width: `${40 * b.size}px`, height: 'auto' }} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <motion.div className="max-w-[140px] sm:max-w-[170px] cursor-pointer relative z-20" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={triggerButterflies}>
                  <img src="/navigation-logo.png" alt="Logo" className="w-full h-auto drop-shadow-2xl select-none" />
                </motion.div>
              </div>

              <div className="text-center mb-6 sm:mb-12 animate-fadeInUp delay-200">
                <h1 className="font-[family-name:var(--font-orbitron)] text-3xl sm:text-5xl font-bold text-sky-200 mb-4 tracking-wide uppercase">
                  NavX Smart Navigation
                </h1>
                <p className="font-[family-name:var(--font-space-grotesk)] text-sm sm:text-lg text-slate-400">
                  Find your way around the indoor spaces with NavX
                </p>
              </div>

              <LocationSelector
                onStartNavigation={handleManualSelection}
                initialStartMapId={navState.startNode?.mapId}
                initialStartNodeId={navState.startNode?.nodeId}
                initialEndMapId={navState.endNode?.mapId}
                initialEndNodeId={navState.endNode?.nodeId}
                onNavigationTrigger={() => setNavState(prev => ({ ...prev, isNavigating: true }))}
              />
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* ... [Navigation View remains unchanged] */}
              <div className="bg-white/5 backdrop-blur-sm border-b border-white/10 p-3 flex items-center justify-between relative z-20">
                <button onClick={handleReset} className="flex items-center gap-2 px-4 py-2 text-cyan-400 hover:bg-white/10 rounded-lg transition-all border border-white/10"><RotateCcw className="w-4 h-4" /><span className="text-sm font-medium">New Route</span></button>
                <div className="text-center"><h1 className="text-sm sm:text-lg font-semibold text-white">Navigating to <span className="text-cyan-400">{getNodeName(navState.endNode)}</span></h1></div>
                <Link href="/" className="px-4 py-2 text-slate-300 border border-white/10 rounded-lg hover:bg-white/10"><Home className="w-4 h-4" /></Link>
              </div>
              <div className="flex-1 overflow-hidden relative z-10">
                {navState.startNode && navState.endNode && (
                  <IndoorNavigation startMapId={navState.startNode.mapId} startNodeId={navState.startNode.nodeId} endMapId={navState.endNode.mapId} endNodeId={navState.endNode.nodeId} animationSpeed={1} showLabels={true} />
                )}
              </div>
            </div>
          )}
        </div>

        {/* Changed pb-1 to pb-4 and pt-2 to pt-4 to move credits further up from the bottom */}
        <div className="pt-4 pb-4 text-center relative z-10 px-4 sm:px-0 pr-20 sm:pr-0">
          <p className="text-slate-500 text-[10px] sm:text-sm font-medium tracking-wide leading-relaxed">
            Developed by Sriram B, Subham Sahoo S, Thejas SB <br className="sm:hidden" /> @ Techsprint GDG CIT
          </p>
        </div>
      </main>

      {!navState.isNavigating && (
        <div className="fixed bottom-6 right-6 z-[100] pointer-events-auto">
          {!isLoadingMaps && allMaps.length > 0 && (
            <AIChatbot onSetDestination={(nodeId, mapId) => setNavState(prev => ({ ...prev, endNode: { nodeId, mapId } }))} onSetCurrentLocation={(nodeId, mapId) => setNavState(prev => ({ ...prev, startNode: { nodeId, mapId } }))} allMaps={allMaps} />
          )}
        </div>
      )}
    </div>
  );
}