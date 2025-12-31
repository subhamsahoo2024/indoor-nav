# Indoor Navigation System - Copilot Instructions

## Project Overview
An Indoor Navigation System for a college campus using Multi-Map Navigation with Gateway Nodes.

## Tech Stack
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (Strict mode enabled)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Graphics**: HTML5 Canvas

## Architecture Guidelines
- Use App Router conventions (`app/` directory inside `src/`)
- Implement strict TypeScript types for all graph structures
- Gateway Nodes connect different maps (Campus → Building → Floor)
- Navigation algorithms must support cross-map pathfinding

## Code Standards
- No placeholder comments - write complete, working code
- Use TypeScript strict mode
- Follow Next.js 14+ best practices
- Implement proper error handling

## Key Concepts
- **Multi-Map Navigation**: Routes across Campus, Building, and Floor maps
- **Gateway Nodes**: Connection points between different map levels
- **Graph Algorithms**: Pathfinding using Dijkstra or A* across connected graphs
