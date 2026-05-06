import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

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
  { slug: "samoyed", name: "Samoyed" },
  { slug: "labrador-retriever", name: "Labrador Retriever" },
  { slug: "standard-poodle", name: "Standard Poodle" },
  { slug: "beagle", name: "Beagle" },
  { slug: "rottweiler", name: "Rottweiler" },
  { slug: "pembroke-welsh-corgi", name: "Pembroke Welsh Corgi" },
  { slug: "doberman-pinscher", name: "Doberman Pinscher" },
  { slug: "australian-shepherd", name: "Australian Shepherd" },
  { slug: "cavalier-king-charles-spaniel", name: "Cavalier King Charles Spaniel" },
  { slug: "chihuahua", name: "Chihuahua" },
  { slug: "boxer", name: "Boxer" },
  { slug: "pug", name: "Pug" },
  { slug: "boston-terrier", name: "Boston Terrier" },
  { slug: "australian-cattle-dog", name: "Australian Cattle Dog" },
  { slug: "jack-russell-terrier", name: "Jack Russell Terrier" },
  { slug: "newfoundland", name: "Newfoundland" },
  { slug: "weimaraner", name: "Weimaraner" },
  { slug: "maltese", name: "Maltese" },
  { slug: "basset-hound", name: "Basset Hound" },
  { slug: "vizsla", name: "Vizsla" },
  { slug: "dalmatian", name: "Dalmatian" },
  { slug: "cocker-spaniel", name: "Cocker Spaniel" },
  { slug: "english-springer-spaniel", name: "English Springer Spaniel" },
  { slug: "miniature-schnauzer", name: "Miniature Schnauzer" },
  { slug: "saint-bernard", name: "Saint Bernard" },
  { slug: "yorkshire-terrier", name: "Yorkshire Terrier" },
  { slug: "whippet", name: "Whippet" },
  { slug: "italian-greyhound", name: "Italian Greyhound" },
  { slug: "bloodhound", name: "Bloodhound" },
  { slug: "miniature-pinscher", name: "Miniature Pinscher" },
  { slug: "cane-corso", name: "Cane Corso" },
  { slug: "english-bulldog", name: "English Bulldog" },
  { slug: "bull-terrier", name: "Bull Terrier" },
  { slug: "west-highland-white-terrier", name: "West Highland White Terrier" },
  { slug: "scottish-terrier", name: "Scottish Terrier" },
  { slug: "papillon", name: "Papillon" },
  { slug: "pomeranian", name: "Pomeranian" },
  { slug: "brussels-griffon", name: "Brussels Griffon" },
  { slug: "havanese", name: "Havanese" },
  { slug: "lhasa-apso", name: "Lhasa Apso" },
  { slug: "chinese-crested", name: "Chinese Crested" },
  { slug: "akita", name: "Akita" },
  { slug: "alaskan-malamute", name: "Alaskan Malamute" },
  { slug: "shar-pei", name: "Shar Pei" },
  { slug: "rhodesian-ridgeback", name: "Rhodesian Ridgeback" },
  { slug: "belgian-malinois", name: "Belgian Malinois" },
  { slug: "great-pyrenees", name: "Great Pyrenees" },
  { slug: "soft-coated-wheaten-terrier", name: "Soft Coated Wheaten Terrier" },
  { slug: "old-english-sheepdog", name: "Old English Sheepdog" }
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
  "toy dog, toy": "shih-tzu",
  "labrador retriever": "labrador-retriever",
  "standard poodle": "standard-poodle",
  "beagle": "beagle",
  "rottweiler": "rottweiler",
  "pembroke welsh corgi": "pembroke-welsh-corgi",
  "doberman pinscher": "doberman-pinscher",
  "australian shepherd": "australian-shepherd",
  "cavalier king charles spaniel": "cavalier-king-charles-spaniel",
  "chihuahua": "chihuahua",
  "boxer": "boxer",
  "pug": "pug",
  "boston terrier": "boston-terrier",
  "australian cattle dog": "australian-cattle-dog",
  "jack russell terrier": "jack-russell-terrier",
  "newfoundland": "newfoundland",
  "weimaraner": "weimaraner",
  "maltese": "maltese",
  "basset hound": "basset-hound",
  "vizsla": "vizsla",
  "dalmatian": "dalmatian",
  "cocker spaniel": "cocker-spaniel",
  "english springer spaniel": "english-springer-spaniel",
  "miniature schnauzer": "miniature-schnauzer",
  "saint bernard": "saint-bernard",
  "saint bernard, st bernard": "saint-bernard",
  "st bernard": "saint-bernard",
  "yorkshire terrier": "yorkshire-terrier",
  "whippet": "whippet",
  "italian greyhound": "italian-greyhound",
  "bloodhound": "bloodhound",
  "miniature pinscher": "miniature-pinscher",
  "cane corso": "cane-corso",
  "english bulldog": "english-bulldog",
  "bull terrier": "bull-terrier",
  "west highland white terrier": "west-highland-white-terrier",
  "scottish terrier": "scottish-terrier",
  "papillon": "papillon",
  "pomeranian": "pomeranian",
  "brussels griffon": "brussels-griffon",
  "havanese": "havanese",
  "lhasa apso": "lhasa-apso",
  "chinese crested": "chinese-crested",
  "akita": "akita",
  "alaskan malamute": "alaskan-malamute",
  "shar pei": "shar-pei",
  "rhodesian ridgeback": "rhodesian-ridgeback",
  "belgian malinois": "belgian-malinois",
  "great pyrenees": "great-pyrenees",
  "soft coated wheaten terrier": "soft-coated-wheaten-terrier",
  "old english sheepdog": "old-english-sheepdog",
  "miniature poodle": "standard-poodle",
  "toy terrier, chihuahua": "chihuahua",
  "cardigan, cardigan welsh corgi": "pembroke-welsh-corgi"
};

function parseEnv(raw) {
  return raw.split("\n").reduce((acc, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return acc;
    }

    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      return acc;
    }

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();

    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    acc[key] = value;
    return acc;
  }, {});
}

async function getEnv() {
  const envPath = path.join(__dirname, ".env.local");
  if (!existsSync(envPath)) {
    return {};
  }

  const raw = await readFile(envPath, "utf8");
  return parseEnv(raw);
}

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

function getClassifierProvider(env) {
  const configured = String(env.DOG_CLASSIFIER_PROVIDER || "").trim().toLowerCase();
  if (configured === "openai" || configured === "hf" || configured === "google-vit") {
    return configured;
  }
  return env.OPENAI_API_KEY ? "openai" : "google-vit";
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
      error: parsed?.error || "Unexpected classifier response."
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
            { type: "input_image", image_url: `data:${mimeType};base64,${imageBase64}` }
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

async function handleDogClassification(req, res) {
  const env = await getEnv();
  const provider = getClassifierProvider(env);

  try {
    const body = await readJsonBody(req);
    const imageBase64 = String(body.imageBase64 || "");
    const mimeType = String(body.mimeType || "image/jpeg");
    if (!imageBase64) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "Missing image payload." }));
      return;
    }

    let result;
    if (provider === "openai") {
      const apiKey = env.OPENAI_API_KEY || "";
      if (!apiKey) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: "DOG_CLASSIFIER_PROVIDER is openai but OPENAI_API_KEY is missing." }));
        return;
      }
      result = await classifyWithOpenAi(imageBase64, mimeType, apiKey);
    } else {
      const token = env.HF_API_TOKEN || env.HUGGINGFACE_API_TOKEN || "";
      if (!token) {
        res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        res.end(JSON.stringify({ error: `${provider} classifier selected but HF_API_TOKEN is missing.` }));
        return;
      }
      result = await classifyWithHf(Buffer.from(imageBase64, "base64"), token, provider);
    }

    if (!result.ok) {
      res.writeHead(result.status, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: result.error }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({
      provider: result.provider,
      matched: result.matched,
      predictions: result.predictions
    }));
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: error instanceof Error ? error.message : "Classification failed." }));
  }
}

function resolveRoute(urlPath) {
  const cleanPath = urlPath.split("?")[0];

  if (cleanPath === "/api/auth-config") {
    return { type: "auth" };
  }

  if (cleanPath === "/api/classify-dog") {
    return { type: "classify-dog" };
  }

  if (cleanPath === "/" || cleanPath === "") {
    return { type: "file", filePath: path.join(__dirname, "index.html") };
  }

  if (cleanPath === "/apps" || cleanPath === "/apps/") {
    return { type: "file", filePath: path.join(__dirname, "apps/index.html") };
  }

  if (cleanPath === "/apps/aviadex" || cleanPath === "/apps/aviadex/") {
    return { type: "file", filePath: path.join(__dirname, "apps/aviadex/index.html") };
  }

  if (cleanPath === "/apps/canidex" || cleanPath === "/apps/canidex/") {
    return { type: "file", filePath: path.join(__dirname, "apps/canidex/index.html") };
  }

  if (cleanPath === "/apps/todo" || cleanPath === "/apps/todo/") {
    return { type: "file", filePath: path.join(__dirname, "apps/todo/index.html") };
  }

  const relativePath = cleanPath.replace(/^\/+/, "");
  return { type: "file", filePath: path.join(__dirname, relativePath) };
}

async function serveFile(filePath, res) {
  try {
    const data = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    res.end(data);
  } catch (_error) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = createServer(async (req, res) => {
  const route = resolveRoute(req.url || "/");

  if (route.type === "auth") {
    const env = await getEnv();
    const payload = {
      supabaseUrl: env.SUPABASE_URL || "",
      supabaseAnonKey: env.SUPABASE_ANON_KEY || ""
    };

    res.writeHead(200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store"
    });
    res.end(`window.AUTH_CONFIG = ${JSON.stringify(payload)};`);
    return;
  }

  if (route.type === "classify-dog") {
    if (req.method !== "POST") {
      res.writeHead(405, {
        "Content-Type": "application/json; charset=utf-8",
        Allow: "POST"
      });
      res.end(JSON.stringify({ error: "Method not allowed." }));
      return;
    }

    await handleDogClassification(req, res);
    return;
  }

  await serveFile(route.filePath, res);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mgcom local server running at http://127.0.0.1:${port}`);
});
