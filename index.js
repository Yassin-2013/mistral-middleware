// index.js

// 1. استيراد الحزم
const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch"); // تأكد أنك ثبت node-fetch@2

// 2. تهيئة Express
const app = express();
const port = process.env.PORT || 10000;

// 3. Middleware عامة
app.use(cors({ origin: "*" }));
app.use(express.json());

// 4. تسجيل جميع الطلبات (للتعرّف على المسار والمُعطيات)
app.use((req, res, next) => {
  console.log(`→ ${req.method} ${req.url}`);
  next();
});

// 5. نقطة الـ Analyze
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

    // استدعاء Mistral عبر HF Inference API
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 300 } })
      }
    );

    if (!hfRes.ok) {
      const errText = await hfRes.text();
      return res.status(hfRes.status).json({ success: false, error: errText });
    }

    const hfData = await hfRes.json();
    // استخراج النص
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

    // محاولة تحويل JSON
    let analysis;
    try {
      analysis = JSON.parse(textOutput.trim());
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

// 6. نقطة الـ Chat
app.post("/api/chat", async (req, res, next) => {
  try {
    const { messages } = req.body;
    const prompt =
      messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n") +
      "\nASSISTANT:";

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.2";
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 200 } })
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

    res.json({ success: true, reply: { role: "assistant", content: content.trim() } });
  } catch (err) {
    next(err);
  }
});

// 7. نقطة الجذر للتأكد
app.get("/", (req, res) => {
  res.send("Mistral-7B Middleware is running.");
});

// 8. معالج أخطاء مركزي
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ success: false, error: err.message });
});

// 9. بدء الخادم
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
