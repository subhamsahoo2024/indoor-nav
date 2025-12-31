# Indoor Navigation System

An Indoor Navigation System for a college campus using Multi-Map Navigation with Gateway Nodes.

## Tech Stack

- **Framework**: Next.js 16+ (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Graphics**: HTML5 Canvas

## Features

- Multi-Map Navigation across Campus, Building, and Floor levels
- Gateway Nodes for seamless transitions between maps
- Graph-based pathfinding algorithms
- Interactive canvas-based map rendering

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
```

### Production

```bash
npm start
```

## Project Structure

```
src/
├── app/           # Next.js App Router pages
├── components/    # React components (to be created)
├── lib/           # Utilities and graph algorithms (to be created)
├── store/         # Zustand state management (to be created)
└── types/         # TypeScript type definitions (to be created)
```

## Architecture

### Multi-Map Navigation

The system uses a hierarchical map structure:

- **Campus Map**: Overview of the entire campus
- **Building Maps**: Individual building layouts
- **Floor Maps**: Detailed floor plans with rooms and corridors

### Gateway Nodes

Gateway Nodes are special connection points that link different maps together, enabling seamless navigation from one map level to another (e.g., from campus entrance to a specific room on the 3rd floor of a building).
