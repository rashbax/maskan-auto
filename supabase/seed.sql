-- ============================================================
-- Maskan — seed data (6 apartments + reviews + sample bookings)
-- i18n / free-text use dollar-quoting so apostrophes need no escaping.
-- Run AFTER 0001_init.sql.
-- ============================================================

insert into public.apartments
  (id, tone, price_usd, district, sleeps, beds, baths, size_m2, rating, reviews_count, photos_count, host, superhost, lat, lng, amenities, near, title, blurb)
values
  ('a1','sage',42,'mirobod',4,2,1,58,4.92,128,27,'Dilnoza',true,41.301,69.281,
   '{wifi,ac,kitchen,washer,tv,elevator,selfcheckin,water,workspace,balcony}',
   $j${"ru":"5 мин до м. Ойбек","en":"5 min to Oybek metro","uz":"Oybek metrosiga 5 daqiqa"}$j$,
   $j${"ru":"Светлая студия в центре, у метро Ойбек","en":"Bright studio in the centre, by Oybek metro","uz":"Markazdagi yorug studiya, Oybek metrosi yonida"}$j$,
   $j${"ru":"Тихая квартира в зелёном дворе, в 5 минутах от метро. Идеально для пары или небольшой семьи.","en":"Quiet flat on a green courtyard, 5 min from the metro. Perfect for a couple or small family.","uz":"Yashil hovlidagi tinch kvartira, metrodan 5 daqiqa. Juftlik yoki kichik oila uchun ideal."}$j$),

  ('a2','clay',35,'yakkasaroy',2,1,1,41,4.81,74,25,'Sardor',false,41.296,69.268,
   '{wifi,ac,kitchen,tv,heating,selfcheckin,water}',
   $j${"ru":"10 мин до Бродвея","en":"10 min to Broadway","uz":"Brodveyga 10 daqiqa"}$j$,
   $j${"ru":"Уютная квартира рядом с Бродвеем","en":"Cosy flat near Broadway","uz":"Brodvey yonidagi shinam kvartira"}$j$,
   $j${"ru":"Компактная и тёплая квартира в самом сердце города. До главных кафе и парков — пешком.","en":"Compact, warm flat in the heart of the city. Walk to the main cafés and parks.","uz":"Shaharning markazidagi ixcham va issiq kvartira. Asosiy kafe va bogʻlarga piyoda."}$j$),

  ('a3','sky',58,'mirzoulugbek',6,3,2,96,4.97,203,31,'Kamola',true,41.330,69.337,
   '{wifi,ac,kitchen,washer,parking,tv,elevator,heating,selfcheckin,water,workspace,balcony}',
   $j${"ru":"7 мин до Magic City","en":"7 min to Magic City","uz":"Magic City’ga 7 daqiqa"}$j$,
   $j${"ru":"Просторные 3 комнаты для семьи","en":"Spacious 3-room flat for a family","uz":"Oila uchun keng 3 xonali kvartira"}$j$,
   $j${"ru":"Много места, две ванные и парковка. Отлично для семьи или компании друзей.","en":"Lots of space, two bathrooms and parking. Great for a family or group of friends.","uz":"Koʻp joy, ikkita hammom va avtoturargoh. Oila yoki doʻstlar uchun zoʻr."}$j$),

  ('a4','sand',29,'chilonzor',3,1,1,48,4.74,51,26,'Bek',false,41.275,69.204,
   '{wifi,ac,kitchen,washer,tv,heating,water}',
   $j${"ru":"3 мин до м. Чиланзар","en":"3 min to Chilonzor metro","uz":"Chilonzor metrosiga 3 daqiqa"}$j$,
   $j${"ru":"Бюджетная квартира у метро","en":"Budget flat by the metro","uz":"Metro yonidagi arzon kvartira"}$j$,
   $j${"ru":"Простая чистая квартира по отличной цене. Прямо над метро — весь город в 20 минутах.","en":"Simple, clean flat at a great price. Right above the metro — the whole city in 20 min.","uz":"Ajoyib narxdagi oddiy va toza kvartira. Metro tepasida — butun shahar 20 daqiqada."}$j$),

  ('a5','rose',49,'shayxontohur',4,2,1,62,4.88,96,28,'Nigora',true,41.326,69.234,
   '{wifi,ac,kitchen,washer,tv,elevator,selfcheckin,water,balcony}',
   $j${"ru":"8 мин до Чорсу","en":"8 min to Chorsu bazaar","uz":"Chorsu bozoriga 8 daqiqa"}$j$,
   $j${"ru":"Квартира с видом у базара Чорсу","en":"Flat with a view near Chorsu bazaar","uz":"Chorsu bozori yonidagi manzarali kvartira"}$j$,
   $j${"ru":"Старый город под окнами. Колоритный район, купола Чорсу и лучшая еда Ташкента рядом.","en":"The old city under your windows. Colourful area, Chorsu domes and Tashkent’s best food nearby.","uz":"Deraza ostida eski shahar. Rang-barang hudud, Chorsu gumbazlari va eng mazali taomlar yonida."}$j$),

  ('a6','stone',38,'yunusobod',4,2,1,55,4.79,63,25,'Jamshid',false,41.367,69.289,
   '{wifi,ac,kitchen,washer,parking,tv,elevator,heating,water}',
   $j${"ru":"6 мин до Ташкент-Сити","en":"6 min to Tashkent City","uz":"Tashkent City’ga 6 daqiqa"}$j$,
   $j${"ru":"Современная квартира у Ташкент-Сити","en":"Modern flat near Tashkent City","uz":"Tashkent City yonidagi zamonaviy kvartira"}$j$,
   $j${"ru":"Новый дом, свежий ремонт, рядом парк Ташкент-Сити и небоскрёбы. Тихо и удобно.","en":"New building, fresh renovation, next to Tashkent City park and the towers. Quiet and convenient.","uz":"Yangi bino, yangi taʼmir, Tashkent City bogʻi va minoralar yonida. Tinch va qulay."}$j$)
on conflict (id) do nothing;

-- ---------- reviews ----------
insert into public.reviews (apartment_id, name, country, rating, cons, text) values
  ('a1','Anna S.','DE',5,'',$r$Очень чисто и тихо, до метро правда 5 минут. Хозяйка прислала адрес сразу в Telegram — всё было понятно.$r$),
  ('a1','Marco','IT',5,$r$Lift was a little slow$r$,$r$Great location, exactly like the photos. Self check-in worked perfectly, would book again.$r$),
  ('a1','Дилёр','UZ',4,$r$Вечером немного слышно соседей$r$,$r$Хорошая квартира за свои деньги, всё работало, заселение быстрое.$r$),
  ('a2','Sophie','FR',5,'',$r$Tiny but cosy, perfect for two. Walked everywhere from here. Host replied in minutes.$r$),
  ('a2','Олег','RU',4,$r$Кухня маловата$r$,$r$В целом отлично, центр, всё рядом. Рекомендую для короткой поездки.$r$),
  ('a3','James','GB',5,'',$r$Huge flat, came with family of five and everyone had space. Parking was a big plus.$r$),
  ('a3','Kamila','KZ',5,'',$r$Очень просторно и чисто, две ванные — это спасение с детьми. Спасибо!$r$),
  ('a3','Chen','CN',4,$r$A bit far from the metro$r$,$r$Comfortable and quiet, great for a longer stay. Kitchen well equipped.$r$),
  ('a4','Tom','NL',4,$r$Street can be noisy at rush hour$r$,$r$Unbeatable price right above the metro. Simple, clean, did the job.$r$),
  ('a4','Зухра','UZ',5,'',$r$За эти деньги — супер. Всё чисто, хозяин на связи.$r$),
  ('a5','Elena','RU',5,'',$r$Старый город прямо под окном, утром купола Чорсу. Незабываемо, очень атмосферно.$r$),
  ('a5','David','US',4,$r$Stairs, no elevator to the flat$r$,$r$Loved the character of the area. Best food in the city two minutes away.$r$),
  ('a6','Yuki','JP',5,'',$r$Brand new, spotless, quiet. The towers view at night is beautiful. Smooth check-in.$r$),
  ('a6','Иван','RU',4,$r$Немного далеко от старого города$r$,$r$Современно и удобно, рядом парк. Для деловой поездки идеально.$r$);

-- ---------- sample bookings (for admin dashboard/calendar) ----------
insert into public.bookings (id, apartment_id, guest_name, phone, telegram, checkin, checkout, nights, total_usd, source, status) values
  ('BK-3120','a1','Anna Schmidt','+49 151 23456789','@anna_s','2026-06-08','2026-06-11',3,126,'website','active'),
  ('BK-3119','a3','Liu Wei','+86 138 0013 8000','','2026-06-09','2026-06-14',5,290,'booking','active'),
  ('BK-3118','a5','Olivier Bernard','+33 6 12 34 56 78','@oliv','2026-06-10','2026-06-12',2,98,'website','active'),
  ('BK-3117','a2','Иван Петров','+7 916 555 0199','@ivanp','2026-06-06','2026-06-08',2,70,'manual','checked-out'),
  ('BK-3116','a6','Sofia Rossi','+39 333 1234567','','2026-06-13','2026-06-17',4,152,'website','active')
on conflict (id) do nothing;
