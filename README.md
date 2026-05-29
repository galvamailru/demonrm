# Demo NRM — Net Revenue Management (FMCG)

Демонстрационное веб-приложение для управления циклом NRM: редактирование исходных данных в Excel-подобных таблицах и расчёт измерений (waterfall).

## Стек

| Компонент | Технология |
|-----------|------------|
| Frontend | Node.js, React, Vite, Handsontable |
| Backend | Python 3.12, FastAPI, SQLAlchemy |
| БД | PostgreSQL 16 |
| Оркестрация | Docker Compose |

## Цикл NRM в приложении

1. **Черновик (draft)** — редактирование исходных данных (SKU, цены, скидки, объёмы).
2. **Симуляция (simulated)** — расчёт измерений: Invoice/Net price, Gross/Net Revenue, COGS, Margin.
3. **Утверждён (approved)** — согласование сценария.
4. **Опубликован (published)** — данные только для чтения.

## Запуск

```bash
cd demonrm
docker compose up --build
```

Откройте в браузере: **http://localhost:8080**

API и документация Swagger: **http://localhost:8000/docs**

PostgreSQL на хосте: `localhost:5433` (user/password/db: `nrm`).

## Локальная разработка (без Docker frontend)

```bash
# Терминал 1 — только БД и API
docker compose up postgres backend

# Терминал 2 — frontend
cd frontend
npm install
npm run dev
```

UI: http://localhost:5173 (прокси `/api` → backend).

## Исходные данные (редактируемые)

| Поле | Описание |
|------|----------|
| list_price | Прайс-лист |
| contract_discount_pct | Контрактная скидка % |
| promo_discount_pct | Промо % |
| off_invoice_pct | Off-invoice % |
| trade_spend_per_unit | Trade spend на единицу |
| unit_cost | Себестоимость |
| planned_volume | Плановый объём |

## Измерения (расчёт)

- **Invoice Price** = List × (1 − contract%)
- **Net Price** = Invoice × (1 − promo%) × (1 − off-invoice%) − trade spend
- **Gross / Net Revenue**, **COGS**, **Gross Margin**, **Margin %**

## Структура проекта

```
demonrm/
  docker-compose.yml
  backend/          # FastAPI
  frontend/         # React + Handsontable
```

## Лицензия Handsontable

Handsontable используется с ключом `non-commercial-and-evaluation`. Для коммерческого использования нужна отдельная лицензия.
