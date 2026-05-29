# Docker: network is unreachable / не качаются образы

Ошибка вида:

```text
failed to resolve source metadata for docker.io/library/node:22-alpine
dial tcp [2600:1f18:...]:443: connect: network is unreachable
```

Docker пытается скачать образы с **Docker Hub по IPv6**, а сеть до registry недоступна.

## Вариант 1 — локальный запуск без сборки образов (рекомендуется)

Нужны **Node.js 20+** и **Python 3.12+** на машине.

```powershell
cd demonrm
.\scripts\start-local.ps1
```

- UI: http://localhost:5173  
- API: http://localhost:8000/docs  

Postgres: если Docker работает — поднимется только БД. Если нет — установите Postgres и укажите `DATABASE_URL` вручную.

Или вручную:

```powershell
# Терминал 1 — только БД (если Docker доступен)
docker compose -f docker-compose.db-only.yml up -d

# Терминал 2 — backend
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
$env:DATABASE_URL="postgresql://nrm:nrm@localhost:5433/nrm"
.\.venv\Scripts\uvicorn app.main:app --reload --port 8000

# Терминал 3 — frontend
cd frontend
npm install
npm run dev
```

## Вариант 2 — исправить Docker (IPv6)

**Docker Desktop → Settings → Docker Engine**, добавьте/измените `daemon.json`:

```json
{
  "ipv6": false,
  "dns": ["8.8.8.8", "8.8.4.4"]
}
```

Примените и перезапустите Docker Desktop.

Дополнительно в Windows можно отключить приоритет IPv6 для приложений или использовать VPN, если Docker Hub блокируется провайдером.

## Вариант 3 — зеркало registry

Скопируйте `.env.example` в `.env` и укажите образы с **вашего** зеркала (пути зависят от организации):

```env
NODE_IMAGE=your-registry.example.com/node:22-alpine
NGINX_IMAGE=your-registry.example.com/nginx:alpine
PYTHON_IMAGE=your-registry.example.com/python:3.12-slim
POSTGRES_IMAGE=your-registry.example.com/postgres:16-alpine
```

Затем:

```powershell
docker compose --env-file .env up --build
```

## Вариант 4 — скачать образы заранее

С машины, где есть доступ к Hub:

```bash
docker pull node:22-alpine nginx:alpine python:3.12-slim postgres:16-alpine
docker save -o demonrm-images.tar node:22-alpine nginx:alpine python:3.12-slim postgres:16-alpine
```

На целевой машине:

```bash
docker load -i demonrm-images.tar
docker compose up --build
```
