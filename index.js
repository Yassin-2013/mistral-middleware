// … أعلى الملف كما هو

app.post("/api/analyze", async (req, res) => {
  try {
    const { userId, answers } = req.body;
    const prompt = `…`; // كما صيغناه سابقًا

    const hfRes = await fetch(
      "https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.3",
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
    // نُقرر نص الإخراج من عدة احتمالات
    let textOutput;
    if (typeof hfData === "string") {
      textOutput = hfData;
    } else if (hfData.generated_text) {
      textOutput = hfData.generated_text;
    } else if (Array.isArray(hfData) && hfData[0].generated_text) {
      textOutput = hfData[0].generated_text;
    } else {
      return res.status(500).json({ success: false, error: "Unexpected HF response format", raw: hfData });
    }

    // نحاول تحويله إلى JSON، وإن فشل نرجّع النص الخام
    let analysis;
    try {
      analysis = JSON.parse(textOutput.trim());
    } catch (parseErr) {
      return res.status(200).json({ success: false, error: "Invalid JSON from model", raw: textOutput });
    }

    return res.json({ success: true, analysis });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// … بقية الدوال (/api/chat) نفسها مع نفس منطق استخراج textOutput
