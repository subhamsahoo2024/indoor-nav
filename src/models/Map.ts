import mongoose, { Schema, Document, Model } from "mongoose";
import type {
  MapData,
  Node,
  Edge,
  NodeType,
  GatewayConfig,
} from "@/types/navigation";

/**
 * MongoDB Document interface extending MapData
 */
export interface IMapDocument extends Omit<MapData, "adjacencyList">, Document {
  adjacencyList: Map<string, Edge[]>;
  createdAt: Date;
  updatedAt: Date;
  toMapData(): MapData;
}

/**
 * Gateway Configuration Sub-Schema
 */
const GatewayConfigSchema = new Schema(
  {
    targetMapId: {
      type: String,
      required: true,
    },
    targetNodeId: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

/**
 * Node Sub-Schema
 * Represents a navigation point on a map
 */
const NodeSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
    },
    x: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    y: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    type: {
      type: String,
      enum: ["NORMAL", "ROOM", "GATEWAY"] as NodeType[],
      required: true,
      default: "NORMAL",
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: false,
    },
    gatewayConfig: {
      type: GatewayConfigSchema,
      required: false,
    },
  },
  { _id: false }
);

/**
 * Edge Sub-Schema
 * Represents a connection between two nodes
 */
const EdgeSchema = new Schema(
  {
    targetNodeId: {
      type: String,
      required: true,
    },
    weight: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

/**
 * Main Map Schema
 */
const MapSchema = new Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    nodes: {
      type: [NodeSchema],
      default: [],
    },
    adjacencyList: {
      type: Map,
      of: [EdgeSchema],
      default: new Map(),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        // Convert Map to plain object for JSON serialization
        if (ret.adjacencyList instanceof Map) {
          ret.adjacencyList = Object.fromEntries(
            ret.adjacencyList as Map<string, Edge[]>
          );
        }
        // Remove mongoose-specific fields
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: (_doc, ret: Record<string, unknown>) => {
        if (ret.adjacencyList instanceof Map) {
          ret.adjacencyList = Object.fromEntries(
            ret.adjacencyList as Map<string, Edge[]>
          );
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

/**
 * Static method to find map by custom id field
 */
MapSchema.statics.findByMapId = function (mapId: string) {
  return this.findOne({ id: mapId });
};

/**
 * Instance method to convert to MapData interface
 */
MapSchema.methods.toMapData = function (): MapData {
  const obj = this.toObject();
  return {
    id: obj.id,
    name: obj.name,
    imageUrl: obj.imageUrl,
    nodes: obj.nodes,
    adjacencyList: obj.adjacencyList,
  };
};

/**
 * Map Model
 * Check if model already exists (for hot reloading in development)
 */
const MapModel: Model<IMapDocument> =
  mongoose.models.Map || mongoose.model<IMapDocument>("Map", MapSchema);

export default MapModel;

/**
 * Helper function to convert plain object adjacencyList to Map
 */
export function toMongooseAdjacencyList(
  adjacencyList: Record<string, Edge[]>
): Map<string, Edge[]> {
  return new Map(Object.entries(adjacencyList));
}

/**
 * Helper function to convert Map adjacencyList to plain object
 */
export function fromMongooseAdjacencyList(
  adjacencyList: Map<string, Edge[]>
): Record<string, Edge[]> {
  return Object.fromEntries(adjacencyList);
}
