# verifiernews
AI-powered Fake News Verification System that classifies news articles as Real or Fake using NLP, TF-IDF, and Machine Learning models.
News Verifier - Fake News Detection System

This project is an AI/ML-based web application that verifies whether a news article is Real or Fake. It uses Natural Language Processing (NLP), TF-IDF Vectorization, and Machine Learning algorithms to analyze news content and provide instant predictions.

Features

Detects fake and real news instantly

Uses NLP for text preprocessing

TF-IDF feature extraction

Machine Learning based classification

Confidence score for predictions

User-friendly web interface

## Local development

1. Install dependencies from the repository root:
   ```bash
   pnpm install
   ```
2. Create local environment files:
   - `artifacts/api-server/.env`
   - `artifacts/fake-news-detector/.env`

3. Use a PostgreSQL database URL in `artifacts/api-server/.env`:
   ```text
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/newsverifier
   PORT=4000
   ```

4. Create the PostgreSQL database and apply the schema:
   ```bash
   # Create the database (adjust user/password as needed)
   createdb newsverifier

   # Or using psql if you prefer:
   # psql -U postgres -c "CREATE DATABASE newsverifier;"

   cd lib/db
   pnpm run push
   ```

5. Start the backend:
   ```bash
   cd artifacts/api-server
   pnpm run dev
   ```

6. Start the frontend:
   ```bash
   cd artifacts/fake-news-detector
   pnpm run dev
   ```

## Notes

- The backend now loads `.env` using `dotenv` and will connect to PostgreSQL when `DATABASE_URL` is set.
- The frontend Vite config also loads `.env` and requires `PORT` and `BASE_PATH`.
- If you do not set `DATABASE_URL`, the backend falls back to an in-memory database.
