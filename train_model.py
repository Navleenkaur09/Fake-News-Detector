import argparse
import json
import re
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer


DATASET_FAKE = Path("dataset/Fake.csv")
DATASET_TRUE = Path("dataset/True.csv")
MODEL_DIR = Path("artifacts/model")
MODEL_FILE = MODEL_DIR / "fake_news_model.joblib"
VECTORIZER_FILE = MODEL_DIR / "fake_news_vectorizer.joblib"


def load_news_data(fake_path: Path, true_path: Path) -> pd.DataFrame:
    fake_df = pd.read_csv(fake_path)
    true_df = pd.read_csv(true_path)

    fake_df = fake_df.copy()
    true_df = true_df.copy()

    fake_df["label"] = "Fake"
    true_df["label"] = "Real"

    combined = pd.concat([fake_df, true_df], axis=0, ignore_index=True)
    combined = combined.sample(frac=1.0, random_state=42).reset_index(drop=True)
    return combined


def build_text_column(df: pd.DataFrame) -> pd.Series:
    title = df["title"].fillna("")
    text = df["text"].fillna("")
    return (title + ". " + text).astype(str)


def train_and_save_model(dataset: pd.DataFrame) -> tuple[Pipeline, pd.DataFrame]:
    dataset = dataset.copy()
    dataset["full_text"] = build_text_column(dataset)

    X = dataset["full_text"]
    y = dataset["label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.18,
        random_state=42,
        stratify=y,
    )

    vectorizer = TfidfVectorizer(
        lowercase=True,
        stop_words="english",
        ngram_range=(1, 2),
        max_df=0.92,
        min_df=3,
    )

    model = LogisticRegression(
        solver="liblinear",
        class_weight="balanced",
        random_state=42,
        max_iter=1000,
    )

    pipeline = Pipeline([("tfidf", vectorizer), ("clf", model)])
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    y_proba = pipeline.predict_proba(X_test)

    dataset_out = X_test.to_frame().copy()
    dataset_out["true_label"] = y_test.values
    dataset_out["predicted_label"] = y_pred
    dataset_out["fake_probability"] = np.round(y_proba[:, 0] * 100, 2)
    dataset_out["real_probability"] = np.round(y_proba[:, 1] * 100, 2)
    dataset_out["explanation"] = dataset_out["predicted_label"].apply(
        lambda label: (
            "This article shows patterns typical of fake news: sensational phrasing, unverified claims, or opinionated language."
            if label == "Fake"
            else "This article reads like standard news reporting: neutral language, factual tone, and objective structure."
        )
    )
    dataset_out["summary"] = dataset_out["full_text"].apply(summarize_text)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(pipeline, MODEL_FILE)
    joblib.dump(vectorizer, VECTORIZER_FILE)

    print("Model training complete.")
    print(f"Saved model to: {MODEL_FILE}")
    print(f"Saved vectorizer to: {VECTORIZER_FILE}")

    print("\nEvaluation results:")
    print(f"Accuracy: {accuracy_score(y_test, y_pred):.4f}")
    print(classification_report(y_test, y_pred, digits=4))
    print("Confusion matrix:")
    print(confusion_matrix(y_test, y_pred))

    return pipeline, dataset_out


def explain_prediction(text: str, pipeline: Pipeline, top_n: int = 4) -> str:
    if not text or not text.strip():
        return "No news text was provided for explanation."

    vectorizer = pipeline.named_steps["tfidf"]
    model = pipeline.named_steps["clf"]

    raw_text = text.strip()
    vector = vectorizer.transform([raw_text])
    proba = model.predict_proba(vector)[0]
    label = model.classes_[int(np.argmax(proba))]

    feature_names = np.array(vectorizer.get_feature_names_out())
    coefs = model.coef_[0]
    values = vector.toarray()[0]
    feature_scores = values * coefs

    if label == "Fake":
        contribution_index = np.argsort(feature_scores)
    else:
        contribution_index = np.argsort(-feature_scores)

    term_candidates = [feature_names[i] for i in contribution_index if values[i] > 0]
    term_candidates = term_candidates[:top_n]

    if not term_candidates:
        base_reason = (
            "The model found a pattern consistent with " + label.lower() + "."
        )
    else:
        base_reason = (
            f"The model predicts {label.lower()} because the article contains signals such as {', '.join(term_candidates)}."
        )

    return base_reason


def summarize_text(text: str, max_sentences: int = 2) -> str:
    text = (text or "").strip()
    if not text:
        return "No content to summarize."

    text = re.sub(r"\s+", " ", text)
    sentences = re.split(r"(?<=[.!?])\s+", text)
    selected = [s.strip() for s in sentences if s.strip()]
    if not selected:
        return text[:250].strip()

    summary = " ".join(selected[:max_sentences])
    if len(summary) < 80 and len(selected) > max_sentences:
        summary = " ".join(selected[: max_sentences + 1])

    return summary


def generate_prediction_record(text: str, pipeline: Pipeline) -> dict:
    full_text = text.strip()
    probabilities = pipeline.predict_proba([full_text])[0]
    predicted_label = pipeline.predict([full_text])[0]
    fake_probability = float(np.round(probabilities[0] * 100, 2))
    real_probability = float(np.round(probabilities[1] * 100, 2))
    explanation = explain_prediction(full_text, pipeline)
    summary = summarize_text(full_text, max_sentences=3)

    verdict = (
        f"This news is predicted to be {predicted_label.lower()} with {fake_probability}% fake and {real_probability}% real confidence."
        if predicted_label == "Fake"
        else f"This news is predicted to be real with {real_probability}% real and {fake_probability}% fake confidence."
    )

    return {
        "text": full_text,
        "predicted_label": predicted_label,
        "fake_probability": fake_probability,
        "real_probability": real_probability,
        "explanation": explanation,
        "summary": summary,
        "verdict": verdict,
    }


def predict_from_csv(input_csv: Path, output_csv: Path, pipeline: Pipeline) -> pd.DataFrame:
    df = pd.read_csv(input_csv)
    df = df.copy()
    if "text" not in df.columns and "title" in df.columns:
        df["text"] = df["title"].fillna("")
    if "text" not in df.columns:
        raise ValueError("Input CSV must contain a 'text' column or a 'title' column.")

    df["full_text"] = build_text_column(df)
    predictions = []
    for full_text in df["full_text"]:
        record = generate_prediction_record(full_text, pipeline)
        predictions.append(record)

    prediction_df = pd.DataFrame(predictions)
    output_df = pd.concat([df.reset_index(drop=True), prediction_df.drop(columns=["text"])], axis=1)
    output_df.to_csv(output_csv, index=False)
    return output_df


def main() -> None:
    parser = argparse.ArgumentParser(description="Train a fake news detection model and create prediction outputs.")
    parser.add_argument("--train", action="store_true", help="Train the model on dataset/Fake.csv and dataset/True.csv.")
    parser.add_argument("--predict", type=str, help="Predict a single news text string.")
    parser.add_argument("--predict-csv", type=str, help="Predict a batch of news entries from a CSV file with title/text columns.")
    parser.add_argument("--output-csv", type=str, default="predictions.csv", help="Output CSV path for batch predictions.")
    args = parser.parse_args()

    if args.train:
        dataset = load_news_data(DATASET_FAKE, DATASET_TRUE)
        pipeline, eval_df = train_and_save_model(dataset)
        eval_df.to_csv("model_evaluation_predictions.csv", index=False)
        print("Saved evaluation predictions to model_evaluation_predictions.csv")
        return

    if args.predict:
        if not MODEL_FILE.exists():
            raise FileNotFoundError(
                f"Trained model not found at {MODEL_FILE}. Run with --train first."
            )
        pipeline = joblib.load(MODEL_FILE)
        record = generate_prediction_record(args.predict, pipeline)
        print(json.dumps(record, indent=2))
        return

    if args.predict_csv:
        if not MODEL_FILE.exists():
            raise FileNotFoundError(
                f"Trained model not found at {MODEL_FILE}. Run with --train first."
            )
        pipeline = joblib.load(MODEL_FILE)
        output_path = Path(args.output_csv)
        predictions = predict_from_csv(Path(args.predict_csv), output_path, pipeline)
        print(f"Batch predictions saved to {output_path}")
        print(predictions.head(5).to_string(index=False))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
