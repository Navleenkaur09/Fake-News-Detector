import os
import re
import json
from pathlib import Path
import urllib.request
import urllib.error
import joblib
import numpy as np
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Load environment variables manually from .env if it exists
def load_dotenv():
    env_file = Path(".env")
    if env_file.exists():
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, val = line.split("=", 1)
                    os.environ[key.strip()] = val.strip()

load_dotenv()

MODEL_DIR = Path("artifacts/model")
MODEL_FILE = MODEL_DIR / "fake_news_model.joblib"

# Load the trained model pipeline (optional fallback)
pipeline = None
if MODEL_FILE.exists():
    try:
        pipeline = joblib.load(MODEL_FILE)
        print(f"[app.py] Successfully loaded trained model from {MODEL_FILE}")
    except Exception as e:
        print(f"[app.py] Error loading model: {e}")
else:
    print(f"[app.py] Warning: Model file not found at {MODEL_FILE}. Will default to Gemini API or rule-based NLP.")

SYSTEM_PROMPT = """You are an expert fact-checker and computational linguist specializing in detecting misinformation and fake news. Analyze the provided news article or excerpt and determine whether it is REAL or FAKE news.

Evaluate based on:
1. Sensationalism and emotional manipulation
2. Credible source attribution (named officials, institutions, studies)
3. Verifiable claims vs. vague assertions
4. Journalistic writing standards (balanced framing, specific facts, dates)
5. Conspiracy framing, clickbait patterns, or viral bait language
6. Factual consistency and plausibility

Respond ONLY with a valid JSON object matching this exact schema — no markdown, no prose:
{
  "label": "REAL" | "FAKE",
  "confidence": <number 50.0–99.5>,
  "realProbability": <number 0.0–1.0>,
  "fakeProbability": <number 0.0–1.0>,
  "explanation": "<sentence 1-2: reason for the verdict, citing specific language patterns found>\\n\\n<sentence 3-4: actionable recommendation — what the reader should do, e.g. verify sources, safe to share, cross-check claims>",
  "keyWords": [
    { "word": "<word or phrase>", "score": <0.0–1.0>, "sentiment": "positive" | "negative" | "neutral" }
  ]
}

Rules:
- realProbability + fakeProbability must equal 1.0
- confidence must equal round(max(realProbability, fakeProbability) * 100, 1)
- keyWords: 8–15 entries, mix of fake signals (negative), real signals (positive), and topic words (neutral)
- explanation must reference specific phrases or patterns found in the text"""

def analyze_with_gemini(text, api_key):
    model = os.environ.get("GEMINI_MODEL", "gemini-3.5-flash")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
    
    truncated = text[:8000] if len(text) > 8000 else text
    
    body = {
        "contents": [
            {
                "role": "user",
                "parts": [
                    {
                        "text": truncated
                    }
                ]
            }
        ],
        "tools": [
            {
                "google_search": {}
            }
        ],
        "systemInstruction": {
            "parts": [
                {
                    "text": SYSTEM_PROMPT
                }
            ]
        },
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": {
                "type": "OBJECT",
                "properties": {
                    "label": { "type": "STRING", "enum": ["REAL", "FAKE"] },
                    "confidence": { "type": "NUMBER" },
                    "realProbability": { "type": "NUMBER" },
                    "fakeProbability": { "type": "NUMBER" },
                    "explanation": { "type": "STRING" },
                    "keyWords": {
                        "type": "ARRAY",
                        "items": {
                            "type": "OBJECT",
                            "properties": {
                                "word": { "type": "STRING" },
                                "score": { "type": "NUMBER" },
                                "sentiment": { "type": "STRING", "enum": ["positive", "negative", "neutral"] }
                            },
                            "required": ["word", "score", "sentiment"]
                        }
                    }
                },
                "required": ["label", "confidence", "realProbability", "fakeProbability", "explanation", "keyWords"]
            }
        }
    }
    
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    
    with urllib.request.urlopen(req) as res:
        resp_data = json.loads(res.read().decode("utf-8"))
        content = resp_data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        cleaned = content.replace("```json", "").replace("```", "").strip()
        parsed = json.loads(cleaned)
        
        parsed["confidence"] = min(max(float(parsed.get("confidence", 50.0)), 50.0), 99.5)
        parsed["realProbability"] = min(max(float(parsed.get("realProbability", 0.5)), 0.0), 1.0)
        parsed["fakeProbability"] = min(max(float(parsed.get("fakeProbability", 0.5)), 0.0), 1.0)
        return parsed

def analyze_with_rules(text):
    text_lower = text.lower()
    
    # Simple rule based indicators
    fake_indicators = ["shocking", "unbelievable", "secret", "exposed", "conspiracy", "mainstream media", "won't believe", "miracle", "anonymous source", "rumor", "leak"]
    real_indicators = ["according to", "spokesperson", "reuters", "associated press", "announced", "published in", "officials stated", "study shows", "confirmed by", "reported that"]
    
    fake_count = sum(1 for w in fake_indicators if w in text_lower)
    real_count = sum(1 for w in real_indicators if w in text_lower)
    
    total = fake_count + real_count
    if total == 0:
        fake_probability = 0.5
        real_probability = 0.5
    else:
        fake_probability = fake_count / total
        real_probability = real_count / total
        
    if fake_probability > real_probability:
        label = "FAKE"
        confidence = round(fake_probability * 100, 1)
    else:
        label = "REAL"
        confidence = round(real_probability * 100, 1)
        
    confidence = min(max(confidence, 50.0), 99.5)
    
    keywords = []
    for w in fake_indicators:
        if w in text_lower:
            keywords.append({"word": w, "score": 0.8, "sentiment": "negative"})
    for w in real_indicators:
        if w in text_lower:
            keywords.append({"word": w, "score": 0.8, "sentiment": "positive"})
            
    if not keywords:
        keywords = [{"word": "neutral-terms", "score": 0.5, "sentiment": "neutral"}]
        
    explanation = (
        f"This is a rule-based NLP fallback analysis. "
        f"We found {fake_count} fake indicators and {real_count} real indicators in the text.\\n\\n"
        "To get real-time AI-powered news detection, please configure a Gemini API key in your .env file."
    )
    
    return {
        "label": label,
        "confidence": confidence,
        "realProbability": round(real_probability, 3),
        "fakeProbability": round(fake_probability, 3),
        "explanation": explanation,
        "keyWords": keywords[:10]
    }

def extract_text_from_url(url):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8"
        }
    )
    with urllib.request.urlopen(req, timeout=10) as res:
        html = res.read().decode("utf-8", errors="ignore")
        
    text = re.sub(r"<script[^>]*>[\s\S]*?</script>", "", html, flags=re.IGNORECASE)
    text = re.sub(r"<style[^>]*>[\s\S]*?</style>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<header[^>]*>[\s\S]*?</header>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<footer[^>]*>[\s\S]*?</footer>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<nav[^>]*>[\s\S]*?</nav>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    
    text = text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " ")
    
    if len(text) < 50:
        raise ValueError("Could not extract sufficient text content from the webpage.")
    return text

def summarize_text(text, max_sentences=3):
    text = re.sub(r"\s+", " ", text).strip()
    sentences = re.split(r"(?<=[.!?])\s+", text)
    selected = [s.strip() for s in sentences if s.strip()]
    if not selected:
        return text[:250]
    return " ".join(selected[:max_sentences])

def get_keywords_and_influence(text, pipeline, top_n=12):
    try:
        vectorizer = pipeline.named_steps["tfidf"]
        model = pipeline.named_steps["clf"]
        
        vector = vectorizer.transform([text])
        feature_names = vectorizer.get_feature_names_out()
        coefs = model.coef_[0]
        values = vector.toarray()[0]
        
        feature_scores = values * coefs
        nonzero_indices = np.where(values > 0)[0]
        
        keywords = []
        for idx in nonzero_indices:
            word = feature_names[idx]
            score = feature_scores[idx]
            
            abs_score = float(np.abs(score))
            # positive coefficient correlates to class 1 ("Real")
            # negative coefficient correlates to class 0 ("Fake")
            sentiment = "positive" if score > 0 else "negative"
            
            keywords.append({
                "word": word,
                "score": round(min(abs_score * 5.0, 1.0), 3),  # scale for UI visibility
                "sentiment": sentiment
            })
            
        # Sort by score descending
        keywords = sorted(keywords, key=lambda x: x["score"], reverse=True)
        return keywords[:top_n]
    except Exception as e:
        print(f"[app.py] Error extracting keywords: {e}")
        return []

def generate_explanation(label, confidence, keywords):
    real_indicators = [k["word"] for k in keywords if k["sentiment"] == "positive"][:3]
    fake_indicators = [k["word"] for k in keywords if k["sentiment"] == "negative"][:3]
    
    conf_str = f"{confidence:.1f}"
    
    if label == "FAKE":
        reasons = f"including the use of terms like '{', '.join(fake_indicators)}'" if fake_indicators else "associated with biased and opinionated writing patterns"
        analysis = f"The model is confident ({conf_str}%) this article contains misinformation. The text exhibits strong indicators {reasons} that are characteristic of fake news. The linguistic structure deviates significantly from verified journalistic standards — lacking credible attribution, specific data, and balanced reporting."
        recommendation = "Do not share this content. Cross-check the claims against multiple reputable sources such as Reuters, AP, or BBC. Look for named authors, official citations, and verifiable data before forming an opinion."
    else:
        reasons = f"including the presence of terms like '{', '.join(real_indicators)}'" if real_indicators else "associated with objective and neutral reporting patterns"
        analysis = f"The model is confident ({conf_str}%) this is legitimate news. The text demonstrates strong characteristics of verified journalism: credibility markers {reasons} are present throughout. The writing follows established journalistic standards with objective language and verifiable claims."
        recommendation = "This content appears credible and safe to engage with. The article follows sound journalistic practices. You may share it responsibly, though independent verification of key statistics is always encouraged."
        
    return f"{analysis}\n\n{recommendation}"

HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Veritas - Fake News Detector (Python Server)</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-color: #0b0f19;
            --card-bg: rgba(17, 25, 40, 0.75);
            --border-color: rgba(255, 255, 255, 0.08);
            --primary: #6366f1;
            --primary-hover: #4f46e5;
            --text-color: #f3f4f6;
            --text-muted: #9ca3af;
            --success: #10b981;
            --destructive: #ef4444;
        }

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
            overflow-x: hidden;
            background-image: 
                radial-gradient(circle at 10% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 40%),
                radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 40%);
        }

        .container {
            width: 100%;
            max-width: 900px;
            backdrop-filter: blur(16px) saturate(180%);
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 24px;
            padding: 40px;
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }

        header {
            text-align: center;
            margin-bottom: 30px;
        }

        h1 {
            font-size: 2.5rem;
            font-weight: 700;
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #10b981 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            margin-bottom: 10px;
            letter-spacing: -0.03em;
        }

        .subtitle {
            color: var(--text-muted);
            font-size: 1.1rem;
        }

        .input-group {
            margin-bottom: 25px;
        }

        textarea {
            width: 100%;
            min-height: 200px;
            background-color: rgba(15, 23, 42, 0.6);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            color: var(--text-color);
            font-family: inherit;
            font-size: 1rem;
            line-height: 1.6;
            resize: vertical;
            transition: all 0.3s ease;
            outline: none;
        }

        textarea:focus {
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.25);
        }

        .btn-container {
            display: flex;
            justify-content: flex-end;
            gap: 15px;
        }

        button {
            padding: 14px 28px;
            border-radius: 12px;
            font-weight: 600;
            font-size: 1rem;
            cursor: pointer;
            transition: all 0.2s ease;
            border: none;
        }

        .btn-primary {
            background-color: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background-color: var(--primary-hover);
            transform: translateY(-1px);
        }

        .btn-secondary {
            background-color: transparent;
            color: var(--text-color);
            border: 1px solid var(--border-color);
        }

        .btn-secondary:hover {
            background-color: rgba(255, 255, 255, 0.05);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
            transform: none !important;
        }

        .result-container {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid var(--border-color);
            display: none;
        }

        .badge-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 20px;
        }

        .badge {
            font-size: 1.5rem;
            font-weight: 700;
            padding: 8px 20px;
            border-radius: 10px;
            display: inline-block;
        }

        .badge-real {
            background-color: rgba(16, 185, 129, 0.15);
            color: var(--success);
            border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .badge-fake {
            background-color: rgba(239, 68, 68, 0.15);
            color: var(--destructive);
            border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .confidence {
            font-size: 1.2rem;
            font-weight: 600;
            color: var(--text-muted);
        }

        .progress-bar-container {
            margin-bottom: 25px;
        }

        .progress-label {
            display: flex;
            justify-content: space-between;
            font-size: 0.9rem;
            margin-bottom: 8px;
            font-weight: 500;
        }

        .progress-track {
            height: 10px;
            background-color: rgba(255, 255, 255, 0.08);
            border-radius: 5px;
            overflow: hidden;
        }

        .progress-bar {
            height: 100%;
            border-radius: 5px;
            transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .progress-bar-real {
            background-color: var(--success);
        }

        .progress-bar-fake {
            background-color: var(--destructive);
        }

        .text-card {
            background-color: rgba(15, 23, 42, 0.4);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 20px;
            margin-bottom: 20px;
        }

        .text-card h3 {
            font-size: 1.1rem;
            font-weight: 600;
            margin-bottom: 10px;
            color: var(--primary);
        }

        .text-card p {
            font-size: 0.95rem;
            line-height: 1.6;
            color: #d1d5db;
        }

        .keywords-container {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin-top: 10px;
        }

        .keyword-pill {
            display: flex;
            align-items: center;
            padding: 6px 12px;
            border-radius: 30px;
            font-size: 0.85rem;
            font-family: 'JetBrains Mono', monospace;
            border: 1px solid transparent;
        }

        .pill-positive {
            background-color: rgba(16, 185, 129, 0.08);
            color: var(--success);
            border-color: rgba(16, 185, 129, 0.2);
        }

        .pill-negative {
            background-color: rgba(239, 68, 68, 0.08);
            color: var(--destructive);
            border-color: rgba(239, 68, 68, 0.2);
        }

        .pill-score {
            margin-left: 6px;
            font-size: 0.75rem;
            opacity: 0.8;
            border-left: 1px solid rgba(255, 255, 255, 0.2);
            padding-left: 6px;
        }

        .loader {
            display: none;
            text-align: center;
            margin-top: 20px;
            color: var(--text-muted);
            font-size: 0.95rem;
        }

        .spinner {
            border: 3px solid rgba(255, 255, 255, 0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: var(--primary);
            animation: spin 1s linear infinite;
            margin: 0 auto 10px auto;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }

        footer {
            margin-top: 30px;
            text-align: center;
            font-size: 0.85rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <h1>Veritas Analysis Terminal</h1>
            <p class="subtitle">Evaluate news authenticity in real-time with Google Gemini AI</p>
        </header>

        <main>
            <div class="input-group">
                <textarea id="newsText" placeholder="Paste news content, headline, or article URL here..."></textarea>
            </div>

            <div class="btn-container">
                <button class="btn-secondary" id="resetBtn">Reset</button>
                <button class="btn-primary" id="analyzeBtn">Analyze Article</button>
            </div>

            <div class="loader" id="loader">
                <div class="spinner"></div>
                Analyzing content...
            </div>

            <div class="result-container" id="resultContainer">
                <div class="badge-row">
                    <div id="verdictBadge"></div>
                    <div class="confidence" id="confidenceVal"></div>
                </div>

                <div class="progress-bar-container">
                    <div class="progress-label">
                        <span style="color: var(--success);">REAL Probability</span>
                        <span id="realPct">0%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar progress-bar-real" id="realBar" style="width: 0%"></div>
                    </div>
                </div>

                <div class="progress-bar-container">
                    <div class="progress-label">
                        <span style="color: var(--destructive);">FAKE Probability</span>
                        <span id="fakePct">0%</span>
                    </div>
                    <div class="progress-track">
                        <div class="progress-bar progress-bar-fake" id="fakeBar" style="width: 0%"></div>
                    </div>
                </div>

                <div class="text-card">
                    <h3>Summary</h3>
                    <p id="summaryText"></p>
                </div>

                <div class="text-card">
                    <h3>Explanation</h3>
                    <p id="explanationText" style="white-space: pre-line;"></p>
                </div>

                <div class="text-card" id="keywordsCard">
                    <h3>Key Influencing Terms</h3>
                    <div class="keywords-container" id="keywordsList"></div>
                </div>
            </div>
        </main>
    </div>

    <footer>
        Veritas AI Engine &bull; Powered by Google Gemini &bull; Flask &bull; Python 3
    </footer>

    <script>
        const newsText = document.getElementById('newsText');
        const analyzeBtn = document.getElementById('analyzeBtn');
        const resetBtn = document.getElementById('resetBtn');
        const loader = document.getElementById('loader');
        const resultContainer = document.getElementById('resultContainer');

        const verdictBadge = document.getElementById('verdictBadge');
        const confidenceVal = document.getElementById('confidenceVal');
        const realPct = document.getElementById('realPct');
        const fakePct = document.getElementById('fakePct');
        const realBar = document.getElementById('realBar');
        const fakeBar = document.getElementById('fakeBar');
        const summaryText = document.getElementById('summaryText');
        const explanationText = document.getElementById('explanationText');
        const keywordsList = document.getElementById('keywordsList');
        const keywordsCard = document.getElementById('keywordsCard');

        analyzeBtn.addEventListener('click', async () => {
            const text = newsText.value.trim();
            if (text.length < 10) return;

            // Show loader, hide results
            loader.style.display = 'block';
            resultContainer.style.display = 'none';
            analyzeBtn.disabled = true;

            try {
                const response = await fetch('/api/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ text }),
                });

                if (!response.ok) {
                    throw new Error('API request failed');
                }

                const data = await response.json();
                displayResults(data);
            } catch (err) {
                alert('Analysis failed: ' + err.message);
            } finally {
                loader.style.display = 'none';
                analyzeBtn.disabled = false;
            }
        });

        resetBtn.addEventListener('click', () => {
            newsText.value = '';
            resultContainer.style.display = 'none';
        });

        function displayResults(data) {
            const isFake = data.label === 'FAKE';
            
            // Verdict Badge
            verdictBadge.className = 'badge ' + (isFake ? 'badge-fake' : 'badge-real');
            verdictBadge.textContent = 'PREDICTION: ' + data.label;
            
            // Confidence
            confidenceVal.textContent = data.confidence.toFixed(1) + '% Confident';
            
            // Real / Fake percent labels & progress bars
            const realProb = data.realProbability * 100;
            const fakeProb = data.fakeProbability * 100;
            
            realPct.textContent = realProb.toFixed(1) + '%';
            fakePct.textContent = fakeProb.toFixed(1) + '%';
            
            setTimeout(() => {
                realBar.style.width = realProb + '%';
                fakeBar.style.width = fakeProb + '%';
            }, 50);

            // Summary & Explanation
            summaryText.textContent = data.summary;
            explanationText.textContent = data.explanation;

            // Keywords
            keywordsList.innerHTML = '';
            if (data.keyWords && data.keyWords.length > 0) {
                keywordsCard.style.display = 'block';
                data.keyWords.forEach(kw => {
                    const pill = document.createElement('span');
                    pill.className = 'keyword-pill ' + (kw.sentiment === 'positive' ? 'pill-positive' : 'pill-negative');
                    pill.innerHTML = `${kw.word} <span class="pill-score">${kw.score.toFixed(2)}</span>`;
                    keywordsList.appendChild(pill);
                });
            } else {
                keywordsCard.style.display = 'none';
            }

            // Reveal Container
            resultContainer.style.display = 'block';
        }
    </script>
</body>
</html>
"""

@app.route("/")
def home():
    return render_template_string(HTML_TEMPLATE)

@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' in request body"}), 400
        
    text = data["text"]
    if len(text.strip()) < 10:
        return jsonify({"error": "Text must be at least 10 characters long"}), 400
        
    text_to_analyze = text.strip()
    is_url = re.match(r"^https?://[^\s]+$", text_to_analyze, re.IGNORECASE)
    
    if is_url:
        try:
            text_to_analyze = extract_text_from_url(text_to_analyze)
        except Exception as e:
            return jsonify({"error": f"Failed to load article from URL: {str(e)}"}), 400

    # 1. Attempt Gemini API
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if gemini_key:
        try:
            res_data = analyze_with_gemini(text_to_analyze, gemini_key)
            summary = summarize_text(text_to_analyze, max_sentences=3)
            return jsonify({
                "label": res_data["label"],
                "confidence": res_data["confidence"],
                "realProbability": res_data["realProbability"],
                "fakeProbability": res_data["fakeProbability"],
                "processingTimeMs": 0,
                "explanation": res_data["explanation"],
                "summary": summary,
                "keyWords": res_data["keyWords"],
                "aiPowered": True,
                "engine": "Google Gemini 3.5 Flash"
            })
        except Exception as e:
            print(f"[app.py] Gemini inference failed, falling back: {e}")

    # 2. Fallback to local model pipeline if available
    if pipeline:
        try:
            probabilities = pipeline.predict_proba([text_to_analyze])[0]
            predicted_label = pipeline.predict([text_to_analyze])[0]
            
            fake_probability = float(probabilities[0])
            real_probability = float(probabilities[1])
            
            label = "FAKE" if predicted_label == "Fake" else "REAL"
            confidence = round(max(real_probability, fake_probability) * 100, 1)
            
            keywords = get_keywords_and_influence(text_to_analyze, pipeline)
            explanation = generate_explanation(label, confidence, keywords)
            summary = summarize_text(text_to_analyze, max_sentences=3)
            
            return jsonify({
                "label": label,
                "confidence": confidence,
                "realProbability": round(real_probability, 3),
                "fakeProbability": round(fake_probability, 3),
                "processingTimeMs": 0,
                "explanation": explanation,
                "summary": summary,
                "keyWords": keywords,
                "aiPowered": True,
                "engine": "Local ML Model (Passive-Aggressive)"
            })
        except Exception as e:
            print(f"[app.py] Local model inference error: {e}")

    # 3. Fallback to Rule-based NLP analysis
    rule_data = analyze_with_rules(text_to_analyze)
    summary = summarize_text(text_to_analyze, max_sentences=3)
    return jsonify({
        "label": rule_data["label"],
        "confidence": rule_data["confidence"],
        "realProbability": rule_data["realProbability"],
        "fakeProbability": rule_data["fakeProbability"],
        "processingTimeMs": 0,
        "explanation": rule_data["explanation"],
        "summary": summary,
        "keyWords": rule_data["keyWords"],
        "aiPowered": False,
        "engine": "Rule-Based Heuristic Fallback"
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[app.py] Starting Python server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
