module.exports = {
  apps: [
    # 1. Python ML Inference Service
    {
      name: "veritas-python-ml",
      script: "python",
      args: "app.py",
      interpreter: "python",
      env: {
        PORT: 5000
      },
      autorestart: true,
      watch: false
    },
    # 2. Node.js Express Gateway & Web Host Service
    {
      name: "veritas-web-app",
      script: "pnpm",
      args: "--filter @workspace/api-server start",
      env: {
        PORT: 4000,
        PYTHON_SERVER_URL: "http://localhost:5000",
        DATABASE_URL: ""  # Can be filled in with a PostgreSQL connection string
      },
      autorestart: true,
      watch: false
    }
  ]
};
