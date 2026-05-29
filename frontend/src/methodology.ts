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

export interface RoadmapFeature {
  name: string;
  why: string;
  how: string;
}

export interface RoadmapWave {
  wave: 1 | 2 | 3;
  title: string;
  subtitle: string;
  features: RoadmapFeature[];
}

/** Roadmap приближения к production NRM без интеграций с ERP/CRM/BI */
export const PRODUCTION_ROADMAP = {
  title: "Развитие demo → production NRM",
  intro:
    "Функции ниже можно реализовать на текущем стеке (PostgreSQL + API + React) без подключения внешних систем. " +
    "Интеграции с ERP, CRM и BI остаются отдельным этапом.",
  waves: [
    {
      wave: 1,
      title: "Волна 1 — быстрый эффект",
      subtitle: "Контроль качества цен, отчётность и согласование",
      features: [
        {
          name: "Guardrails (floor price / min margin)",
          why: "Блокировка недопустимых цен до публикации",
          how: "Пороги на цикле; флаги по строкам при расчёте; запрет publish при critical",
        },
        {
          name: "Валидация матрицы (MDM-lite)",
          why: "Меньше ошибок до расчёта",
          how: "Дубликаты SKU×клиент×канал с пересечением дат; неизвестные коды; отрицательный net/margin",
        },
        {
          name: "Расширенный GTN waterfall",
          why: "Ближе к gross-to-net отчёту финансов",
          how: "Опциональные поля: listing fee, logistics, rebate in arrears % → ступени в измерениях",
        },
        {
          name: "Waterfall diff при сравнении",
          why: "Понять, где потеряна маржа между сценариями",
          how: "Δ по contract / promo / tier / off-invoice / trade, не только Net Revenue",
        },
        {
          name: "Price / volume / mix",
          why: "Стандарт RGM-анализа",
          how: "Декомпозиция Δ выручки при сравнении циклов с одинаковым объёмом",
        },
        {
          name: "Экспорт CSV / Excel",
          why: "Обмен с финансами без API",
          how: "Выгрузка матрицы, измерений, snapshot и сравнения из UI",
        },
        {
          name: "Audit trail изменений",
          why: "Аудит и разбор спорных решений",
          how: "Журнал: сущность, поле, было/стало, время, пользователь (demo_user)",
        },
        {
          name: "Комментарии к циклу / строке",
          why: "Контекст при согласовании",
          how: "Текст + автор + дата на цикл или строку матрицы",
        },
      ],
    },
    {
      wave: 2,
      title: "Волна 2 — процесс и промо (TPM-lite)",
      subtitle: "Планирование промо и иерархии без claims из ERP",
      features: [
        {
          name: "Календарь промо",
          why: "Визуальное планирование пересечений",
          how: "Timeline / Gantt по valid_from / valid_to существующих правил",
        },
        {
          name: "Предупреждения о пересечениях",
          why: "Конфликты non-stack и двойного промо",
          how: "Проверка при сохранении: два non-stack на один scope и даты",
        },
        {
          name: "Funding split",
          why: "Кто финансирует промо",
          how: "Поля manufacturer_pct / retailer_pct на правиле; split trade spend в отчёте",
        },
        {
          name: "Бюджет trade spend",
          why: "Контроль инвестиций в торговые условия",
          how: "Лимит на цикл vs сумма trade × volume + off-invoice в деньгах",
        },
        {
          name: "Baseline + uplift (упрощённый ROI)",
          why: "Оценка промо без ML и DWH",
          how: "Ручной baseline / promo volume; ROTI = (incremental margin − cost) / cost",
        },
        {
          name: "Иерархия продуктов",
          why: "Rollup brand → category → SKU",
          how: "Справочник SKU с parent; группировка и subtotal в измерениях",
        },
        {
          name: "Иерархия клиентов",
          why: "Условия на уровне холдинга",
          how: "parent_customer_code; наследование contract % с override на строке",
        },
        {
          name: "Усиленный workflow",
          why: "Согласование как в enterprise",
          how: "Пороги margin → ограничения simulated / publish; комментарий при отклонении",
        },
        {
          name: "Sign-off lite",
          why: "Фиксация решения без eIDAS",
          how: "При publish: ФИО/роль + checkbox + timestamp в metadata snapshot",
        },
      ],
    },
    {
      wave: 3,
      title: "Волна 3 — аналитика на ручных допущениях",
      subtitle: "RGM-сценарии без исторических данных из DWH",
      features: [
        {
          name: "Эластичность спроса",
          why: "«Что если» по цене и объёму",
          how: "Коэффициент ε на SKU/категорию: volume_new = volume × (price_new/price_old)^ε",
        },
        {
          name: "Cannibalization / halo",
          why: "Влияние промо на соседние SKU",
          how: "Матрица коэффициентов вручную; предупреждение в симуляции",
        },
        {
          name: "Pack-price architecture",
          why: "Паритет упаковок в линейке",
          how: "pack_size, цена за pack → derived EA; проверка паритета SKU",
        },
        {
          name: "Price index vs конкурент",
          why: "Позиционирование без price scraper",
          how: "Поле competitor_ref_price + gap % в измерениях",
        },
        {
          name: "Сравнение 3+ сценариев",
          why: "Комитет по ценам",
          how: "Таблица циклов × KPI или база + N альтернатив",
        },
        {
          name: "Diff snapshot ↔ snapshot",
          why: "Версии внутри цикла",
          how: "Сравнение двух публикаций одного цикла",
        },
        {
          name: "План / факт (упрощённо)",
          why: "Отчётность без live ERP",
          how: "Ручная загрузка CSV факта объёма/выручки → колонки plan vs actual",
        },
      ],
    },
  ] as RoadmapWave[],
  deferred: {
    title: "Отложено до интеграций или отдельного продукта",
    items: [
      {
        name: "Accrual, claims, deductions",
        reason: "Нужны документы и статусы выплат из ERP",
      },
      {
        name: "Автооптимизация промо под бюджет",
        reason: "Требуется модель спроса или история продаж",
      },
      {
        name: "Юридически значимый e-sign",
        reason: "Отдельный провайдер подписи",
      },
      {
        name: "Автосверка с инвойсами",
        reason: "Нужны фактические строки счетов",
      },
      {
        name: "Интеграция ERP / CRM / BI",
        reason: "Вне scope demo; CSV/Excel — промежуточный вариант",
      },
    ],
  },
  recommendedOrder: [
    "Guardrails + валидация матрицы",
    "Waterfall diff + экспорт",
    "Календарь промо + пересечения + бюджет trade",
    "Иерархии + rollup-отчёты",
    "Ручная эластичность и uplift ROI",
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
      "Сохраните вкладку → «Рассчитать» (панель действий).",
      "Новый цикл («+ Цикл»): автоматически подгружаются демо-данные (4 строки матрицы, tiers, 3 промо). " +
        "Если выбран другой цикл — копируются его данные вместо шаблона.",
    ],
    inApp: [
      "Pricing date задаётся выше. Фильтры категория/канал/клиент по умолчанию пустые — в расчёт попадают все строки; заполните фильтр только для среза.",
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
      "Выберите цикл A и B — таблица и итоги обновятся автоматически (кнопка «Обновить» — при необходимости).",
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
