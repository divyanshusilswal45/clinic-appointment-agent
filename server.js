import express from "express";
import dotenv from "dotenv";
import { connectDB } from "./db.js";
import { runAgent } from "./agent.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));

app.post("/api/chat", async (req, res) => {
  try {
    const message = String(req.body?.message || "").trim();

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const answer = await runAgent(message);

    res.json({ answer });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Something went wrong."
    });
  }
});

app.get("/api/health", async (_req, res) => {
  res.json({
    ok: true,
    service: "Clinic Appointment Agent"
  });
});

await connectDB();

app.listen(PORT, () => {
  console.log(`Clinic Agent running at http://localhost:${PORT}`);
});
