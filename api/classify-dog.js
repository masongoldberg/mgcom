const HF_MODEL_URL = "https://router.huggingface.co/hf-inference/models/google/vit-base-patch16-224";
const OPENAI_MODEL = "gpt-4.1-mini";

const BREEDS = [
  { slug: "golden-retriever", name: "Golden Retriever" },
  { slug: "french-bulldog", name: "French Bulldog" },
  { slug: "german-shepherd", name: "German Shepherd" },
  { slug: "dachshund", name: "Dachshund" },
  { slug: "siberian-husky", name: "Siberian Husky" },
  { slug: "border-collie", name: "Border Collie" },
  { slug: "shiba-inu", name: "Shiba Inu" },
  { slug: "great-dane", name: "Great Dane" },
  { slug: "afghan-hound", name: "Afghan Hound" },
  { slug: "basenji", name: "Basenji" },
  { slug: "shih-tzu", name: "Shih Tzu" },
  { slug: "bernese-mountain-dog", name: "Bernese Mountain Dog" },
  { slug: "samoyed", name: "Samoyed" }
];

const LABEL_TO_SLUG = {
  "golden retriever": "golden-retriever",
  "labrador retriever": "golden-retriever",
  "chesapeake bay retriever": "golden-retriever",
  "curly-coated retriever": "golden-retriever",
  "flat-coated retriever": "golden-retriever",
  "french bulldog": "french-bulldog",
  "french bulldog, frenchie": "french-bulldog",
  "german shepherd": "german-shepherd",
  "german shepherd dog": "german-shepherd",
  "german shepherd, german shepherd dog, german police dog, alsatian": "german-shepherd",
  "dachshund": "dachshund",
  "badger dog, dachshund": "dachshund",
  "siberian husky": "siberian-husky",
  "husky": "siberian-husky",
  "border collie": "border-collie",
  "collie": "border-collie",
  "great dane": "great-dane",
  "bernese mountain dog": "bernese-mountain-dog",
  "samoyed": "samoyed",
  "samoyed, samoyede": "samoyed",
  "shih-tzu": "shih-tzu",
  "shih tzu": "shih-tzu",
  "shih-tzu, shitzu": "shih-tzu",
  "toy dog, toy": "shih-tzu"
};

function normalizeLabel(label) {
  return String(label || "").trim().toLowerCase();
}

function mapPredictionToBreed(predictions) {
  for (const item of predictions) {
    const slug = LABEL_TO_SLUG[normalizeLabel(item.label)];
    if (slug) {
      return {
        slug,
        confidence: Number(item.score || 0),
        label: item.label
      };
    }
  }

  return null;
}

function mapPredictionOptions(predictions) {
  return predictions.slice(0, 5).map((item) => {
    const slug = LABEL_TO_SLUG[normalizeLabel(item.label)] || "";
    const breed = BREEDS.find((candidate) => candidate.slug === slug);
    return {
      label: item.label,
      score: Number(item.score || 0),
      slug,
      name: breed?.name || item.label
    };
  });
}

function getClassifierProvider() {
  const configured = String(process.env.DOG_CLASSIFIER_PROVIDER || "").trim().toLowerCase();
  if (configured === "openai" || configured === "hf" || configured === "google-vit") {
    return configured;
  }
  return process.env.OPENAI_API_KEY ? "openai" : "google-vit";
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(raw || "{}");
}

async function classifyWithHf(imageBuffer, token, providerName = "hf") {
  const response = await fetch(HF_MODEL_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/jpeg"
    },
    body: imageBuffer
  });

  const text = await response.text();
  let parsed;

  try {
    parsed = JSON.parse(text);
  } catch (_error) {
    parsed = null;
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: parsed?.error || text || "Hugging Face classification failed."
    };
  }

  if (!Array.isArray(parsed)) {
    return {
      ok: false,
      status: 502,
      error: parsed?.error || "Unexpected Hugging Face classifier response."
    };
  }

  return {
    ok: true,
    provider: providerName,
    matched: mapPredictionToBreed(parsed),
    predictions: mapPredictionOptions(parsed)
  };
}

function buildOpenAiPrompt() {
  return [
    "Classify the dog breed in this image.",
    "You must choose from this exact Canidex roster only:",
    ...BREEDS.map((breed) => `- ${breed.name} | ${breed.slug}`),
    'Return strict JSON with keys: slug, breed_name, confidence, reasoning.',
    'Use confidence as a number from 0 to 1.',
    'If the image does not match any breed confidently, choose the closest breed from the list and explain briefly.'
  ].join("\n");
}

async function classifyWithOpenAi(imageBase64, mimeType, apiKey) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: buildOpenAiPrompt() },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${imageBase64}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dog_breed_classification",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              slug: { type: "string" },
              breed_name: { type: "string" },
              confidence: { type: "number" },
              reasoning: { type: "string" }
            },
            required: ["slug", "breed_name", "confidence", "reasoning"]
          }
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error?.message || "OpenAI classification failed."
    };
  }

  const raw = payload?.output_text || "";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    return {
      ok: false,
      status: 502,
      error: "OpenAI classifier returned non-JSON output."
    };
  }

  const matchedBreed = BREEDS.find((breed) => breed.slug === parsed.slug);
  if (!matchedBreed) {
    return {
      ok: false,
      status: 502,
      error: `OpenAI classifier returned unknown slug "${parsed.slug}".`
    };
  }

  return {
    ok: true,
    provider: "openai",
    matched: {
      slug: matchedBreed.slug,
      confidence: Number(parsed.confidence || 0),
      label: parsed.breed_name || matchedBreed.name
    },
    predictions: [
      {
        label: parsed.breed_name || matchedBreed.name,
        score: Number(parsed.confidence || 0),
        slug: matchedBreed.slug,
        name: matchedBreed.name,
        reasoning: parsed.reasoning || ""
      }
    ]
  };
}

async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const imageBase64 = String(body.imageBase64 || "");
    const mimeType = String(body.mimeType || "image/jpeg");
    if (!imageBase64) {
      res.status(400).json({ error: "Missing image payload." });
      return;
    }

    const provider = getClassifierProvider();
    let result;

    if (provider === "openai") {
      const apiKey = process.env.OPENAI_API_KEY || "";
      if (!apiKey) {
        res.status(500).json({ error: "DOG_CLASSIFIER_PROVIDER is openai but OPENAI_API_KEY is missing." });
        return;
      }
      result = await classifyWithOpenAi(imageBase64, mimeType, apiKey);
    } else {
      const token = process.env.HF_API_TOKEN || process.env.HUGGINGFACE_API_TOKEN || "";
      if (!token) {
        res.status(500).json({ error: `${provider} classifier selected but HF_API_TOKEN is missing.` });
        return;
      }
      result = await classifyWithHf(Buffer.from(imageBase64, "base64"), token, provider);
    }

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json({
      provider: result.provider,
      matched: result.matched,
      predictions: result.predictions
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Classification failed." });
  }
}

module.exports = handler;
