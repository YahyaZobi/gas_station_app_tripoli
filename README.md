# بنزينة Prototype

واجهة عربية RTL لاختبار فكرة الإبلاغ عن توفر الوقود والزحمة في المحطات داخل طرابلس.

## التشغيل المحلي

يمكن تشغيل النموذج بأي خادم محلي بسيط. مثال:

```bash
python3 -m http.server 5173
```

ثم افتح:

```text
http://localhost:5173
```

## Supabase اختياري

التطبيق يعمل بدون Supabase.

إذا لم يتم ضبط الإعدادات:
- يتم استخدام بيانات المحطات المحلية.
- يتم حفظ البلاغات محلياً داخل `localStorage`.

إذا تم ضبط Supabase:
- يحاول التطبيق قراءة المحطات والبلاغات من Supabase.
- إذا فشل الاتصال، يرجع تلقائياً إلى `localStorage`.

## إعداد البيئة

انسخ القيم من `.env.example` إلى ملف `.env` أو مررها عبر بيئة التطوير:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

ملاحظات:
- لا تضع القيم داخل الكود.
- في بيئات front-end مثل Vite يمكن أيضاً تمرير:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- الكود الحالي يقرأ القيم من `import.meta.env` أو من `window` إذا تم حقنها خارجياً.

## طبقة البيانات

الملفات الأساسية:
- `supabaseClient.mjs`: عميل Supabase خفيف عبر REST بدون dependency جديدة.
- `repository.mjs`: يوفّر:
  - `getStations()`
  - `getRecentReports()`
  - `submitReport()`
- `report-storage.mjs`: fallback محلي عبر `localStorage`.

## السلوك الحالي

- البلاغات الأقدم من 60 دقيقة يتم تجاهلها.
- fallback المحلي يبقي النموذج شغالاً بدون backend.
- واجهة المستخدم الحالية لم تتغير بصرياً بسبب إضافة Supabase.

## الاختبارات

```bash
node --test
```

ولفحص syntax لملف التطبيق:

```bash
node --check app.js
```
