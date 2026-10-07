import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || "clinic_agent";

if (!uri) {
  throw new Error("MONGODB_URI is missing in .env");
}

const client = new MongoClient(uri);
let db;

export async function connectDB() {
  if (db) return db;

  await client.connect();
  db = client.db(dbName);

  console.log(`MongoDB connected: ${dbName}`);
  return db;
}

export function getDB() {
  if (!db) throw new Error("Database is not connected");
  return db;
}

export function getClient() {
  return client;
}
