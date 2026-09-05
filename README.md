# Helios

Helios is organized as a React dashboard with a FastAPI backend and isolated AI model integrations.

## Project structure

```text
front-end/       React dashboard
server/          FastAPI backend
ai-models/       Placeholder model integrations
docs/            Project documentation
```

## Run the backend

```bash
cd server
python -m pip install -r requirements.txt
uvicorn main:app --reload
```

The API is available at `http://127.0.0.1:8000`, with a health check at `/api/health`.

## Run the frontend

```bash
cd front-end
npm install
npm run dev
```
