// ============================================================
// Shale App — Google Place ID Lookup Script
// Run once: node find_place_ids.mjs
// Output: place_id_updates.sql (paste into Supabase)
// ============================================================

import fs from 'fs';

// ── CONFIG ──────────────────────────────────────────────────
const API_KEY = 'AIzaSyARD8YzFNWB0t6cLbfLGE894nTEeaciOy8';
const OUTPUT_FILE = 'place_id_updates.sql';
const DELAY_MS = 200; // be polite to the API

// ── ALL 105 STATIONS ────────────────────────────────────────
const stations = [
  { id: '50029052-0823-41d0-96c3-e4558b948d82', name: 'محطة وقود القرة بوللي',            lat: 32.9098062, lng: 13.2392168 },
  { id: '902b6d0e-b406-4c0d-8f07-f241b3e052b9', name: 'محطة وقود تاجوراء الشرقية',        lat: 32.893326,  lng: 13.3581051 },
  { id: '111a2d46-87bb-4422-82d3-b8dba5950ef1', name: 'محطة وقود عين زارة الجنوبية',      lat: 32.8906125, lng: 13.2541105 },
  { id: 'd7af27d5-879d-4ed8-8355-960f0da6fdef', name: 'محطة وقود قرجي',                   lat: 32.886521,  lng: 13.185053  },
  { id: 'd568f348-d44a-451f-89b6-870657dcc316', name: 'محطة وقود الفلاح الشمالية',         lat: 32.8857961, lng: 13.1641806 },
  { id: '1db2ab71-619a-4cf3-8044-6a89d831cb5d', name: 'محطة وقود الهاني الغربية',          lat: 32.8824235, lng: 13.2026741 },
  { id: 'ccfbc56f-4b48-4eb2-9358-8f02d40d468d', name: 'محطة وقود السياحية',               lat: 32.8800141, lng: 13.1800459 },
  { id: 'e1ee3ba8-89f9-48f1-8fd2-afbc153a4043', name: 'محطة وقود السواني',                lat: 32.8764664, lng: 13.1491801 },
  { id: '7154fb92-e1bf-48b5-bb50-e2d63a847cf5', name: 'محطة وقود صلاح الدين الشمالية',    lat: 32.8751872, lng: 13.1327572 },
  { id: '57b568e0-67f4-426b-885f-5832a8b1ff33', name: 'محطة وقود صلاح الدين الغربية',     lat: 32.874627,  lng: 13.1312343 },
  { id: 'cc687ba6-f513-436e-828e-24cf2fe2a1e3', name: 'محطة وقود تاجوراء الوسط',          lat: 32.8720315, lng: 13.346588  },
  { id: 'df9ab15a-396f-4f14-8bd8-cd6d75c99f98', name: 'محطة وقود زاوية الدهماني الجنوبية', lat: 32.8718892, lng: 13.2026402 },
  { id: '2addb2ba-5008-4480-b241-6ba1328b7612', name: 'محطة وقود باب بن غشير الشمالية',   lat: 32.8702977, lng: 13.2056144 },
  { id: '549c9373-fe11-4515-9286-bde87454f02d', name: 'محطة وقود الدريبي',                lat: 32.8531174, lng: 13.3389111 },
  { id: '70073920-5745-4aa7-a7e0-f0816cc86d75', name: 'محطة وقود جنزور الشرقية',          lat: 32.8328019, lng: 13.0256854 },
  { id: '56028451-57df-46e6-bb76-6e6f0579c2cc', name: 'محطة وقود جنزور المركزية',         lat: 32.8302159, lng: 13.0212806 },
  { id: '61225a4f-8cd8-4c1a-8272-136d9e8ab6a1', name: 'محطة وقود السبعة',                 lat: 32.8236425, lng: 13.0643869 },
  { id: '2d21ecdd-e953-460b-b48e-30b628edb852', name: 'محطة وقود سوق الجمعة',             lat: 32.8210526, lng: 13.3447046 },
  { id: 'e81b9961-67b3-4e5f-9036-3079b52411a8', name: 'محطة وقود أبوسليم الشمالية',       lat: 32.8169444, lng: 13.1441342 },
  { id: 'f1e9cb78-5c91-41b7-bddf-f864e792a880', name: 'محطة وقود أبوسليم الغربية',        lat: 32.8165938, lng: 13.1474986 },
  { id: 'bbfa8cc1-8ab5-41c3-9b8f-53d683f9501b', name: 'محطة وقود قرقارش',                 lat: 32.815633,  lng: 13.3271444 },
  { id: 'bab23f8d-eb22-463e-a7bc-dbd9f1363de3', name: 'محطة وقود الزروق',                 lat: 32.8150084, lng: 13.0812907 },
  { id: '0f766f26-36be-495d-94ba-a3c01ca77e2f', name: 'محطة وقود الفرناج الجنوبية',       lat: 32.8120764, lng: 13.2483293 },
  { id: '94a07816-eb3c-490b-98e1-ece8e3af5e20', name: 'محطة وقود صلاح الدين الجنوبية',    lat: 32.8111768, lng: 13.1284421 },
  { id: '865cd187-64f2-4d5a-bbee-eaa1ed6255d6', name: 'محطة وقود الخلة',                  lat: 32.8105536, lng: 13.1761485 },
  { id: '8f26539e-dd43-4573-95cb-3279327885a8', name: 'محطة وقود طريق أبوسليم',           lat: 32.8085863, lng: 13.1251725 },
  { id: '457ddaee-9a39-4031-bdd5-dde454a053e6', name: 'محطة وقود عين زارة الغربية',       lat: 32.8067633, lng: 13.1831928 },
  { id: '2b09aad1-bbe8-439d-ba44-489e095d8d0f', name: 'محطة وقود طريق المشتل الجنوبية',   lat: 32.8052234, lng: 13.2810165 },
  { id: '0b0984d8-0b44-40b5-b6b6-a090181280ad', name: 'محطة وقود الساعدية',               lat: 32.8018813, lng: 12.957309  },
  { id: '653c2f52-ae10-48d0-ae95-ad3ecdc1c23c', name: 'محطة وقود الشعافي الجنوبية',       lat: 32.8010858, lng: 13.1942921 },
  { id: '6f5e6f4a-4936-4acd-b671-5e9c586f0cac', name: 'محطة وقود الجديدة',                lat: 32.7948036, lng: 13.2161096 },
  { id: 'e34cd41e-fd21-482a-972c-a57e083db444', name: 'محطة وقود الجديدة الجنوبية',       lat: 32.7927749, lng: 13.21816   },
  { id: '78c44cd3-b299-428f-a08d-807a836fc517', name: 'محطة وقود كرواط الجنوبية',         lat: 32.7803494, lng: 13.0234482 },
  { id: 'a22c7639-6980-4ad0-a884-84787cc6a703', name: 'محطة وقود السويحلي الجنوبية',      lat: 32.7738567, lng: 13.2552054 },
  { id: '94b8cbdd-b97f-4fe6-9025-42c6a671c1c3', name: 'محطة وقود جنزور الجنوبية',        lat: 32.7737571, lng: 13.0230161 },
  { id: '5deeb98b-3f88-4614-ac13-9bc7edd365b3', name: 'محطة وقود الزاوية الشرقية',        lat: 32.7726378, lng: 12.9986041 },
  { id: 'a36d5a81-629e-4f1e-b22c-fbe83f5bade0', name: 'محطة وقود تاجوراء الجنوبية',       lat: 32.7703246, lng: 13.4300062 },
  { id: 'c9e5b604-e1fc-451e-af6e-6117cf65c21a', name: 'محطة وقود الحشان',                 lat: 32.7700789, lng: 13.1446626 },
  { id: 'da7c372c-4e3f-4fe1-aeb1-46c2ec81cd1f', name: 'محطة وقود الحبايبية الشمالية',     lat: 32.7669778, lng: 13.347691  },
  { id: '8f5a091b-d3df-4a47-a072-8730a3adaeac', name: 'محطة وقود السبيعة',                lat: 32.7664045, lng: 13.0492293 },
  { id: '24fa19a1-c23d-4c48-ae15-c01f1dc117b0', name: 'محطة وقود العزيزية',               lat: 32.7659333, lng: 13.0943541 },
  { id: '8ee60146-8dff-40e4-bb97-44ef6f0ae4c0', name: 'محطة وقود قرقارش الجنوبية',        lat: 32.7650542, lng: 13.3044057 },
  { id: '163edcd3-0689-4861-a26f-0ea21209cc12', name: 'محطة وقود السواني الجنوبية',        lat: 32.7523982, lng: 13.1995356 },
  // Named stations
  { id: 'b16c4462-109e-45c9-b94e-b6326eb90a90', name: 'Oilibya',                           lat: 32.7723591, lng: 13.1473937 },
  { id: 'a0cd739a-46d5-4118-8807-6bdde73b87e2', name: 'Oilibya',                           lat: 32.8791326, lng: 13.1922849 },
  { id: 'd022850d-2417-46df-9dcf-13379cf8f766', name: 'Oilibya',                           lat: 32.8687422, lng: 13.2014779 },
  { id: 'd49bf254-c61e-4027-bc26-bd4d2d423ff3', name: 'أويليبيا',                          lat: 32.8301221, lng: 13.1415914 },
  { id: '2cc7bea2-eac6-4b8d-9072-61018fa1c427', name: 'شركة البريقة لتسويق النفط',         lat: 32.8957018, lng: 13.2160717 },
  { id: 'b6436bbf-af99-4c52-b4ee-bb3859d544cc', name: 'غاز بنبلي',                         lat: 32.8658275, lng: 13.1145022 },
  { id: 'c7ead56d-94d9-469c-ab49-e589af7e54f2', name: 'محطة المشاط',                       lat: 32.7796286, lng: 13.0001334 },
  { id: 'f4e91e53-b115-430f-9871-e1750711fb06', name: 'محطة توزيع غاز',                    lat: 32.8457541, lng: 13.1301712 },
  { id: 'cb7aeaa7-b52e-4204-b705-b2b7113e029b', name: 'محطة وقود الجبو',                   lat: 32.8149989, lng: 13.2690262 },
  { id: '81ca6ead-c5ca-413b-a1ff-000fca04cd50', name: 'محطة وقود برقان',                   lat: 32.8223244, lng: 13.2771208 },
  { id: '2c7c2d98-9cdc-4ef1-85d2-4d97b9393907', name: 'محطة وقود شيل الرقبة',              lat: 32.7732956, lng: 13.303259  },
  { id: 'f7bc3ea3-8314-4934-a2ae-44a6208caa11', name: 'محطة وقود أبوسليم',                 lat: 32.8467038, lng: 13.1696316 },
  { id: '431dfe68-c3be-40c9-9e89-642e7d978c77', name: 'محطة وقود أحمد محمود',              lat: 32.8232753, lng: 13.1276015 },
  { id: '6ef12671-ce9e-47cd-84c6-4a860dc26d75', name: 'محطة وقود ابو نواس',               lat: 32.8623714, lng: 13.0929962 },
  { id: '8b2ce4da-7dd3-477b-801b-d1d470f1e036', name: 'محطة وقود ابوستة',                  lat: 32.8979417, lng: 13.2220188 },
  { id: '2b38ece8-ce52-466f-8dab-8ac018073f68', name: 'محطة وقود اسبان',                   lat: 32.891034,  lng: 13.3285402 },
  { id: '88f8c95f-935a-425e-9067-986caaef2820', name: 'محطة وقود البوعيشي',                lat: 32.7904248, lng: 13.1799821 },
  { id: 'c672e7b2-b92a-4606-8261-e525e084f4ce', name: 'محطة وقود البيفي',                  lat: 32.8710458, lng: 13.3023157 },
  { id: '4c3e8b3e-55e2-4dc1-a5e6-6d980451413b', name: 'محطة وقود الحبايبية',               lat: 32.760628,  lng: 13.3470417 },
  { id: '250ea855-9c4c-4ee5-bbfe-a2a9f9f893a7', name: 'محطة وقود الخبولي',                 lat: 32.8682156, lng: 13.3088592 },
  { id: '3b19b37c-3c2d-40d2-8b5c-d68561e47fa1', name: 'محطة وقود الراحلة',                 lat: 32.8725977, lng: 13.1427922 },
  { id: 'e906c30e-e616-4cee-bb57-dfcf0634537a', name: 'محطة وقود الرحمة',                  lat: 32.8024333, lng: 13.3869352 },
  { id: '876ee53b-6dd6-45cb-b2a5-ca235c571aae', name: 'محطة وقود السدرة الراحلة',          lat: 32.8187386, lng: 13.2361862 },
  { id: '89355bae-381e-460e-89af-859546bb7214', name: 'محطة وقود السراج',                  lat: 32.7978042, lng: 13.0380546 },
  { id: 'f61a7542-a895-4c87-bccb-1e0e9c9233e4', name: 'محطة وقود السلامة',                 lat: 32.8349807, lng: 13.0492081 },
  { id: 'd308b7ee-2ce8-4496-b6a5-79a91d1250b5', name: 'محطة وقود السويحلي',               lat: 32.7717901, lng: 13.2364644 },
  { id: '29813bf6-24ab-45ce-83aa-cea69d7d0158', name: 'محطة وقود السويحلي',               lat: 32.8133783, lng: 13.1891675 },
  { id: 'b8fd1d01-7538-4da3-857e-11ae977c5293', name: 'محطة وقود الشرارة',                 lat: 32.7677003, lng: 13.0083855 },
  { id: 'ba0eea39-50a1-4284-97cd-7b201e0c4f2c', name: 'محطة وقود الشرارة',                 lat: 32.8842265, lng: 13.1959814 },
  { id: '8955c7f8-a466-4f32-8a3d-b93d208a9e20', name: 'محطة وقود الشرقية',                 lat: 32.8438177, lng: 13.212503  },
  { id: 'cc2295a0-90f4-4484-801b-bf0c91b7f0ed', name: 'محطة وقود الشعافي',                 lat: 32.7788923, lng: 13.1787781 },
  { id: '5c9e5487-fdf1-4def-9336-8af838c30977', name: 'محطة وقود الضبيع',                  lat: 32.7520328, lng: 13.0304229 },
  { id: '793d188e-3d9b-4dfe-bfb6-adf8737161ac', name: 'محطة وقود الضواحي',                 lat: 32.8730225, lng: 13.3643337 },
  { id: 'bc835fbb-cdc9-4d88-8aa6-6dae22116432', name: 'محطة وقود الفلاح',                  lat: 32.8526769, lng: 13.1441551 },
  { id: '4e2ecb62-7b55-45a0-8157-90edbe6e5dc6', name: 'محطة وقود الفلاح',                  lat: 32.8678916, lng: 13.1633037 },
  { id: '402193be-cce8-40c6-b213-af679b1d19f6', name: 'محطة وقود القاضي',                  lat: 32.8056276, lng: 13.1165068 },
  { id: 'd0179b5e-4862-46b7-bca1-f3acc4062f93', name: 'محطة وقود المبدع',                  lat: 32.8157394, lng: 12.9558369 },
  { id: 'f7ecec22-0465-408e-8e49-f60af24b6b30', name: 'محطة وقود المشري',                  lat: 32.8695154, lng: 13.3371403 },
  { id: '655b4e30-4d00-4e84-b83e-3ffbd2e19561', name: 'محطة وقود المقرحي',                 lat: 32.7957509, lng: 13.0078934 },
  { id: '723fd82c-6003-4edb-8bef-3c56001d1306', name: 'محطة وقود المنصورة',                lat: 32.8814444, lng: 13.1624316 },
  { id: '92e283dc-26c2-4a0a-a158-428459304f4a', name: 'محطة وقود الهاني',                  lat: 32.8827759, lng: 13.2203257 },
  { id: '3f9111d8-f8ca-48f0-99b5-5d152554e5fb', name: 'محطة وقود الهضبة',                  lat: 32.8451388, lng: 13.2053068 },
  { id: 'd207986c-f9f6-436e-9d7e-350fa5bf8a92', name: 'محطة وقود باب بن غشير',             lat: 32.868097,  lng: 13.1903433 },
  { id: 'd80d3642-83b6-411b-b360-5b1a3b365759', name: 'محطة وقود بركة',                    lat: 32.8380823, lng: 13.1891215 },
  { id: '0065f21e-45e4-41ae-8fbc-a58c73089b77', name: 'محطة وقود بن عاشور',               lat: 32.8846647, lng: 13.1956894 },
  { id: '5c7510e9-7190-475a-b230-668a2fefe6ce', name: 'محطة وقود بن غرسة',                lat: 32.8437907, lng: 13.0691723 },
  { id: 'db589497-8e62-47f3-9c57-808098f50794', name: 'محطة وقود بير',                     lat: 32.8370324, lng: 13.3414885 },
  { id: '0a8fa8b3-2b27-4ba1-a8d0-2e3ad678fe78', name: 'محطة وقود بير العالم',              lat: 32.8135644, lng: 13.4420575 },
  { id: 'f6b856dd-86c9-4042-97e6-54c9cf00993d', name: 'محطة وقود بير العالم',              lat: 32.8024884, lng: 13.4232059 },
  { id: 'c6c49423-b58d-45d9-ade5-163b02d2b199', name: 'محطة وقود تاجواء الوسط',            lat: 32.8827454, lng: 13.340326  },
  { id: 'd39664bd-044b-4cb4-9d45-e184e64a99b3', name: 'محطة وقود زاوية الدهماني',          lat: 32.8937083, lng: 13.2024586 },
  { id: 'c2b17a52-bd3f-47b2-aff3-e84eb514a01b', name: 'محطة وقود شارع الصريم',             lat: 32.8799456, lng: 13.1742192 },
  { id: '3bc5c2b3-71e5-4037-b84d-770eb934aa3e', name: 'محطة وقود طريق المشتل',             lat: 32.8475263, lng: 13.2914522 },
  { id: '48d138a4-d7f7-4810-b163-419ceabb73a0', name: 'محطة وقود عرادة',                   lat: 32.8827378, lng: 13.2581501 },
  { id: '2ecfd1e5-ff73-4cd6-b3bb-bce78ebcaeed', name: 'محطة وقود غوط الشعال',              lat: 32.8605903, lng: 13.0952221 },
  { id: '7058658a-b0a5-43ae-81b2-7ebb0fd47a28', name: 'محطة وقود فتروش',                   lat: 32.7958896, lng: 13.0231166 },
  { id: '40de63cd-7c8a-48ed-855e-690d9d3b1089', name: 'محطة وقود كرواط',                   lat: 32.7885967, lng: 13.0235296 },
  { id: 'd38d2b5b-40ac-4a6c-9e5a-d00afe6a0c5a', name: 'محطه شركة السلام ليبيا نفط',        lat: 32.7737352, lng: 13.0496661 },
  { id: '29deb182-a748-4cc8-ac64-a969b5907bfe', name: 'مستودع الغاز الهاني',               lat: 32.8841181, lng: 13.2240592 },
  { id: '4e0ea20f-13f5-48ab-a969-c362458301b1', name: 'موزع غاز الطهي',                    lat: 32.8741212, lng: 13.1989852 },
  { id: '43e83d85-c791-4ac3-840a-570ac544d620', name: 'موزع غاز حكومي',                    lat: 32.8847488, lng: 13.3715577 },
  { id: 'cc7e29c4-ab8f-495f-b42c-ae93b1235d5c', name: 'تحت الانشاء',                       lat: 32.7918551, lng: 13.3441319 },
];

// ── HELPERS ──────────────────────────────────────────────────
const delay = ms => new Promise(r => setTimeout(r, ms));

async function findPlaceId(station) {
  const url = new URL('https://places.googleapis.com/v1/places:searchNearby');

  const body = {
    includedTypes: ['gas_station'],
    maxResultCount: 1,
    locationRestriction: {
      circle: {
        center: { latitude: station.lat, longitude: station.lng },
        radius: 80.0  // 80 meters — tight radius to match exact location
      }
    }
  };

  const FIELD_MASK = 'places.id,places.displayName,places.location,places.businessStatus,places.currentOpeningHours';

  const extractPlace = (place, wideRadius = false) => ({
    found: true,
    placeId: place.id,
    googleName: place.displayName?.text || '',
    businessStatus: place.businessStatus || 'UNKNOWN',
    isOpen: place.currentOpeningHours?.openNow ?? null,
    wideRadius,
  });

  try {
    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();

    if (data.places && data.places.length > 0) {
      return extractPlace(data.places[0]);
    }

    // Try wider radius if nothing found at 80m
    const body2 = { ...body, locationRestriction: { circle: { center: { latitude: station.lat, longitude: station.lng }, radius: 200.0 } } };
    const res2 = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body2)
    });
    const data2 = await res2.json();
    if (data2.places && data2.places.length > 0) {
      return extractPlace(data2.places[0], true);
    }

    return { found: false };
  } catch (err) {
    return { found: false, error: err.message };
  }
}

// ── MAIN ────────────────────────────────────────────────────
async function main() {
  if (API_KEY === 'PASTE_YOUR_API_KEY_HERE') {
    console.error('❌ Please set your API key at the top of this file');
    process.exit(1);
  }

  console.log(`🔍 Looking up Place IDs for ${stations.length} stations...\n`);

  const found = [];
  const notFound = [];

  for (let i = 0; i < stations.length; i++) {
    const station = stations[i];
    process.stdout.write(`[${i + 1}/${stations.length}] ${station.name}... `);

    const result = await findPlaceId(station);

    if (result.found) {
      const flags = [
        result.wideRadius ? '200m radius' : '',
        result.businessStatus !== 'OPERATIONAL' ? result.businessStatus : '',
        result.isOpen === false ? 'currently closed' : '',
      ].filter(Boolean).join(', ');
      console.log(`✅ ${result.placeId}${flags ? `  ⚠️  ${flags}` : ''}`);
      found.push({ station, placeId: result.placeId, googleName: result.googleName, businessStatus: result.businessStatus, isOpen: result.isOpen });
    } else {
      console.log(`❌ not found${result.error ? ` (${result.error})` : ''}`);
      notFound.push(station);
    }

    await delay(DELAY_MS);
  }

  // ── GENERATE SQL ──────────────────────────────────────────
  const lines = [
    '-- ============================================================',
    '-- Shale App — Place ID Updates',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Found: ${found.length} / ${stations.length} stations`,
    '-- Paste into Supabase SQL Editor and Run',
    '-- ============================================================',
    '',
  ];

  for (const { station, placeId, googleName, businessStatus, isOpen } of found) {
    const statusNote = businessStatus && businessStatus !== 'OPERATIONAL'
      ? `  ⚠️  businessStatus: ${businessStatus}`
      : '';
    const openNote = isOpen === false ? '  (currently closed per Google)' : '';
    lines.push(`-- ${station.name}${googleName ? ` | Google: "${googleName}"` : ''}${statusNote}${openNote}`);
    lines.push(`UPDATE stations SET google_place_id = '${placeId}', updated_at = now() WHERE id = '${station.id}';`);
    lines.push('');
  }

  if (notFound.length > 0) {
    lines.push('-- ── NOT FOUND (manual lookup needed) ──────────────────────');
    for (const s of notFound) {
      lines.push(`-- ${s.name} (${s.lat}, ${s.lng})`);
      lines.push(`-- UPDATE stations SET google_place_id = 'PLACE_ID_HERE', updated_at = now() WHERE id = '${s.id}';`);
      lines.push('');
    }
  }

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');

  console.log('\n────────────────────────────────────────');
  console.log(`✅ Found:     ${found.length} stations`);
  console.log(`❌ Not found: ${notFound.length} stations`);
  console.log(`📄 SQL saved to: ${OUTPUT_FILE}`);
  console.log('────────────────────────────────────────');
  console.log('Next: paste place_id_updates.sql into Supabase SQL Editor');
}

main();
