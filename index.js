// index.js

const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch"); // تأكد أنك ثبت node-fetch@2

const app = express();
const port = process.env.PORT || 10000;

// Middleware
app.use(cors({ origin: "*" }));
app.use(express.json());

// Logging للمسارات والـ body
app.use((req, res, next) => {
  console.log(`→ ${req.method} ${req.url}`, "BODY:", req.body || "");
  next();
});

// POST /api/analyze
app.post("/api/analyze", async (req, res, next) => {
  try {
    const { userId, answers } = req.body;
    const prompt = `
User ID: ${userId}
IQ Test Data:
${answers.map(a => `- Q${a.questionId}: ${a.correct ? "✔️" : "❌"}, time ${a.responseTime}s`).join("\n")}
Compute:
1. Estimated IQ (µ=100,σ=15)
2. Classification
3. Feedback
4. Three exercises
Respond in JSON.
`;

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 30000000 } })
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      return res.status(hfRes.status).json({ success: false, error: errText });
    }

    const hfData = await hfRes.json();
    // استخراج النص المولد
    const textOutput =
      typeof hfData === "string"
        ? hfData
        : hfData.generated_text ||
          (Array.isArray(hfData) && hfData[0]?.generated_text);

    if (!textOutput) {
      return res
        .status(500)
        .json({ success: false, error: "No generated_text in response", raw: hfData });
    }

    // اقتطاع أي نص قبل أول { لتحويل JSON
    const idx = textOutput.indexOf("{");
    const jsonText = idx >= 0 ? textOutput.slice(idx) : textOutput;

    let analysis;
    try {
      analysis = JSON.parse(jsonText.trim());
    } catch {
      return res
        .status(200)
        .json({ success: false, error: "Invalid JSON from model", raw: textOutput });
    }

    res.json({ success: true, analysis });
  } catch (err) {
    next(err);
  }
});

// POST /api/chat
app.post("/api/chat", async (req, res, next) => {
  try {
    const { messages } = req.body;
    const prompt =
      messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n") +
      "\nASSISTANT:";

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 20000000 } })
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      return res.status(hfRes.status).json({ success: false, error: errText });
    }

    const hfData = await hfRes.json();
    const content =
      typeof hfData === "string"
        ? hfData
        : hfData.generated_text ||
          (Array.isArray(hfData) && hfData[0]?.generated_text);

    if (!content) {
      return res
        .status(500)
        .json({ success: false, error: "No generated_text in response", raw: hfData });
    }

    // لا نحتاج JSON.parse هنا إذ الرد نص
    res.json({ success: true, reply: { role: "assistant", content: content.trim() } });
  } catch (err) {
    next(err);
  }
});

// GET /
app.get("/", (req, res) => {
  res.send("Mistral-7B Middleware is running.");
});

// Error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: err.message });
});

// بدء الخادم
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
