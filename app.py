import os
import re
import json
from pathlib import Path
import joblib
import numpy as np
from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODEL_DIR = Path("artifacts/model")
MODEL_FILE = MODEL_DIR / "fake_news_model.joblib"

# Load the trained model pipeline
pipeline = None
if MODEL_FILE.exists():
    try:
        pipeline = joblib.load(MODEL_FILE)
        print(f"[app.py] Successfully loaded trained model from {MODEL_FILE}")
    except Exception as e:
        print(f"[app.py] Error loading model: {e}")
else:
    print(f"[app.py] Warning: Model file not found at {MODEL_FILE}. Please train the model first.")

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
            <p class="subtitle">Evaluate news authenticity with the trained passive-aggressive model</p>
        </header>

        <main>
            <div class="input-group">
                <textarea id="newsText" placeholder="Paste article content or headline here (minimum 10 characters)..."></textarea>
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
        Veritas ML Engine &bull; Running on Flask &bull; Python 3
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
    if not pipeline:
        return jsonify({"error": "Model is not loaded. Train the model first."}), 500
        
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "Missing 'text' in request body"}), 400
        
    text = data["text"]
    if len(text.strip()) < 10:
        return jsonify({"error": "Text must be at least 10 characters long"}), 400
        
    # Run prediction
    try:
        probabilities = pipeline.predict_proba([text])[0]
        predicted_label = pipeline.predict([text])[0]
        
        # Scikit-learn orders classes alphabetically: ["Fake", "Real"]
        # Index 0 is Fake probability, Index 1 is Real probability
        fake_probability = float(probabilities[0])
        real_probability = float(probabilities[1])
        
        # Format label to match Node backend schema ('REAL' / 'FAKE')
        label = "FAKE" if predicted_label == "Fake" else "REAL"
        confidence = round(max(real_probability, fake_probability) * 100, 1)
        
        # Get keyword importances
        keywords = get_keywords_and_influence(text, pipeline)
        explanation = generate_explanation(label, confidence, keywords)
        summary = summarize_text(text, max_sentences=3)
        
        return jsonify({
            "label": label,
            "confidence": confidence,
            "realProbability": round(real_probability, 3),
            "fakeProbability": round(fake_probability, 3),
            "processingTimeMs": 0,  # will be computed by gateway
            "explanation": explanation,
            "summary": summary,
            "keyWords": keywords,
            "aiPowered": True
        })
    except Exception as e:
        print(f"[app.py] Inference error: {e}")
        return jsonify({"error": f"Error running model prediction: {str(e)}"}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"[app.py] Starting Python server on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=False)
