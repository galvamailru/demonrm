# Demo NRM v2 — Net Revenue Management (FMCG)

Демонстрационное веб-приложение для управления циклом NRM с расширенной моделью ценообразования.

## Возможности v2

| Функция | Описание |
|---------|----------|
| **Effective dating** | `valid_from` / `valid_to` на строках и промо; `pricing_date` на цикле |
| **Промо-правила** | Приоритет, stackable / non-stackable, scope (all/sku/category/channel/customer) |
| **Tier-скидки** | Отдельная таблица **Volume tiers** рядом с матрицей цен (связь по `ID строки`) |
| **Валюта** | `currency_code` + `exchange_rate` → пересчёт в валюту цикла |
| **UoM** | Единица (`EA`, `CS`) и `units_per_uom`; объём в базовых единицах для tiers |
| **Налог** | `tax_rate_pct` → `tax_amount`, `net_revenue_after_tax` |
| **Матрица** | Справочники клиентов/каналов; строки SKU×клиент×канал; «Развернуть матрицу» |
| **Фильтры** | Категория, канал, клиент — на уровне цикла и запроса расчёта |
| **Snapshot** | При публикации сохраняется зафиксированный расчёт в БД |

## Запуск

### Docker (если доступен Docker Hub)

```bash
cd demonrm
docker compose down -v   # при обновлении с v1 — пересоздать БД
docker compose up --build
```

- UI: http://localhost:8080  
- API: http://localhost:8000/docs  

**Ошибка `network is unreachable` при pull образов?** → см. [DOCKER-NETWORK.md](DOCKER-NETWORK.md) или:

```powershell
.\scripts\start-local.ps1
```

- UI: http://localhost:5173  
- API: http://localhost:8000/docs  

## Порядок работы

1. **Клиенты / Каналы** — мастер-данные матрицы.
2. **Матрица цен** — строки с SKU, клиентом, каналом, датами, валютой, tiers.
3. **Промо-правила** — приоритет 1 = выше; non-stackable — только одно правило + row promo.
4. **Параметры расчёта** — pricing date и фильтры → **Рассчитать**.
5. **Утвердить** → **Опубликовать + Snapshot** — расчёт фиксируется.

## Формула расчёта (кратко)

```
Invoice = List × (1 − contract%) × курс
Promo   = stackable правила (мультипликативно) ИЛИ одно non-stackable
Net     = Invoice × (1 − promo%) × (1 − tier%) × (1 − off%) − trade
Net Rev = Net × volume(UoM)
Tax     = Net Rev × tax%
```

## Миграция с v1

Схема БД изменилась. Выполните `docker compose down -v` для чистой БД или добавьте колонки вручную.
