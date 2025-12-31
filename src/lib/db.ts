import mongoose, { Mongoose } from "mongoose";

/**
 * MongoDB Connection Helper
 *
 * Implements connection caching to prevent multiple connections in development mode.
 * In development, Next.js clears Node.js cache on every request, which would
 * create new database connections. This helper caches the connection.
 */

const MONGODB_URI = process.env.MONGODB_URI;

/**
 * Global type declaration for mongoose cache
 */
interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var mongooseCache: MongooseCache | undefined;
}

/**
 * Cached connection object
 */
let cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Connect to MongoDB with connection caching
 *
 * @returns Promise resolving to mongoose connection
 */
async function dbConnect(): Promise<Mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "Please define the MONGODB_URI environment variable inside .env.local"
    );
  }

  // Return cached connection if available
  if (cached.conn) {
    return cached.conn;
  }

  // Create new connection if no cached promise exists
  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose
      .connect(MONGODB_URI, opts)
      .then((mongooseInstance) => {
        console.log("✅ MongoDB connected successfully");
        return mongooseInstance;
      });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

export default dbConnect;

/**
 * Check if MongoDB is connected
 */
export function isConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

/**
 * Disconnect from MongoDB (useful for testing)
 */
export async function disconnect(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
