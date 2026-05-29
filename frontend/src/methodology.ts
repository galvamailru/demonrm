export type HelpPageId =
  | "source"
  | "promos"
  | "customers"
  | "channels"
  | "dimensions"
  | "snapshots"
  | "compare";

export interface PageHelp {
  title: string;
  purpose: string;
  steps: string[];
  /** Поля и механики, которые уже есть в demo, но легко пропустить */
  inApp?: string[];
  /** Что не входит в demo на этой вкладке (типичный enterprise NRM) */
  notIncluded: string[];
}

/** Общий контур NRM: что закрывает demo, а что нет */
export const NRM_PROCESS_MAP = {
  covered: [
    "Базовая матрица цен (SKU × клиент × канал)",
    "Контрактные, промо, off-invoice скидки и trade spend на единицу",
    "Volume tiers, промо-правила (priority / stackable)",
    "Симуляция waterfall и сравнение двух циклов",
    "Публикация со snapshot расчёта",
  ],
  notCovered: [
    "TPM: accrual, claims, deductions, план/факт trade spend",
    "Эластичность спроса и оптимизация цены/объёма",
    "Cannibalization / halo от промо",
    "Иерархии продукт/клиент с rollup-отчётами",
    "Роли, пороги утверждения, min margin / floor price",
    "Интеграция ERP, выгрузка в billing, загрузка фактов",
    "Конкурентный price index, pack-price architecture",
    "Promo calendar (Gantt), funding split производитель/ритейлер",
  ],
};

export const DEMO_LIMITATIONS = {
  title: "Это demo NRM, не полноценный TPM/RGM",
  description:
    "Приложение моделирует упрощённый gross-to-net расчёт и цикл согласования. Для production нужны интеграции, guardrails и план/факт.",
  technical: [
    "Один плановый объём на строку (без пересчёта от цены)",
    "Упрощённый COGS (без логистики, listing fee, levies)",
    "Нет полного audit trail изменений полей (только snapshot при publish)",
    "Нет экспорта в ERP / Excel из UI",
  ],
};

export const PAGE_HELP: Record<HelpPageId, PageHelp> = {
  source: {
    title: "Матрица цен",
    purpose:
      "Задайте исходные данные ценообразования по связке SKU × клиент × канал. Это основа gross-to-net и Net Revenue.",
    steps: [
      "Проверьте справочники «Клиенты» и «Каналы» — коды должны совпадать с колонками матрицы.",
      "Заполните list price, контракт %, промо строки %, off-invoice %, trade spend/ед, себестоимость.",
      "Укажите planned volume в выбранном UoM (CS, EA); для tiers объём пересчитывается в базовые единицы (× units_per_uom).",
      "Задайте valid_from / valid_to — строка участвует в расчёте только если pricing date цикла попадает в интервал.",
      "При другой валюте строки укажите currency_code и exchange_rate к валюте цикла.",
      "Выберите строку в верхней таблице — ниже отредактируйте связанные volume tiers.",
      "Сохраните вкладку → «Рассчитать» (панель действий). При необходимости — «Развернуть матрицу».",
      "Новый цикл («+ Цикл»): копируются матрица, tiers, промо и параметры расчёта из выбранного цикла.",
    ],
    inApp: [
      "Pricing date и фильтры (категория/канал/клиент) задаются выше — они сужают, какие строки попадут в расчёт.",
      "НДС: tax_rate_pct влияет на tax_amount и net_revenue_after_tax в измерениях.",
      "Промо на строке (promo_discount_pct) суммируется с промо-правилами на вкладке «Промо-правила».",
    ],
    notIncluded: [
      "Иерархия продуктов (brand → category → SKU) и rollup без ручной фильтрации",
      "Отдельные прайс-листы по регионам / юридическим лицам",
      "Floor price, MAP, автоблокировка при margin ниже порога",
      "Импорт из ERP / Excel, массовая валидация MDM",
      "Логистика, listing fee и прочие компоненты полного COGS",
    ],
  },
  promos: {
    title: "Промо-правила",
    purpose:
      "Централизованные промо на цикл: приоритет, stackability, scope и даты. Дополняют промо % в строке матрицы.",
    steps: [
      "Добавьте правило с названием и priority (меньше число = выше приоритет).",
      "Stackable = да: скидки перемножаются; нет — одно non-stack правило + row promo.",
      "Scope: all | sku | category | channel | customer + значение.",
      "valid_from / valid_to должны включать pricing date цикла.",
      "Сохраните вкладку → пересчитайте измерения.",
    ],
    inApp: [
      "Конфликты non-stackable разрешаются по priority, не по максимальной скидке.",
      "Нет визуального календаря пересечений — проверяйте даты вручную.",
    ],
    notIncluded: [
      "Promo calendar / Gantt, пересечения промо по SKU в одном клиенте",
      "Funding split (производитель vs ритейлер vs совместное)",
      "Uplift, baseline, promo ROI / ROTI",
      "Cannibalization и halo между SKU",
      "Автоматический выбор «лучшего» набора промо под бюджет",
    ],
  },
  customers: {
    title: "Справочник клиентов",
    purpose: "Мастер-данные клиентов: код в колонке customer_code матрицы цен.",
    steps: [
      "Код — латиница, без пробелов (например CUST-X5).",
      "Заполните название и регион при необходимости.",
      "Снимите «Активен» для архивных клиентов.",
      "Сохраните перед заполнением матрицы.",
    ],
    inApp: ["Связь с матрицей только по текстовому коду — FK на справочник не enforced в UI."],
    notIncluded: [
      "Иерархия холдинг → сеть → banner",
      "Контрактные условия на уровне холдинга (наследование вниз)",
      "Кредитные лимиты, Incoterms, региональные юрлица",
      "Синхронизация с CRM / ERP",
    ],
  },
  channels: {
    title: "Справочник каналов",
    purpose: "Каналы сбыта для колонки «Канал» в матрице (modern_trade, e_com, horeca).",
    steps: [
      "Добавьте уникальный code и название.",
      "Используйте те же codes в матрице цен.",
      "Сохраните изменения.",
    ],
    inApp: ["Промо scope type = channel ссылается на эти же коды."],
    notIncluded: [
      "Подканалы, региональные исключения",
      "Разные price architecture по каналам (автопаритет SKU)",
      "Distributor vs direct vs retail price ladder",
    ],
  },
  dimensions: {
    title: "Измерения NRM",
    purpose:
      "Результат расчёта: price waterfall, Net Revenue, маржа, налог. Только просмотр — правки на вкладке «Матрица цен».",
    steps: [
      "Выполните «Рассчитать» после сохранения исходных данных.",
      "Проверьте waterfall: list → invoice unit → net unit → net revenue.",
      "Смотрите tier %, promo %, applied_promos (JSON правил).",
      "Сверьте итоги цикла над таблицей.",
      "Статусы: черновик → симуляция (расчёт) → утверждён → опубликован + snapshot.",
    ],
    inApp: [
      "Gross Revenue = list × volume; Net Revenue = net unit × volume (trade spend уже в net unit).",
      "Gross Margin = Net Revenue − COGS (trade spend не вычитается второй раз).",
      "Margin % на итогах — взвешенная по Net Revenue, не среднее по строкам.",
    ],
    notIncluded: [
      "NSV/NIV отчётность в терминологии ERP без маппинга",
      "План/факт по отгрузкам и пересчёт объёма",
      "Детальный GTN bridge в 15+ ступеней (rebate in arrears, listing и т.д.)",
      "Экспорт в BI, PowerPoint, regulatory reporting",
    ],
  },
  snapshots: {
    title: "Snapshots",
    purpose: "Зафиксированный расчёт на момент публикации — для аудита и сравнения.",
    steps: [
      "Snapshot создаётся при «Опубликовать + Snapshot».",
      "Выберите запись в списке — откроется зафиксированная таблица измерений.",
      "Для сравнения сценариев используйте вкладку «Сравнение циклов».",
    ],
    inApp: [
      "В snapshot сохраняются pricing date, фильтры, totals и все строки расчёта на дату publish.",
      "Редактирование опубликованного цикла заблокировано.",
    ],
    notIncluded: [
      "Версионирование каждого изменения поля (кто/когда/что было до)",
      "Юридически значимый электронный sign-off",
      "Автосверка snapshot с фактическими инвойсами",
      "Хранение внешних вложений (контракты, письма ритейлера)",
    ],
  },
  compare: {
    title: "Сравнение циклов",
    purpose: "Дельта Net Revenue и маржи между двумя сценариями при одинаковых фильтрах и pricing date.",
    steps: [
      "Выберите цикл A (база) и B (сравнение) — должны быть разные циклы.",
      "Задайте pricing date и фильтры в «Параметрах расчёта» — они общие для обоих.",
      "Нажмите «Сравнить циклы».",
      "Сопоставление строк: SKU + customer_code + channel.",
      "Интерпретация: Δ Net Rev > 0 — рост выручки в сценарии B при тех же допущениях по объёму.",
    ],
    inApp: [
      "Сравниваются пересчитанные измерения, а не сохранённые snapshot (если циклы не published).",
      "Строки только в одном цикле показываются с нулём в другом.",
    ],
    notIncluded: [
      "Сравнение >2 сценариев или waterfall diff по каждой ступени",
      "Сравнение план vs факт (actuals из ERP)",
      "Price/volume mix decomposition (цена vs объём vs mix)",
      "Statistical significance / elasticity charts",
    ],
  },
};
