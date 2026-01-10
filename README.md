# Indoor Navigation System

A comprehensive indoor navigation system for college campuses featuring multi-map navigation, AI-powered chatbot assistance, and QR code integration for seamless wayfinding.

## Tech Stack

- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript (Strict mode)
- **Styling**: Tailwind CSS
- **UI Library**: Framer Motion for animations
- **Database**: MongoDB with Mongoose
- **Graphics**: HTML5 Canvas for map rendering
- **NLP**: Brain.js for natural language processing

## Key Features

### Navigation

- 🗺️ **Multi-Map Navigation** - Navigate across Campus, Building, and Floor levels
- 🚪 **Gateway Nodes** - Seamless transitions between different map levels
- 🎯 **Pathfinding** - Advanced graph-based algorithms (Dijkstra) with cross-map routing
- 📍 **QR Code Integration** - Scan QR codes to instantly set your starting location
- 🔍 **Smart Search** - Global search across all locations without needing to select buildings first

### AI Chatbot

- 🤖 **Natural Language Understanding** - Ask in plain language like "Where is the canteen?" or "Take me to library"
- 🧠 **Intent Recognition** - Understands 30+ location categories and destinations
- 📍 **Location-Aware** - Finds nearest destination based on your current location
- 💬 **Conversational Interface** - Friendly, animated chat experience

### Admin Dashboard

- 🎨 **Visual Map Editor** - Upload and edit maps with an intuitive canvas interface
- ➕ **Node Management** - Add, edit, and delete nodes with drag-and-drop
- 🔗 **Edge Creation** - Connect nodes with weighted edges for pathfinding
- 🏷️ **Category Tagging** - Tag locations for chatbot recognition (canteen, library, etc.)
- 📤 **Map Upload** - Support for PNG/JPG map images

### User Experience

- 📱 **Mobile Responsive** - Fully optimized for mobile devices
- ✨ **Smooth Animations** - Polished UI with Framer Motion
- 🎯 **Real-time Routing** - Dynamic path visualization on canvas
- 🔄 **Path Highlighting** - Clear visual guidance with animated paths

## Getting Started

### Prerequisites

- Node.js 18.17 or later
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd project1
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

Edit `.env` :

```env
MONGODB_URI=mongodb://localhost:27017/indoor-navigation
# or for MongoDB Atlas:
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/indoor-navigation

# Enable database mode (set to "true" to use MongoDB, "false" for mock data)
NEXT_PUBLIC_USE_DATABASE=true or false
```

4. Seed the database (optional):

```bash
# Access http://localhost:3000/api/seed after starting dev server
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
├── app/
│   ├── page.tsx              # Landing page
│   ├── navigate/             # User navigation interface
│   ├── admin/                # Admin dashboard
│   │   └── map/[id]/        # Map editor
│   └── api/
│       ├── chat/            # NLP chatbot API
│       ├── maps/            # Map CRUD operations
│       ├── seed/            # Database seeding
│       └── upload/          # Image upload handling
├── components/
│   ├── IndoorNavigation.tsx  # Main navigation canvas component
│   ├── LocationSelector.tsx  # Location search & selection
│   ├── AIChatbot.tsx        # AI chat interface
│   └── admin/
│       └── MapEditor.tsx    # Visual map editor
├── lib/
│   ├── db.ts                # MongoDB connection
│   ├── mapService.ts        # Map data services
│   └── pathfinder.ts        # Pathfinding algorithms
├── models/
│   └── Map.ts               # MongoDB schema
├── types/
│   └── navigation.ts        # TypeScript definitions
└── data/
    └── mockGraph.ts         # Sample data structure
```

## Architecture

### Multi-Map Navigation

The system uses a hierarchical map structure with three levels:

1. **Campus Map** - Overview of the entire campus with buildings
2. **Building Maps** - Individual building layouts with floors
3. **Floor Maps** - Detailed floor plans with rooms and corridors

### Gateway Nodes

Gateway Nodes are special connection points that:

- Link different map levels together
- Enable cross-map pathfinding
- Represent entrances, staircases, elevators, and building connections
- Allow seamless navigation from campus level to specific rooms

Example: Campus Gate → Building A Entrance → Floor 2 Staircase → Room 201

### Pathfinding Algorithm

- Uses **Dijkstra's algorithm** for optimal path calculation
- Supports **cross-map routing** through gateway nodes
- Handles **weighted edges** for distance calculation
- Provides **step-by-step directions** with map transitions

### AI Chatbot System

The chatbot uses a trained neural network (Brain.js) to:

1. Process user input in natural language
2. Recognize intent from 30+ categories (canteen, library, restrooms, offices, etc.)
3. Find the nearest matching location based on current position
4. Provide conversational navigation guidance

Supported categories include:

- Facilities: Canteen, Library, Medical Room, Auditorium, Gym
- Restrooms: General, Men's, Women's
- Offices: Principal, Chairman, HOD (various departments)
- Utilities: Drinking Water, Parking
- Academic: Computer Labs, Classrooms

## API Routes

### Maps

- `GET /api/maps` - List all maps
- `GET /api/maps/[id]` - Get specific map details
- `POST /api/maps` - Create new map
- `PUT /api/maps/[id]` - Update map
- `DELETE /api/maps/[id]` - Delete map

### Chat

- `POST /api/chat` - Process natural language query

### Upload

- `POST /api/upload` - Upload map image

### Seed

- `GET /api/seed` - Initialize database with sample data

## Usage Guide

### For Users

1. **Start Navigation**:

   - Visit `/navigate`
   - Scan a QR code OR manually select your starting location
   - Search for your destination
   - Click "Start Navigation"

2. **Use AI Chatbot**:
   - Click the chat button
   - Select your starting location from the dropdown
   - Type your destination (e.g., "canteen", "library")
   - Follow the generated route

### For Admins

1. **Create a Map**:

   - Go to `/admin`
   - Click "Add New Map"
   - Upload a map image
   - Enter map details (name, type, parent)

2. **Edit Nodes & Edges**:

   - Click on a map to edit
   - Add nodes by clicking on the map
   - Connect nodes by dragging between them
   - Set node properties (name, type, category)
   - Assign edge weights for accurate pathfinding

3. **Tag for Chatbot**:
   - Select a node in the editor
   - Choose the appropriate category
   - Save to make it discoverable via chatbot

## Database Schema

### Map Collection

```typescript
{
  id: string;              // Unique identifier
  name: string;            // Map name
  type: 'CAMPUS' | 'BUILDING' | 'FLOOR';
  parentId?: string;       // Parent map reference
  imageUrl: string;        // Path to map image
  width: number;           // Canvas width
  height: number;          // Canvas height
  nodes: Node[];           // Navigation points
  edges: Edge[];           // Connections between nodes
}
```

### Node Structure

```typescript
{
  id: string;
  x: number;               // Canvas position
  y: number;
  name: string;
  type: 'GATEWAY' | 'ROOM' | 'POINT';
  category?: string;       // For chatbot recognition
  connectedMapId?: string; // For gateway nodes
  connectedNodeId?: string;
}
```

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions, please open an issue on the GitHub repository.
