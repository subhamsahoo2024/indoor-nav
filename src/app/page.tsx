// app/page.tsx
"use client";

import { useState } from "react";
import IndoorNavigation from "@/components/IndoorNavigation";

export default function Home() {
  // Use IDs from mockGraph.ts
  // Scenario: Campus Main Gate -> Dean's Office (Multi-map route)
  // Route: campus_main -> block_a_lobby -> floor_1
  const [startMapId] = useState("citarmap");
  const [startNodeId] = useState("node_1767198436753_eglpb0yer");
  const [endMapId] = useState("fivehundreds");
  const [endNodeId] = useState("node_1767198959579_6a6brwe7p");

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-8 bg-gray-100">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-2xl font-bold">Campus Navigation Demo</h1>
        <p>Route: Main Gate → Dean&apos;s Office</p>
      </div>

      {/* CRITICAL: The parent container MUST have a defined height/width 
         or the absolute positioning of the map will collapse to 0px.
      */}
      <div className="relative w-full h-[600px] border-2 border-gray-300 rounded-xl overflow-hidden shadow-2xl bg-white">
        <IndoorNavigation
          startMapId={startMapId}
          startNodeId={startNodeId}
          endMapId={endMapId}
          endNodeId={endNodeId}
          animationSpeed={1}
          showLabels={true}
        />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Reset Simulation
        </button>
      </div>
    </main>
  );
}
