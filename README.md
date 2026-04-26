# Shale Static Prototype

واجهة عربية RTL ثابتة لاختبار فكرة العثور على أفضل محطة وقود قريبة في طرابلس.

## التشغيل المحلي

شغّل التطبيق من جذر المشروع باستخدام خادم ملفات ثابت:

```bash
python3 -m http.server 5173
```

ثم افتح:

```text
http://localhost:5173
```

لا تفتح `index.html` مباشرة عبر `file://` لأن بعض ميزات المتصفح مثل الموقع الجغرافي تحتاج `localhost`.

## الإعداد عبر `config.js`

هذا تطبيق HTML/CSS/JS ثابت، لذلك المتصفح لا يقرأ `.env` مباشرة.

اضبط إعدادات Supabase في `config.js` قبل النشر:

```js
window.BENZINA_CONFIG = {
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_ANON_KEY: "your-public-anon-key",
  USE_FAKE_LOCATION: false,
  FAKE_LATITUDE: 32.8872,
  FAKE_LONGITUDE: 13.1913,
};
```

ملاحظات:
- `SUPABASE_ANON_KEY` هو مفتاح عام مخصص للمتصفح، وليس secret key.
- إذا تركت `SUPABASE_URL` أو `SUPABASE_ANON_KEY` فارغاً، يعمل التطبيق ببيانات محلية و `localStorage`.
- ملف `.env` غير مطلوب لتشغيل التطبيق في المتصفح.
- ملف `.env` متجاهل في Git ويجب عدم الاعتماد عليه في النشر الثابت.

## النشر كموقع ثابت

انشر محتويات جذر المشروع كما هي على أي خدمة static hosting مثل Netlify أو Vercel Static أو GitHub Pages أو Supabase Storage أو S3.

يجب أن تكون الملفات التالية في جذر الموقع المنشور:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- ملفات `*.mjs`
- مجلد `assets/`

المسارات الحالية مصممة للعمل من جذر الموقع:

- `./config.js`
- `./app.js`
- `/assets/gas-station.png`

لذلك انشر التطبيق على root path مثل:

```text
https://example.com/
```

إذا نشرته داخل subpath مثل `/shale/` فستحتاج إلى تحويل مسارات الأصول المطلقة مثل `/assets/gas-station.png` إلى مسارات نسبية.

## Supabase اختياري

عند وجود إعدادات Supabase صحيحة:

- يتم تحميل المحطات من Supabase.
- يتم تحميل البلاغات الحديثة من Supabase.
- يتم إرسال البلاغات إلى Supabase.

عند غياب الإعدادات أو فشل الاتصال:

- يستخدم التطبيق بيانات fallback محلية.
- يحفظ البلاغات مؤقتاً في `localStorage`.

## الاختبارات

افحص syntax:

```bash
node --check app.js
```

شغّل الاختبارات:

```bash
node --test
```
