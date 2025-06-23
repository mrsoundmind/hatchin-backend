// index.js (with manual CORS & preflight handling)

const express = require("express");
const OpenAI = require("openai");
require("dotenv").config();

const { buildSystemPrompt } = require("./ai");
const exampleInteractions = require("./exampleInteractions");
const { detectUserType } = require("./aiPromptTemplate");

const app = express();
const port = process.env.PORT || 3000;

// 🛡️ Manual CORS & preflight handling
app.use((req, res, next) => {
  // Allow requests from anywhere (or replace "*" with "https://www.figma.com" if needed)
  res.header("Access-Control-Allow-Origin", "*");
  // Allow these HTTP methods
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  // Allow these request headers
  res.header("Access-Control-Allow-Headers", "Content-Type");
  // If this is a preflight OPTIONS request, end it here
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Health endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK" });
});

// Chat endpoint
app.post("/api/message", async (req, res) => {
  const {
    projectId,
    hatchName,
    message,
    projectSummary = "",
    currentTask = "",
    userProfile = {},
    shortTermMemory = "",
    longTermMemory = "",
    lastMessages = "",
    recentHatchMessages = "",
    taskList = "",
    projectMilestones = "",
    teamDescription = "",
    leadershipNotes = "",
  } = req.body;

  if (!projectId || !hatchName || !message) {
    return res.status(400).json({
      error: "Missing required fields: projectId, hatchName, or message.",
    });
  }

  try {
    // Add behaviorType to userProfile
    const behaviorType = detectUserType(message);
    const finalUserProfile = { ...userProfile, behaviorType };

    // Build the system prompt with all context
    const systemPrompt = buildSystemPrompt({
      hatchName,
      projectSummary,
      currentTask,
      userProfile: finalUserProfile,
      shortTermMemory,
      longTermMemory,
      lastMessages,
      recentHatchMessages,
      taskList,
      projectMilestones,
      teamDescription,
      leadershipNotes,
      fewShotExamples: exampleInteractions,
    });

    // Initialize OpenAI and send the prompt
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: "gpt-4",
      temperature: 0.7,
      top_p: 0.9,
      frequency_penalty: 0.2,
      presence_penalty: 0.1,
      max_tokens: 500,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
    });

    // Return the trimmed reply
    return res.json({ reply: resp.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(500).json({ error: "OpenAI error." });
  }
});

app.listen(port, () => {
  console.log(`✅ Hatchin backend running at http://localhost:${port}`);
});
