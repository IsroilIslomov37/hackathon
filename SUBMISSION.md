# Topshirish matni: Earth Analogs Explorer

MARS Online Hackathon'ga topshirish uchun tayyor matn. `TODO` deb belgilangan maydonlarni jamoa to'ldiradi. Topshirish formasidagi maydon nomlari boshqacha bo'lsa, matnni mos bo'limlarga ko'chiring.

> **Muhim:** MARS Online Hackathon NASA'ning rasmiy tadbiri emas. Bu loyiha NASA bilan bog'liq emas va NASA tomonidan tasdiqlanmagan. NASA, USGS va boshqa tashkilotlar faqat ochiq ma'lumot manbai sifatida ishlatilgan.

---

## Asosiy ma'lumotlar

| Maydon | Qiymat |
|---|---|
| Loyiha nomi | Earth Analogs Explorer |
| Vazifa | «Yerdagi Oy va Mars» (qiyin) |
| Jamoa nomi | TODO |
| Jamoa a'zolari | TODO (ism, rol) |
| Sayt (demo) | https://hackathon-rho-flax.vercel.app/ |
| Kod | https://github.com/IsroilIslomov37/hackathon |
| Video demo | TODO |
| Taqdimot | TODO |

## Qisqa tavsif

Earth Analogs Explorer Yerdagi 20 ta Oy va Mars analogini 3D globus va xaritada ko'rsatadi. Har bir joyni uning Mars yoki Oydagi aniq jufti bilan bog'laydi va nimasi bilan o'xshashligini haqiqiy NASA suratlari hamda manbali ilmiy ko'rsatkichlar orqali tushuntiradi.

## To'liq tavsif

### Muammo

Oy va Marsga yuboriladigan texnika va ekipajlar avval Yerdagi o'xshash joylarda, ya'ni analoglarda sinovdan o'tadi. Bu joylar haqidagi ma'lumot ilmiy maqolalar, missiya sahifalari va arxivlarga sochilib ketgan. Oddiy foydalanuvchi qaysi joy nimasi bilan Oy yoki Marsga o'xshashini va u yerda nima sinalganini bir joyda ko'ra olmaydi.

### Yechim

Veb-ilova uchta globusni birlashtiradi:
- **Yer:** NASA Blue Marble asosida.
- **Mars:** Viking MDIM 2.1 mozaikasi asosida.
- **Oy:** LRO WAC mozaikasi asosida.

Foydalanuvchi Yerdagi joyni tanlaydi va uning Mars yoki Oydagi juftiga bir tugma bilan "uchib" o'tadi. Masalan:
- **Atacama cho'li** ↔ Gale krateri (Curiosity);
- **Rio Tinto daryosi** ↔ Meridiani Planum (Opportunity);
- **Cinder Lake** ↔ Apollo 11 qo'nish joyi.

Har bir joy kartasida quyidagilar bor:
- **Foto:** Yerdagi joy va NASA suratini solishtiradigan slayder.
- **O'xshashlik sababi:** nimasi bilan o'xshashligining matnli izohi.
- **Ilmiy ko'rsatkichlar:** harorat, bosim, namlik, UV va tuproq. Har bir qiymat manbaga havola qiladi, ishonchli manba bo'lmasa "ma'lumot yo'q" deb yoziladi.
- **Missiyalar vaqt chizig'i:** masalan, Apollo astronavtlarining 1963–1972 yillardagi dala mashg'ulotlari, USGS hisoboti bo'yicha.
- **O'xshashlik foizi:** u qanday hisoblangani ham ko'rsatiladi.

### Vazifa talablariga muvofiqlik

| Talab | Loyihada |
|---|---|
| Cho'llar | 7 ta: Atacama, Mars Desert Research Station, Wadi Rum, Pilbara va 3 ta Markaziy Osiyo taklifi (Orolqum, Qizilqum, Ustyurt platosi) |
| Vulqonlar | 3 ta: Mauna Loa (HI-SEAS), Holuhraun, Craters of the Moon |
| G'orlar | Lanzarote (Timanfaya) lava tunnellari ↔ Oydagi Marius Hills chuquri |
| Boshqa muhitlar | 5 ta zarba krateri, 2 ta muzli qutb cho'li, 2 ta ekstremal suv muhiti |
| Xaritada yoki ilovada ko'rsatish | 3D globus (Yer, Mars, Oy), bosilganda tekis xarita, ro'yxat, qidiruv va filtrlar |
| Nimasi bilan o'xshashligini tushuntirish | Har bir joy uchun izoh, manbali ko'rsatkichlar, Yer ↔ Mars/Oy foto slayderi, juftlik, missiyalar |
| Format | Sayt (PWA, telefonda ham ishlaydi) |

### Qo'shimcha imkoniyatlar

- Ikki joyni yonma-yon taqqoslash.
- 60 soniyalik avtomatik ekskursiya.
- "Qaysi sayyora?" viktorinasi: 4 qiyinlik darajasi, rasmli savollar, eng yaxshi natija saqlanadi.
- UZ / EN til, sevimlilar, "eng yaqin analog" (geolokatsiya orqali), ulashiladigan havolalar.
- Oflayn rejim (service worker), klaviatura bilan boshqarish, telefonda pastdan chiqadigan panel.
- AI yordamchi: faqat sayt ma'lumotlari asosida javob beradi, API kalit faqat serverda turadi.

### Kimlar uchun

Maktab o'quvchilari va talabalar, astronomiya to'garaklari, o'qituvchilar va kosmosga qiziquvchilar. Sayt O'zbekistondagi auditoriya uchun o'zbek tilida, xalqaro auditoriya uchun ingliz tilida ishlaydi.

## Ishlatilgan ma'lumotlar

- **NASA Image and Video Library:** Mars va Oy suratlari (PIA va Apollo raqamlari bilan).
- **NASA Trek:** Mars Viking MDIM 2.1 va Oy LRO WAC mozaikalari (xarita va globus teksturalari).
- **NASA Blue Marble:** Yer teksturasi.
- **NASA NSSDC fakt varaqalari:** Yer, Mars va Oyning o'rtacha iqlim ko'rsatkichlari.
- **USGS Open-File Report 2005-1190:** Apollo dala mashg'ulotlari sanalari.
- **Ilmiy maqolalar** (DOI bilan): Atacama, Dry Valleys, Phoenix, Gale, Meridiani, Gusev, Jezero va boshqa joylar bo'yicha.
- **Wikimedia Commons:** Yerdagi joylar fotolari, har birining muallifi va litsenziyasi ko'rsatilgan.
- **Esri World Imagery:** Yerning tekis xaritasi.

To'liq ro'yxat va havolalar: [README.md](README.md#malumotlar-va-apilar).

## Texnologiyalar

JavaScript (ES modullar), Vite 8, Three.js (3D globus), Leaflet (xarita), Chart.js (radar diagramma), Lucide (ikonkalar), Vercel (hosting va serverless funksiya), Claude API (AI yordamchi). Backend va ma'lumotlar bazasi yo'q: barcha ma'lumot ikki JSON faylda.

## AI'dan foydalanish

- Kod yozishda Claude (Anthropic) AI yordamchisidan foydalanildi. TODO: hackathon qoidalari AI ishlatilishini qanday oshkor qilishni talab qilishini tekshiring va shu bandni moslang.
- Saytdagi AI yordamchi Claude API orqali ishlaydi va faqat loyiha ma'lumotlari asosida javob beradi.
- Saytdagi barcha suratlar haqiqiy: NASA va Wikimedia Commons fotolari. AI bilan yaratilgan rasm yoki ma'lumot yo'q.

## Cheklovlar

- O'xshashlik foizi 6 ta mezon bo'yicha jamoa bahosi. Bu ilmiy o'lchov emas, saytda shunday deb izohlangan.
- Ko'p joylar uchun joyga xos iqlim ko'rsatkichlari hali to'ldirilmagan va "ma'lumot yo'q" deb turibdi. Ro'yxat: [README.md](README.md#toldirilishi-kerak-bolgan-malumotlar).
- Orolqum, Qizilqum va Ustyurt rasmiy analog emas, jamoa taklifi.

## Kelajak rejalari

- O'xshashlikni jamoa bahosi o'rniga ochiq ma'lumotlar (iqlim, balandlik, mineralogiya) asosida avtomatik hisoblash va shu yo'l bilan yangi analoglarni topish.
- Markaziy Osiyo takliflarini dala ma'lumotlari va suratlar bilan boyitish.
- Oyning janubiy qutbidagi kelajakdagi baza hududlarini qo'shib, ularni qutbiy analoglar (Antarktida, Svalbard, Devon oroli) bilan bog'lash.
- Rus tilini qo'shish va o'qituvchilar uchun dars materiallari tayyorlash.
- TODO: jamoaning o'z rejalari.
