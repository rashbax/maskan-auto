// ============ Maskan — mock data + i18n (UZ / RU / EN) ============

// "Today" in Tashkent (the business timezone, UTC+5, no DST). Computing the date there means
// the server (UTC) and the client (visitor-local) agree on the same Y/M/D — no midnight drift
// or hydration mismatch. Drives the calendar min date + past-date blocking.
const TODAY = (() => {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tashkent", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).split("-").map(Number);
  return new Date(y, m - 1, d);
})();

const iso = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const addDays = (d, n) => {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
};

// deterministic "random" so layouts are stable
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// build a set of busy ISO dates for the next ~75 days
function makeBusy(seed, density) {
  const rnd = seeded(seed);
  const set = new Set();
  let cursor = 1;
  while (cursor < 75) {
    if (rnd() < density) {
      const len = 1 + Math.floor(rnd() * 4);
      for (let i = 0; i < len; i++) set.add(iso(addDays(TODAY, cursor + i)));
      cursor += len + 1 + Math.floor(rnd() * 5);
    } else {
      cursor += 1 + Math.floor(rnd() * 3);
    }
  }
  return set;
}

const TONES = {
  sage: { a: "#cdd9c9", b: "#aebfa6", ink: "#2c3a2c" },
  clay: { a: "#e3cdbd", b: "#cda98f", ink: "#4a3526" },
  sky: { a: "#c6d2dc", b: "#a3b6c6", ink: "#2a3a47" },
  sand: { a: "#e6dcc4", b: "#d2c39e", ink: "#46402b" },
  rose: { a: "#e2cdcb", b: "#caa9a6", ink: "#45302e" },
  stone: { a: "#d8d2c8", b: "#bcb4a6", ink: "#3a362e" },
};

const AMENITIES = {
  wifi: { ru: "Wi-Fi", en: "Wi-Fi", uz: "Wi-Fi" },
  ac: { ru: "Кондиционер", en: "Air conditioning", uz: "Konditsioner" },
  kitchen: { ru: "Кухня", en: "Kitchen", uz: "Oshxona" },
  washer: { ru: "Стиральная машина", en: "Washer", uz: "Kir mashinasi" },
  parking: { ru: "Парковка", en: "Free parking", uz: "Bepul avtoturargoh" },
  tv: { ru: "Smart TV", en: "Smart TV", uz: "Smart TV" },
  elevator: { ru: "Лифт", en: "Elevator", uz: "Lift" },
  heating: { ru: "Отопление", en: "Heating", uz: "Isitish" },
  workspace: { ru: "Рабочее место", en: "Workspace", uz: "Ish joyi" },
  balcony: { ru: "Балкон", en: "Balcony", uz: "Balkon" },
  selfcheckin: { ru: "Самостоятельное заселение", en: "Self check-in", uz: "Mustaqil joylashish" },
  water: { ru: "Горячая вода 24/7", en: "Hot water 24/7", uz: "Issiq suv 24/7" },
};

const DISTRICTS = {
  mirobod: { ru: "Мирабад", en: "Mirobod", uz: "Mirobod", centre: true },
  yakkasaroy: { ru: "Яккасарай", en: "Yakkasaroy", uz: "Yakkasaroy", centre: true },
  chilonzor: { ru: "Чиланзар", en: "Chilonzor", uz: "Chilonzor", centre: false },
  yunusobod: { ru: "Юнусабад", en: "Yunusobod", uz: "Yunusobod", centre: false },
  shayxontohur: { ru: "Шайхантахур", en: "Shaykhantakhur", uz: "Shayxontohur", centre: true },
  mirzoulugbek: { ru: "Мирзо-Улугбек", en: "Mirzo Ulugbek", uz: "Mirzo Ulugʻbek", centre: false },
};

const APARTMENTS = [
  {
    id: "a1", tone: "sage", price: 42, district: "mirobod", sleeps: 4, beds: 2, baths: 1, size: 58,
    rating: 4.92, reviews: 128, photos: 27, host: "Dilnoza", superhost: true,
    near: { ru: "5 мин до м. Ойбек", en: "5 min to Oybek metro", uz: "Oybek metrosiga 5 daqiqa" },
    amenities: ["wifi", "ac", "kitchen", "washer", "tv", "elevator", "selfcheckin", "water", "workspace", "balcony"],
    title: { ru: "Светлая студия в центре, у метро Ойбек", en: "Bright studio in the centre, by Oybek metro", uz: "Markazdagi yorug studiya, Oybek metrosi yonida" },
    blurb: { ru: "Тихая квартира в зелёном дворе, в 5 минутах от метро. Идеально для пары или небольшой семьи.", en: "Quiet flat on a green courtyard, 5 min from the metro. Perfect for a couple or small family.", uz: "Yashil hovlidagi tinch kvartira, metrodan 5 daqiqa. Juftlik yoki kichik oila uchun ideal." },
  },
  {
    id: "a2", tone: "clay", price: 35, district: "yakkasaroy", sleeps: 2, beds: 1, baths: 1, size: 41,
    rating: 4.81, reviews: 74, photos: 25, host: "Sardor", superhost: false,
    near: { ru: "10 мин до Бродвея", en: "10 min to Broadway", uz: "Brodveyga 10 daqiqa" },
    amenities: ["wifi", "ac", "kitchen", "tv", "heating", "selfcheckin", "water"],
    title: { ru: "Уютная квартира рядом с Бродвеем", en: "Cosy flat near Broadway", uz: "Brodvey yonidagi shinam kvartira" },
    blurb: { ru: "Компактная и тёплая квартира в самом сердце города. До главных кафе и парков — пешком.", en: "Compact, warm flat in the heart of the city. Walk to the main cafés and parks.", uz: "Shaharning markazidagi ixcham va issiq kvartira. Asosiy kafe va bogʻlarga piyoda." },
  },
  {
    id: "a3", tone: "sky", price: 58, district: "mirzoulugbek", sleeps: 6, beds: 3, baths: 2, size: 96,
    rating: 4.97, reviews: 203, photos: 31, host: "Kamola", superhost: true,
    near: { ru: "7 мин до Magic City", en: "7 min to Magic City", uz: "Magic City’ga 7 daqiqa" },
    amenities: ["wifi", "ac", "kitchen", "washer", "parking", "tv", "elevator", "heating", "selfcheckin", "water", "workspace", "balcony"],
    title: { ru: "Просторные 3 комнаты для семьи", en: "Spacious 3-room flat for a family", uz: "Oila uchun keng 3 xonali kvartira" },
    blurb: { ru: "Много места, две ванные и парковка. Отлично для семьи или компании друзей.", en: "Lots of space, two bathrooms and parking. Great for a family or group of friends.", uz: "Koʻp joy, ikkita hammom va avtoturargoh. Oila yoki doʻstlar uchun zoʻr." },
  },
  {
    id: "a4", tone: "sand", price: 29, district: "chilonzor", sleeps: 3, beds: 1, baths: 1, size: 48,
    rating: 4.74, reviews: 51, photos: 26, host: "Bek", superhost: false,
    near: { ru: "3 мин до м. Чиланзар", en: "3 min to Chilonzor metro", uz: "Chilonzor metrosiga 3 daqiqa" },
    amenities: ["wifi", "ac", "kitchen", "washer", "tv", "heating", "water"],
    title: { ru: "Бюджетная квартира у метро", en: "Budget flat by the metro", uz: "Metro yonidagi arzon kvartira" },
    blurb: { ru: "Простая чистая квартира по отличной цене. Прямо над метро — весь город в 20 минутах.", en: "Simple, clean flat at a great price. Right above the metro — the whole city in 20 min.", uz: "Ajoyib narxdagi oddiy va toza kvartira. Metro tepasida — butun shahar 20 daqiqada." },
  },
  {
    id: "a5", tone: "rose", price: 49, district: "shayxontohur", sleeps: 4, beds: 2, baths: 1, size: 62,
    rating: 4.88, reviews: 96, photos: 28, host: "Nigora", superhost: true,
    near: { ru: "8 мин до Чорсу", en: "8 min to Chorsu bazaar", uz: "Chorsu bozoriga 8 daqiqa" },
    amenities: ["wifi", "ac", "kitchen", "washer", "tv", "elevator", "selfcheckin", "water", "balcony"],
    title: { ru: "Квартира с видом у базара Чорсу", en: "Flat with a view near Chorsu bazaar", uz: "Chorsu bozori yonidagi manzarali kvartira" },
    blurb: { ru: "Старый город под окнами. Колоритный район, купола Чорсу и лучшая еда Ташкента рядом.", en: "The old city under your windows. Colourful area, Chorsu domes and Tashkent’s best food nearby.", uz: "Deraza ostida eski shahar. Rang-barang hudud, Chorsu gumbazlari va eng mazali taomlar yonida." },
  },
  {
    id: "a6", tone: "stone", price: 38, district: "yunusobod", sleeps: 4, beds: 2, baths: 1, size: 55,
    rating: 4.79, reviews: 63, photos: 25, host: "Jamshid", superhost: false,
    near: { ru: "6 мин до Ташкент-Сити", en: "6 min to Tashkent City", uz: "Tashkent City’ga 6 daqiqa" },
    amenities: ["wifi", "ac", "kitchen", "washer", "parking", "tv", "elevator", "heating", "water"],
    title: { ru: "Современная квартира у Ташкент-Сити", en: "Modern flat near Tashkent City", uz: "Tashkent City yonidagi zamonaviy kvartira" },
    blurb: { ru: "Новый дом, свежий ремонт, рядом парк Ташкент-Сити и небоскрёбы. Тихо и удобно.", en: "New building, fresh renovation, next to Tashkent City park and the towers. Quiet and convenient.", uz: "Yangi bino, yangi taʼmir, Tashkent City bogʻi va minoralar yonida. Tinch va qulay." },
  },
];

// attach availability sets
APARTMENTS.forEach((a, i) => {
  a.busy = makeBusy((i + 3) * 97 + 5, 0.32 + i * 0.03);
});

// ---------- guest reviews ----------
const REVIEWS = {
  a1: [
    { name: "Anna S.", country: "DE", rating: 5, date: "2026-05-22", cons: "", text: "Очень чисто и тихо, до метро правда 5 минут. Хозяйка прислала адрес сразу в Telegram — всё было понятно." },
    { name: "Marco", country: "IT", rating: 5, date: "2026-05-10", cons: "Lift was a little slow", text: "Great location, exactly like the photos. Self check-in worked perfectly, would book again." },
    { name: "Дилёр", country: "UZ", rating: 4, date: "2026-04-28", cons: "Вечером немного слышно соседей", text: "Хорошая квартира за свои деньги, всё работало, заселение быстрое." },
  ],
  a2: [
    { name: "Sophie", country: "FR", rating: 5, date: "2026-05-18", cons: "", text: "Tiny but cosy, perfect for two. Walked everywhere from here. Host replied in minutes." },
    { name: "Олег", country: "RU", rating: 4, date: "2026-05-02", cons: "Кухня маловата", text: "В целом отлично, центр, всё рядом. Рекомендую для короткой поездки." },
  ],
  a3: [
    { name: "James", country: "GB", rating: 5, date: "2026-05-25", cons: "", text: "Huge flat, came with family of five and everyone had space. Parking was a big plus." },
    { name: "Kamila", country: "KZ", rating: 5, date: "2026-05-12", cons: "", text: "Очень просторно и чисто, две ванные — это спасение с детьми. Спасибо!" },
    { name: "Chen", country: "CN", rating: 4, date: "2026-04-30", cons: "A bit far from the metro", text: "Comfortable and quiet, great for a longer stay. Kitchen well equipped." },
  ],
  a4: [
    { name: "Tom", country: "NL", rating: 4, date: "2026-05-20", cons: "Street can be noisy at rush hour", text: "Unbeatable price right above the metro. Simple, clean, did the job." },
    { name: "Зухра", country: "UZ", rating: 5, date: "2026-05-06", cons: "", text: "За эти деньги — супер. Всё чисто, хозяин на связи." },
  ],
  a5: [
    { name: "Elena", country: "RU", rating: 5, date: "2026-05-21", cons: "", text: "Старый город прямо под окном, утром купола Чорсу. Незабываемо, очень атмосферно." },
    { name: "David", country: "US", rating: 4, date: "2026-05-08", cons: "Stairs, no elevator to the flat", text: "Loved the character of the area. Best food in the city two minutes away." },
  ],
  a6: [
    { name: "Yuki", country: "JP", rating: 5, date: "2026-05-19", cons: "", text: "Brand new, spotless, quiet. The towers view at night is beautiful. Smooth check-in." },
    { name: "Иван", country: "RU", rating: 4, date: "2026-05-03", cons: "Немного далеко от старого города", text: "Современно и удобно, рядом парк. Для деловой поездки идеально." },
  ],
};
APARTMENTS.forEach((a) => {
  a.reviewsList = REVIEWS[a.id] || [];
});

// ---------- this guest's own bookings (for the Bookings tab) ----------
const GUEST_BOOKINGS = [
  { id: "BK-3120", apt: "a1", from: iso(TODAY), to: iso(addDays(TODAY, 3)), nights: 3, usd: 126, status: "active" },
  { id: "BK-2994", apt: "a5", from: iso(addDays(TODAY, -22)), to: iso(addDays(TODAY, -18)), nights: 4, usd: 196, status: "past" },
  { id: "BK-2961", apt: "a6", from: iso(addDays(TODAY, -55)), to: iso(addDays(TODAY, -52)), nights: 3, usd: 114, status: "past" },
  { id: "BK-3041", apt: "a3", from: iso(addDays(TODAY, -9)), to: iso(addDays(TODAY, -7)), nights: 2, usd: 116, status: "cancelled" },
];

// ---------- bookings for admin ----------
const BOOKINGS = [
  { id: "BK-3120", apt: "a1", guest: "Anna Schmidt", phone: "+49 151 23456789", tg: "@anna_s", from: iso(TODAY), to: iso(addDays(TODAY, 3)), nights: 3, total: 126, source: "website", status: "active", created: iso(TODAY) },
  { id: "BK-3119", apt: "a3", guest: "Liu Wei", phone: "+86 138 0013 8000", tg: "", from: iso(addDays(TODAY, 1)), to: iso(addDays(TODAY, 6)), nights: 5, total: 290, source: "booking", status: "active", created: iso(addDays(TODAY, -1)) },
  { id: "BK-3118", apt: "a5", guest: "Olivier Bernard", phone: "+33 6 12 34 56 78", tg: "@oliv", from: iso(addDays(TODAY, 2)), to: iso(addDays(TODAY, 4)), nights: 2, total: 98, source: "website", status: "active", created: iso(addDays(TODAY, -1)) },
  { id: "BK-3117", apt: "a2", guest: "Иван Петров", phone: "+7 916 555 0199", tg: "@ivanp", from: iso(addDays(TODAY, -2)), to: iso(TODAY), nights: 2, total: 70, source: "manual", status: "checked-out", created: iso(addDays(TODAY, -4)) },
  { id: "BK-3116", apt: "a6", guest: "Sofia Rossi", phone: "+39 333 1234567", tg: "", from: iso(addDays(TODAY, 5)), to: iso(addDays(TODAY, 9)), nights: 4, total: 152, source: "website", status: "active", created: iso(addDays(TODAY, -2)) },
];

// ---------- i18n ----------
const STR = {
  ru: {
    code: "RU", name: "Русский",
    search_city: "Ташкент", stay: "Проживание", guests: "Гости", guest_n: (n) => `${n} ${n === 1 ? "гость" : n < 5 ? "гостя" : "гостей"}`,
    anydates: "Выберите даты", district: "Район", all_districts: "Все районы", centre: "Центр",
    pernight: "за ночь", night_n: (n) => `${n} ${n === 1 ? "ночь" : n < 5 ? "ночи" : "ночей"}`, sleeps: (n) => `до ${n} гостей`,
    from: "Заезд", to: "Выезд", total: "Итого", nofees: "Без скрытых комиссий", price_approx: "≈ примерно · оплата в USD/наличными", service: "Сервисный сбор", cleaning: "Уборка",
    book_now: "Забронировать", booking: "Бронирование", see_all_photos: (n) => `Показать все ${n} фото`,
    amenities: "Удобства", show_all_amenities: "Все удобства", house_rules: "Правила", checkin: "Заезд", checkout: "Выезд",
    where: "Где вы остановитесь", address_after: "Точный адрес мы отправим в Telegram сразу после бронирования — так безопаснее для всех.",
    available: "Свободно", busy: "Занято", select_dates: "Выберите даты", clear: "Очистить",
    reserve_title: "Почти готово", your_name: "Ваше имя", phone: "Телефон", tg_optional: "Telegram (по желанию)",
    name_ph: "Например, Анна", phone_help: "Чтобы прислать адрес и ключи", tg_help: "Удобнее всего держать связь",
    confirm_book: "Подтвердить бронь", booked: "Готово, вы забронировали!", whatsnext: "Что дальше",
    next_1: "Мы отправили адрес и инструкции по заезду в Telegram и SMS.", next_2: "Хозяин — Dilnoza — встретит вас или пришлёт код от замка.", next_3: "Появились вопросы? Напишите прямо в чат — отвечаем быстро.",
    save_booking_warn: "Важно: при закрытии окна данные брони пропадут — сделайте скриншот или откройте Telegram. Без аккаунта придётся ждать, пока хозяин свяжется с вами; зарегистрируйтесь, чтобы видеть и управлять бронями.",
    booking_no: "Номер брони", contact_host: "Связаться с хозяином", done: "Отлично", verify_phone: "Подтвердить номер",
    otp_title: "Введите код из SMS", otp_sub: "Мы отправили 4 цифры на", skip: "Пропустить", resend: "Отправить снова",
    no_results: "Ничего не нашлось", no_results_sub: "Попробуйте изменить даты или район — свободных вариантов станет больше.", reset: "Сбросить фильтры",
    sold_out: "Всё занято на эти даты", sold_out_sub: "Эта квартира занята на выбранные дни. Посмотрите другие даты или похожие варианты.", similar: "Похожие квартиры",
    error_title: "Что-то пошло не так", error_sub: "Не удалось загрузить. Проверьте соединение и попробуйте снова.", retry: "Повторить",
    superhost: "Суперхозяин", reviews_n: (n) => `${n} отзыва`, response: "Отвечает за ~10 минут",
    catalog: "Каталог", admin: "Админ", filters: "Фильтры", apply: "Показать",
    a_dashboard: "Сводка", a_today: "Заезды сегодня", a_staying: "Сейчас проживают", a_upcoming: "Предстоящие", a_occupancy: "Загрузка", a_revenue: "Доход за месяц",
    a_listings: "Квартиры", a_bookings: "Брони", a_calendar: "Календарь", a_add: "Добавить квартиру", a_edit: "Редактировать",
    a_photos: "Фотографии", a_drop: "Перетащите фото сюда или нажмите, чтобы выбрать", a_cover: "Обложка", a_setcover: "Сделать обложкой",
    a_price: "Цена за ночь", a_save: "Сохранить", a_block: "Заблокировать", a_unblock: "Открыть", a_source: "Источник",
    a_guest: "Гость", a_dates: "Даты", a_status: "Статус", a_cancel: "Отменить", a_blocked: "Закрыто вручную",
    bd_phone: "Телефон", bd_ref: "Номер брони", bd_booked: "Создано", bd_call: "Позвонить", bd_active: "Активна", bd_past: "Завершена", bd_cancelled: "Отменена",
    cal_search: "Поиск по названию или ID", cal_unsaved: "Несохранённые изменения",
    cal_to_block: "закрыть", cal_to_open: "открыть", cal_pending: "ожидает", cal_today: "Сегодня", cal_free: "Свободно", cal_occ: "загрузка",
    cal_helper: "Нажмите или проведите по дням, затем «Сохранить».",
    src_website: "Сайт", src_booking: "Booking.com", src_manual: "Вручную", a_all: "Все", login: "Войти", password: "Пароль", admin_login: "Вход для хозяина",
    a_desc: "Описание", a_desc_ph: "Расскажите о квартире: район, вид, для кого подходит…",
    a_guests_field: "Сколько гостей", a_adults: "Взрослые", a_children: "Дети", a_beds: "Спальня", a_living: "Гостиная", a_baths: "Санузел", a_size: "Площадь, м²", a_near: "Ориентир (рядом)", a_near_ph: "Напр.: 5 минут до метро",
    a_address: "Точный адрес дома", a_address_help: "Виден гостю ТОЛЬКО после брони. Это адрес дома, не квартиры.", a_address_ph: "ул. Шота Руставели, 12",
    a_location: "Локация на карте", a_location_help: "Передвиньте точку — гость увидит только примерный район",
    reviews_title: "Отзывы", leave_review: "Оставить отзыв", your_rating: "Ваша оценка",
    cons_label: "Что можно улучшить", cons_ph: "Например: вечером слышно соседей (необязательно)",
    comment_label: "Общий комментарий", comment_ph: "Что понравилось, как прошло заселение…",
    submit_review: "Отправить отзыв", review_thanks: "Спасибо за отзыв!", review_thanks_sub: "Он помогает другим гостям и хозяину.",
    rate_required: "Поставьте оценку", minuses: "Минусы", based_on: (n) => `на основе ${n} отзыв${n === 1 ? "а" : n < 5 ? "ов" : "ов"}`,
    chat_whatsapp: "Написать в WhatsApp", chat_telegram: "Написать в Telegram", questions_title: "Остались вопросы?", questions_sub: "Напишите нам — быстро ответим на узбекском, русском или английском.",
    pref_messenger: "Куда прислать адрес и ключи?", pref_help: "Ваш номер работает и в WhatsApp.", get_whatsapp: "Получить в WhatsApp", get_telegram: "Получить в Telegram", help_contact: "Помощь и контакты",
    nav_search: "Поиск", nav_saved: "Избранное", nav_bookings: "Брони", nav_account: "Профиль",
    saved_title: "Избранное", saved_empty: "Пока пусто", saved_empty_sub: "Нажимайте на сердечко, чтобы сохранять понравившиеся квартиры.",
    bookings_title: "Мои брони", tab_active: "Активные", tab_past: "Прошедшие", tab_cancelled: "Отменённые",
    st_confirmed: "Подтверждено", st_completed: "Завершено", st_cancelled: "Отменено",
    book_again: "Забронировать снова", bookings_empty: "Здесь пока ничего нет", bookings_empty_sub: "Ваши брони появятся здесь.",
    account_title: "Профиль", login_title: "Войдите в Maskan", login_sub: "Чтобы сохранять квартиры и видеть свои брони. Бронировать можно и без входа.",
    login_telegram: "Войти через Telegram", login_google: "Войти через Google", logout: "Выйти",
    login_required: "Нужен вход", login_required_sub: "Войдите в один тап, чтобы видеть этот раздел.", settings: "Настройки", language: "Язык",
    a_email: "Эл. почта", a_2fa_title: "Подтвердите вход", a_2fa_sub: "Введите 6-значный код из приложения-аутентификатора.", a_signin: "Войти в панель",
    a_alert_title: "Уведомление о входе", a_alert_sub: "Владелец получает сообщение в Telegram при каждом входе в админ-панель.",
    a_404: "Страница не найдена", a_404_sub: "Такой страницы не существует.", a_secure: "Защищённый вход",
    a_moderate: "Модерация", a_hide: "Скрыть", a_unhide: "Вернуть", a_reply: "Ответить", a_reply_ph: "Ответ от имени Maskan…", a_send_reply: "Опубликовать ответ",
    a_hidden: "Скрыт", host_reply: "Ответ хозяина", a_hide_reason: "Причина (для журнала)", a_hide_reasons: ["Спам", "Оскорбления", "Не по теме", "Личные данные"],
    a_audit: "Журнал действий", cannot_edit: "Текст отзыва редактировать нельзя",
    // --- property file (admin-only internal ops) + suppliers ---
    a_pfile: "Паспорт квартиры", a_suppliers: "Поставщики",
    pf_internal: "Внутренние данные — гостям не показываются", pf_add: "Добавить паспорт",
    pf_badge: "Паспорт", pf_draft: "Не заполнен", pf_standalone: "Отдельный",
    pf_new_hint: "Паспорт можно создать ещё до публичного объявления.", pf_apt_name: "Название квартиры",
    pf_rent_due: (d) => `Аренда: ${d}-е число`,
    pf_g_owner: "Владелец и договор", pf_owner: "Владелец", pf_owner_phone: "Телефон владельца",
    pf_lease_start: "Начало договора", pf_lease_end: "Конец договора", pf_deposit: "Залог (UZS)",
    pf_g_rent: "Ежемесячная аренда", pf_g_rent_sub: "выплата владельцу",
    pf_amount: "Сумма", pf_pay_day: "День оплаты (месяца)", pf_last_paid: "Последняя оплата",
    pf_g_util: "Коммуналка и счётчики", pf_electric: "Счётчик электро №", pf_electric_reading: "Последнее показание",
    pf_gas: "Лицевой счёт (газ)", pf_water: "Лицевой счёт (вода)", pf_internet: "Интернет-провайдер",
    pf_internet_acc: "Лицевой счёт (интернет)", pf_hoa: "Коммунальные / КСК (UZS)",
    pf_g_access: "Доступ и ключи", pf_floor: "Этаж", pf_intercom: "Домофон / код двери",
    pf_keybox: "Код сейфа для ключей", pf_key_sets: "Комплекты ключей", pf_sets: "компл.",
    pf_g_notes: "Заметки", pf_notes_ph: "Внутренние заметки…",
    sup_add: "Добавить поставщика", sup_edit_title: "Изменить поставщика",
    sup_name: "Название / имя", sup_product: "Товар / услуга", sup_contact: "Контакт",
    sup_name_ph: "Напр. ООО «Чистый дом»", sup_product_ph: "Напр. уборка", sup_contact_ph: "Телефон / Telegram",
    sup_empty: "Поставщиков пока нет", sup_empty_sub: "Добавьте первого поставщика.",
    back: "Назад", mobile: "Телефон", desktop: "Десктоп", night1: "ночь",
  },
  en: {
    code: "EN", name: "English",
    search_city: "Tashkent", stay: "Stay", guests: "Guests", guest_n: (n) => `${n} guest${n > 1 ? "s" : ""}`,
    anydates: "Choose dates", district: "District", all_districts: "All districts", centre: "Centre",
    pernight: "per night", night_n: (n) => `${n} night${n > 1 ? "s" : ""}`, sleeps: (n) => `sleeps ${n}`,
    from: "Check-in", to: "Check-out", total: "Total", nofees: "No hidden fees", price_approx: "≈ approx · paid in USD/cash", service: "Service fee", cleaning: "Cleaning",
    book_now: "Book now", booking: "Booking", see_all_photos: (n) => `Show all ${n} photos`,
    amenities: "Amenities", show_all_amenities: "All amenities", house_rules: "House rules", checkin: "Check-in", checkout: "Check-out",
    where: "Where you’ll be", address_after: "We send the exact address on Telegram the moment you book — it’s safer for everyone.",
    available: "Free", busy: "Booked", select_dates: "Select dates", clear: "Clear",
    reserve_title: "Almost there", your_name: "Your name", phone: "Phone", tg_optional: "Telegram (optional)",
    name_ph: "e.g. Anna", phone_help: "So we can send the address & keys", tg_help: "The easiest way to stay in touch",
    confirm_book: "Confirm booking", booked: "You’re booked!", whatsnext: "What happens next",
    next_1: "We sent the address and check-in steps to your Telegram and SMS.", next_2: "Your host Dilnoza will meet you or send the door code.", next_3: "Questions? Just message the chat — we reply fast.",
    save_booking_warn: "Note: closing this window loses the booking details — take a screenshot or open Telegram. Without an account you'll wait for the host to contact you; sign up to see and manage your bookings.",
    booking_no: "Booking no.", contact_host: "Contact host", done: "Done", verify_phone: "Verify number",
    otp_title: "Enter the code", otp_sub: "We texted 4 digits to", skip: "Skip", resend: "Resend",
    no_results: "Nothing found", no_results_sub: "Try changing the dates or district — more places will appear.", reset: "Reset filters",
    sold_out: "Booked for these dates", sold_out_sub: "This flat is taken on your days. Try other dates or a similar place.", similar: "Similar places",
    error_title: "Something went wrong", error_sub: "We couldn’t load this. Check your connection and try again.", retry: "Try again",
    superhost: "Superhost", reviews_n: (n) => `${n} reviews`, response: "Replies in ~10 min",
    catalog: "Catalog", admin: "Admin", filters: "Filters", apply: "Show places",
    a_dashboard: "Dashboard", a_today: "Check-ins today", a_staying: "Staying now", a_upcoming: "Upcoming", a_occupancy: "Occupancy", a_revenue: "Revenue this month",
    a_listings: "Listings", a_bookings: "Bookings", a_calendar: "Calendar", a_add: "Add apartment", a_edit: "Edit",
    a_photos: "Photos", a_drop: "Drag photos here or click to choose", a_cover: "Cover", a_setcover: "Set as cover",
    a_price: "Price per night", a_save: "Save", a_block: "Block", a_unblock: "Open", a_source: "Source",
    a_guest: "Guest", a_dates: "Dates", a_status: "Status", a_cancel: "Cancel", a_blocked: "Blocked manually",
    bd_phone: "Phone", bd_ref: "Booking ref", bd_booked: "Booked on", bd_call: "Call", bd_active: "Active", bd_past: "Checked out", bd_cancelled: "Cancelled",
    cal_search: "Search by name or ID", cal_unsaved: "Unsaved changes",
    cal_to_block: "to block", cal_to_open: "to open", cal_pending: "pending", cal_today: "Today", cal_free: "Free", cal_occ: "occupancy",
    cal_helper: "Tap or drag across days, then Save.",
    src_website: "Website", src_booking: "Booking.com", src_manual: "Manual", a_all: "All", login: "Log in", password: "Password", admin_login: "Host login",
    a_desc: "Description", a_desc_ph: "Describe the flat: the area, the view, who it suits…",
    a_guests_field: "How many guests", a_adults: "Adults", a_children: "Children", a_beds: "Bedroom", a_living: "Living room", a_baths: "Bathroom", a_size: "Size, m²", a_near: "Landmark (nearby)", a_near_ph: "e.g. 5 min to metro",
    a_address: "Exact building address", a_address_help: "Shown to the guest ONLY after booking. This is the building address, not the flat.", a_address_ph: "12 Shota Rustaveli St.",
    a_location: "Location on map", a_location_help: "Drag the pin — guests only ever see the approximate area",
    reviews_title: "Reviews", leave_review: "Leave feedback", your_rating: "Your rating",
    cons_label: "What could be better", cons_ph: "e.g. you can hear neighbours in the evening (optional)",
    comment_label: "General comment", comment_ph: "What you liked, how check-in went…",
    submit_review: "Submit feedback", review_thanks: "Thanks for your feedback!", review_thanks_sub: "It helps other guests and the host.",
    rate_required: "Please add a rating", minuses: "Could be better", based_on: (n) => `based on ${n} review${n > 1 ? "s" : ""}`,
    chat_whatsapp: "Chat on WhatsApp", chat_telegram: "Message on Telegram",
    questions_title: "Still have a question?", questions_sub: "Message us — we reply fast in Uzbek, Russian or English.",
    pref_messenger: "Where should we send the address & keys?", pref_help: "Your phone number works for WhatsApp too.", get_whatsapp: "Get it on WhatsApp", get_telegram: "Get it on Telegram", help_contact: "Help & contact",
    nav_search: "Search", nav_saved: "Saved", nav_bookings: "Bookings", nav_account: "Account",
    saved_title: "Saved", saved_empty: "No saved places yet", saved_empty_sub: "Tap the heart on a place to save it here.",
    bookings_title: "My bookings", tab_active: "Active", tab_past: "Past", tab_cancelled: "Cancelled",
    st_confirmed: "Confirmed", st_completed: "Completed", st_cancelled: "Cancelled",
    book_again: "Book again", bookings_empty: "Nothing here yet", bookings_empty_sub: "Your bookings will show up here.",
    account_title: "Account", login_title: "Sign in to Maskan", login_sub: "To save places and see your bookings. You can book without signing in too.",
    login_telegram: "Continue with Telegram", login_google: "Continue with Google", logout: "Log out",
    login_required: "Sign in needed", login_required_sub: "Sign in with one tap to see this.", settings: "Settings", language: "Language",
    a_email: "Email", a_2fa_title: "Verify it’s you", a_2fa_sub: "Enter the 6-digit code from your authenticator app.", a_signin: "Sign in to panel",
    a_alert_title: "Sign-in alert", a_alert_sub: "The owner gets a Telegram message on every admin sign-in.",
    a_404: "Page not found", a_404_sub: "This page doesn’t exist. Check the address.", a_secure: "Secure login",
    a_moderate: "Moderate", a_hide: "Hide", a_unhide: "Restore", a_reply: "Reply", a_reply_ph: "Reply as Maskan…", a_send_reply: "Post reply",
    a_hidden: "Hidden", host_reply: "Host reply", a_hide_reason: "Reason (for the log)", a_hide_reasons: ["Spam", "Abuse", "Off-topic", "Personal data"],
    a_audit: "Audit log", cannot_edit: "Review text can’t be edited",
    // --- property file (admin-only internal ops) + suppliers ---
    a_pfile: "Property file", a_suppliers: "Suppliers",
    pf_internal: "Internal data — never shown to guests", pf_add: "Add property file",
    pf_badge: "File", pf_draft: "Not filled", pf_standalone: "Standalone",
    pf_new_hint: "You can create a file before the public listing exists.", pf_apt_name: "Apartment name",
    pf_rent_due: (d) => `Rent: day ${d}`,
    pf_g_owner: "Owner & lease", pf_owner: "Owner", pf_owner_phone: "Owner phone",
    pf_lease_start: "Lease start", pf_lease_end: "Lease end", pf_deposit: "Deposit (UZS)",
    pf_g_rent: "Monthly rent", pf_g_rent_sub: "paid to owner",
    pf_amount: "Amount", pf_pay_day: "Payment day of month", pf_last_paid: "Last paid",
    pf_g_util: "Utilities & meters", pf_electric: "Electric meter no.", pf_electric_reading: "Last reading",
    pf_gas: "Gas account", pf_water: "Water account", pf_internet: "Internet provider",
    pf_internet_acc: "Internet account", pf_hoa: "Communal / HOA fee (UZS)",
    pf_g_access: "Access & keys", pf_floor: "Floor", pf_intercom: "Intercom / door code",
    pf_keybox: "Keybox code", pf_key_sets: "Number of key sets", pf_sets: "sets",
    pf_g_notes: "Notes", pf_notes_ph: "Internal notes…",
    sup_add: "Add supplier", sup_edit_title: "Edit supplier",
    sup_name: "Name", sup_product: "Product / service", sup_contact: "Contact",
    sup_name_ph: "e.g. CleanHome LLC", sup_product_ph: "e.g. cleaning", sup_contact_ph: "Phone / Telegram",
    sup_empty: "No suppliers yet", sup_empty_sub: "Add your first supplier.",
    back: "Back", mobile: "Mobile", desktop: "Desktop", night1: "night",
  },
  uz: {
    code: "UZ", name: "Oʻzbekcha",
    search_city: "Toshkent", stay: "Yashash", guests: "Mehmonlar", guest_n: (n) => `${n} mehmon`,
    anydates: "Sanani tanlang", district: "Tuman", all_districts: "Barcha tumanlar", centre: "Markaz",
    pernight: "bir kecha", night_n: (n) => `${n} kecha`, sleeps: (n) => `${n} kishigacha`,
    from: "Kelish", to: "Ketish", total: "Jami", nofees: "Yashirin toʻlovlarsiz", price_approx: "≈ taxminiy · toʻlov USD/naqd", service: "Xizmat haqi", cleaning: "Tozalash",
    book_now: "Band qilish", booking: "Band qilish", see_all_photos: (n) => `Barcha ${n} ta rasm`,
    amenities: "Qulayliklar", show_all_amenities: "Barcha qulayliklar", house_rules: "Qoidalar", checkin: "Kelish", checkout: "Ketish",
    where: "Qayerda boʻlasiz", address_after: "Aniq manzilni band qilganingizdan soʻng Telegram orqali yuboramiz — bu hamma uchun xavfsizroq.",
    available: "Boʻsh", busy: "Band", select_dates: "Sanani tanlang", clear: "Tozalash",
    reserve_title: "Deyarli tayyor", your_name: "Ismingiz", phone: "Telefon", tg_optional: "Telegram (ixtiyoriy)",
    name_ph: "Masalan, Anna", phone_help: "Manzil va kalitlarni yuborish uchun", tg_help: "Bogʻlanishning eng qulay yoʻli",
    confirm_book: "Tasdiqlash", booked: "Band qilindi!", whatsnext: "Keyin nima boʻladi",
    save_booking_warn: "Diqqat: oyna yopilsa, bron maʼlumotlari yoʻqoladi — skrinshot oling yoki Telegramni oching. Akkauntsiz uy egasi aloqaga chiqishini kutasiz; roʻyxatdan oʻtsangiz, bronlaringizni koʻrib boshqarasiz.",
    next_1: "Manzil va kelish boʻyicha koʻrsatmalarni Telegram va SMS orqali yubordik.", next_2: "Uy egasi Dilnoza sizni kutib oladi yoki eshik kodini yuboradi.", next_3: "Savollar bormi? Chatga yozing — tez javob beramiz.",
    booking_no: "Bron raqami", contact_host: "Uy egasi bilan bogʻlanish", done: "Ajoyib", verify_phone: "Raqamni tasdiqlash",
    otp_title: "Koddni kiriting", otp_sub: "4 ta raqam yubordik", skip: "Oʻtkazib yuborish", resend: "Qayta yuborish",
    no_results: "Hech narsa topilmadi", no_results_sub: "Sana yoki tumanni oʻzgartiring — koʻproq variant chiqadi.", reset: "Filtrlarni tozalash",
    sold_out: "Bu sanalarda band", sold_out_sub: "Bu kvartira tanlangan kunlarda band. Boshqa sana yoki oʻxshash variantni koʻring.", similar: "Oʻxshash variantlar",
    error_title: "Nimadir xato ketdi", error_sub: "Yuklab boʻlmadi. Internetni tekshirib, qayta urinib koʻring.", retry: "Qayta urinish",
    superhost: "Super uy egasi", reviews_n: (n) => `${n} ta sharh`, response: "~10 daqiqada javob beradi",
    catalog: "Katalog", admin: "Admin", filters: "Filtrlar", apply: "Koʻrsatish",
    a_dashboard: "Boshqaruv", a_today: "Bugungi kelishlar", a_staying: "Hozir turibdi", a_upcoming: "Kelgusi", a_occupancy: "Bandlik", a_revenue: "Oylik daromad",
    a_listings: "Kvartiralar", a_bookings: "Bronlar", a_calendar: "Kalendar", a_add: "Kvartira qoʻshish", a_edit: "Tahrirlash",
    a_photos: "Rasmlar", a_drop: "Rasmlarni shu yerga tashlang yoki bosing", a_cover: "Muqova", a_setcover: "Muqova qilish",
    a_price: "Bir kecha narxi", a_save: "Saqlash", a_block: "Yopish", a_unblock: "Ochish", a_source: "Manba",
    a_guest: "Mehmon", a_dates: "Sanalar", a_status: "Holat", a_cancel: "Bekor qilish", a_blocked: "Qoʻlda yopilgan",
    bd_phone: "Telefon", bd_ref: "Bron raqami", bd_booked: "Yaratilgan", bd_call: "Qoʻngʻiroq", bd_active: "Faol", bd_past: "Yakunlangan", bd_cancelled: "Bekor qilingan",
    cal_search: "Nomi yoki ID boʻyicha qidirish", cal_unsaved: "Saqlanmagan oʻzgarishlar",
    cal_to_block: "yopiladi", cal_to_open: "ochiladi", cal_pending: "kutilmoqda", cal_today: "Bugun", cal_free: "Boʻsh", cal_occ: "bandlik",
    cal_helper: "Kunlarni bosing yoki sudrab belgilang, soʻng Saqlang.",
    src_website: "Sayt", src_booking: "Booking.com", src_manual: "Qoʻlda", a_all: "Hammasi", login: "Kirish", password: "Parol", admin_login: "Uy egasi kirishi",
    a_desc: "Tavsif", a_desc_ph: "Kvartira haqida: hudud, manzara, kimga mos…",
    a_guests_field: "Necha mehmon", a_adults: "Kattalar", a_children: "Bolalar", a_beds: "Yotoqxona", a_living: "Mehmonxona", a_baths: "Hammom", a_size: "Maydon, m²", a_near: "Moʻljal (yaqin atrofda)", a_near_ph: "Masalan: Metroga 5 daqiqa",
    a_address: "Uyning aniq manzili", a_address_help: "Mehmonga FAQAT band qilgandan keyin koʻrinadi. Bu uy manzili, kvartira emas.", a_address_ph: "Shota Rustaveli koʻchasi, 12",
    a_location: "Xaritada joylashuv", a_location_help: "Nuqtani suring — mehmon faqat taxminiy hududni koʻradi",
    reviews_title: "Sharhlar", leave_review: "Sharh qoldirish", your_rating: "Bahoyingiz",
    cons_label: "Nimani yaxshilash mumkin", cons_ph: "Masalan: kechqurun qoʻshnilar eshitiladi (ixtiyoriy)",
    comment_label: "Umumiy izoh", comment_ph: "Nima yoqdi, joylashish qanday oʻtdi…",
    submit_review: "Sharh yuborish", review_thanks: "Sharh uchun rahmat!", review_thanks_sub: "Bu boshqa mehmonlar va uy egasiga yordam beradi.",
    rate_required: "Iltimos, baho qoʻying", minuses: "Kamchiliklar", based_on: (n) => `${n} ta sharh asosida`,
    chat_whatsapp: "WhatsApp orqali yozish", chat_telegram: "Telegram orqali yozish",
    questions_title: "Savolingiz bormi?", questions_sub: "Bizga yozing — oʻzbek, rus yoki ingliz tilida tez javob beramiz.",
    pref_messenger: "Manzil va kalitlarni qayerga yuboraylik?", pref_help: "Telefon raqamingiz WhatsApp uchun ham ishlaydi.", get_whatsapp: "WhatsApp orqali olish", get_telegram: "Telegram orqali olish", help_contact: "Yordam va aloqa",
    nav_search: "Qidiruv", nav_saved: "Saqlangan", nav_bookings: "Bronlar", nav_account: "Profil",
    saved_title: "Saqlangan", saved_empty: "Hozircha boʻsh", saved_empty_sub: "Yoqqan kvartirani saqlash uchun yurakcha bosing.",
    bookings_title: "Mening bronlarim", tab_active: "Faol", tab_past: "Oʻtgan", tab_cancelled: "Bekor qilingan",
    st_confirmed: "Tasdiqlangan", st_completed: "Yakunlangan", st_cancelled: "Bekor qilingan",
    book_again: "Yana band qilish", bookings_empty: "Hozircha boʻsh", bookings_empty_sub: "Bronlaringiz shu yerda chiqadi.",
    account_title: "Profil", login_title: "Maskanʻga kiring", login_sub: "Kvartiralarni saqlash va bronlarni koʻrish uchun. Kirmasdan ham band qilsa boʻladi.",
    login_telegram: "Telegram bilan kirish", login_google: "Google bilan kirish", logout: "Chiqish",
    login_required: "Kirish kerak", login_required_sub: "Buni koʻrish uchun bir tap bilan kiring.", settings: "Sozlamalar", language: "Til",
    a_email: "Email", a_2fa_title: "Kirishni tasdiqlang", a_2fa_sub: "Autentifikator ilovasidagi 6 xonali kodni kiriting.", a_signin: "Panelga kirish",
    a_alert_title: "Kirish haqida ogohlantirish", a_alert_sub: "Har bir admin kirishida egasi Telegramga xabar oladi.",
    a_404: "Sahifa topilmadi", a_404_sub: "Bunday sahifa mavjud emas. Manzilni tekshiring.", a_secure: "Xavfsiz kirish",
    a_moderate: "Moderatsiya", a_hide: "Yashirish", a_unhide: "Qaytarish", a_reply: "Javob", a_reply_ph: "Maskan nomidan javob…", a_send_reply: "Javobni joylash",
    a_hidden: "Yashirilgan", host_reply: "Uy egasi javobi", a_hide_reason: "Sabab (jurnal uchun)", a_hide_reasons: ["Spam", "Haqorat", "Mavzudan tashqari", "Shaxsiy maʼlumot"],
    a_audit: "Amallar jurnali", cannot_edit: "Sharh matnini tahrirlab boʻlmaydi",
    // --- property file (admin-only internal ops) + suppliers ---
    a_pfile: "Kvartira pasporti", a_suppliers: "Taʼminotchilar",
    pf_internal: "Ichki maʼlumot — mehmonlarga hech qachon koʻrsatilmaydi", pf_add: "Pasport qoʻshish",
    pf_badge: "Pasport", pf_draft: "Toʻldirilmagan", pf_standalone: "Mustaqil",
    pf_new_hint: "Pasportni eʼlon paydo boʻlishidan oldin ham yaratish mumkin.", pf_apt_name: "Kvartira nomi",
    pf_rent_due: (d) => `Ijara: ${d}-sana`,
    pf_g_owner: "Uy egasi va shartnoma", pf_owner: "Uy egasi", pf_owner_phone: "Uy egasi telefoni",
    pf_lease_start: "Shartnoma boshlanishi", pf_lease_end: "Shartnoma tugashi", pf_deposit: "Depozit (UZS)",
    pf_g_rent: "Oylik ijara", pf_g_rent_sub: "uy egasiga toʻlanadi",
    pf_amount: "Summa", pf_pay_day: "Toʻlov kuni (oyning)", pf_last_paid: "Oxirgi toʻlov",
    pf_g_util: "Kommunal va hisoblagichlar", pf_electric: "Elektr hisoblagich №", pf_electric_reading: "Oxirgi koʻrsatkich",
    pf_gas: "Gaz hisob raqami", pf_water: "Suv hisob raqami", pf_internet: "Internet provayder",
    pf_internet_acc: "Internet hisob raqami", pf_hoa: "Kommunal / HOA toʻlovi (UZS)",
    pf_g_access: "Kirish va kalitlar", pf_floor: "Qavat", pf_intercom: "Domofon / eshik kodi",
    pf_keybox: "Keybox kodi", pf_key_sets: "Kalit toʻplamlari soni", pf_sets: "toʻplam",
    pf_g_notes: "Izoh", pf_notes_ph: "Ichki eslatmalar…",
    sup_add: "Taʼminotchi qoʻshish", sup_edit_title: "Taʼminotchini tahrirlash",
    sup_name: "Nomi / ismi", sup_product: "Mahsulot / xizmat", sup_contact: "Kontakt",
    sup_name_ph: "Masalan, «Toza uy» MChJ", sup_product_ph: "Masalan, tozalash", sup_contact_ph: "Telefon / Telegram",
    sup_empty: "Hozircha taʼminotchi yoʻq", sup_empty_sub: "Birinchi taʼminotchini qoʻshing.",
    back: "Orqaga", mobile: "Telefon", desktop: "Kompyuter", night1: "kecha",
  },
};

export const MASKAN = {
  TODAY, iso, addDays, APARTMENTS, BOOKINGS, GUEST_BOOKINGS, AMENITIES, DISTRICTS, TONES, STR,
  // Customer-facing contact.
  //  - tg  : personal Telegram (by phone) for GENERAL questions — direct, no bot.
  //  - bot : login bot username; used only for APARTMENT enquiries (start=<aptId>_<lang>),
  //          where it greets by apartment name and hands off to the host.
  //  - wa  : direct WhatsApp number.
  CONTACT: { wa: "998940026056", tg: "+998940026056", bot: "maskan_tashkentbot" },
};
