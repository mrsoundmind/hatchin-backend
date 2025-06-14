// index.js (simplified, only exact paths)

const express = require("express");
const cors = require("cors");
const OpenAI = require("openai");
require("dotenv").config();

const { buildSystemPrompt } = require("./ai");
const exampleInteractions = require("./exampleInteractions");
const { detectUserType } = require("./aiPromptTemplate");

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for all origins
app.use(cors());
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
    return res
      .status(400)
      .json({
        error: "Missing required fields: projectId, hatchName, or message.",
      });
  }

  try {
    const behaviorType = detectUserType(message);
    const finalUserProfile = { ...userProfile, behaviorType };

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

    return res.json({ reply: resp.choices[0].message.content.trim() });
  } catch (err) {
    console.error("OpenAI error:", err);
    return res.status(500).json({ error: "OpenAI error." });
  }
});

app.listen(port, () => {
  console.log(`✅ Hatchin backend running at http://localhost:${port}`);
});
