// index.js

const express = require("express");
const cors    = require("cors");
const fetch   = require("node-fetch"); // إذا لم تُضمّنها، ثبتها بـ npm install node-fetch@2

const app  = express();
const port = process.env.PORT || 3000;

// 1. CORS لجميع الأصول
app.use(cors({ origin: "*" }));
app.use(express.json());

// 2. نقطة تحليل الذكاء (iq test)
app.post("/api/analyze", async (req, res) => {
  try {
    const { userId, answers } = req.body;
    // تبنّي أسلوب تشخيص بسيط عبر Mistral: نبني prompt يتضمن بيانات المستخدم
    const prompt = `
User ID: ${userId}
IQ Test Data:
${answers.map(a=>`- Q${a.questionId}: ${a.correct?"✔️":"❌"}, time ${a.responseTime}s`).join("\n")}
Now, based on this, compute:
1. Estimated IQ score (µ=100,σ=15).
2. Classification (High, Above Avg, Avg, Below Avg).
3. Brief feedback.
4. Three simple exercises.
Respond in JSON.
`;

    // استدعاء API لـ Hugging Face
    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/mistral-7b-instruct-v0.1",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 300 } })
      }
    );
    const hfData = await hfRes.json();
    // hfData قد يحتوي على hfData.generated_text أو hfData.error
    if (hfData.error) {
      return res.status(500).json({ success:false, error: hfData.error });
    }
    // نفترض الناتج نص JSON كامِل
    const analysis = JSON.parse(hfData.generated_text);

    res.json({ success:true, analysis });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error: err.message });
  }
});

// 3. نقطة الدردشة (chat)
app.post("/api/chat", async (req, res) => {
  try {
    const { messages } = req.body;
    // نبني prompt بسيط: نجمع كل الرسائل في نص واحد
    const prompt = messages.map(m=>`${m.role.toUpperCase()}: ${m.content}`).join("\n") + "\nASSISTANT:";

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/mistral-7b-instruct-v0.1",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.HF_API_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt, parameters: { max_new_tokens: 200 } })
      }
    );
    const hfData = await hfRes.json();
    if (hfData.error) {
      return res.status(500).json({ success:false, error: hfData.error });
    }
    // نرجّع الرد
    res.json({ success:true, reply: { role:"assistant", content: hfData.generated_text.trim() } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("Mistral-7B Middleware is running.");
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

