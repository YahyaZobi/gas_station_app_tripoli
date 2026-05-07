function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
// Shale — تطبيق العثور على أفضل محطة وقود في طرابلس
// شاشات: الرئيسية، الخريطة، حسابي

const {
  useState,
  useMemo,
  useEffect,
  useRef
} = React;

// ─────────────────────────────────────────────────────────────
// بيانات وهمية
// ─────────────────────────────────────────────────────────────
const STATIONS = [{
  id: 'hani',
  name: 'محطة وقود الهاني',
  area: 'الظهرة',
  distanceKm: 0.8,
  etaMin: 4,
  status: 'available',
  statusLabel: 'عالبومبة طول',
  updated: 'منذ دقيقة',
  coords: {
    x: 52,
    y: 44
  }
}, {
  id: 'zawya',
  name: 'محطة الزاوية',
  area: 'سوق الجمعة',
  distanceKm: 1.2,
  etaMin: 6,
  status: 'light',
  statusLabel: 'طابور خفيف',
  updated: 'منذ 4 دقائق',
  coords: {
    x: 38,
    y: 32
  }
}, {
  id: 'matar',
  name: 'محطة طريق المطار',
  area: 'طريق المطار',
  distanceKm: 1.8,
  etaMin: 9,
  status: 'crowded',
  statusLabel: 'زحمة',
  updated: 'منذ 6 دقائق',
  coords: {
    x: 64,
    y: 68
  }
}, {
  id: 'gashir',
  name: 'محطة باب بن غشير',
  area: 'باب بن غشير',
  distanceKm: 2.1,
  etaMin: 11,
  status: 'light',
  statusLabel: 'طابور خفيف',
  updated: 'منذ 9 دقائق',
  coords: {
    x: 28,
    y: 58
  }
}, {
  id: 'sabt',
  name: 'محطة سوق السبت',
  area: 'سوق السبت',
  distanceKm: 2.4,
  etaMin: 13,
  status: 'closed',
  statusLabel: 'مسكر',
  updated: 'منذ 12 دقيقة',
  coords: {
    x: 72,
    y: 24
  }
}, {
  id: 'bensh',
  name: 'محطة بن عاشور',
  area: 'بن عاشور',
  distanceKm: 2.9,
  etaMin: 15,
  status: 'available',
  statusLabel: 'عالبومبة طول',
  updated: 'منذ 3 دقائق',
  coords: {
    x: 46,
    y: 78
  }
}, {
  id: 'fashloum',
  name: 'محطة فشلوم',
  area: 'فشلوم',
  distanceKm: 3.4,
  etaMin: 18,
  status: 'crowded',
  statusLabel: 'زحمة',
  updated: 'منذ 7 دقائق',
  coords: {
    x: 22,
    y: 18
  }
}];
const AREAS = ['كل المناطق', 'الظهرة', 'سوق الجمعة', 'طريق المطار', 'باب بن غشير', 'بن عاشور', 'فشلوم'];

// ─────────────────────────────────────────────────────────────
// أدوات الألوان
// ─────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  available: {
    fg: '#0a6b2a',
    bg: '#16a34a',
    text: '#ffffff',
    soft: '#d8f3df',
    label: 'متوفر'
  },
  light: {
    fg: '#a36f00',
    bg: '#f6c343',
    text: '#3d2c00',
    soft: '#fff4cc',
    label: 'طابور خفيف'
  },
  crowded: {
    fg: '#9a1f24',
    bg: '#e6373d',
    text: '#ffffff',
    soft: '#fde0e1',
    label: 'زحمة'
  },
  closed: {
    fg: '#3a3a3a',
    bg: '#5a5a5a',
    text: '#ffffff',
    soft: '#e5e5e5',
    label: 'مسكر'
  }
};

// ─────────────────────────────────────────────────────────────
// أيقونات SVG
// ─────────────────────────────────────────────────────────────
const Icon = {
  pin: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "10",
    r: "2.5"
  })),
  home: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M3 10.5 12 3l9 7.5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M6.75 9.75V20h10.5V9.75"
  })),
  user: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M19 21a7 7 0 0 0-14 0"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "8",
    r: "4"
  })),
  search: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "m20 20-3.5-3.5"
  })),
  crown: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M3 7l4 3 5-6 5 6 4-3-1.5 11h-15L3 7zm2.6 8.5h12.8l.7-5.1-2.5 1.9-4.6-5.5-4.6 5.5L5 10.4l.6 5.1z"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "5",
    y: "17.5",
    width: "14",
    height: "2.2",
    rx: "1",
    fill: "currentColor"
  })),
  star: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M12 2.5l2.95 6.6 7.05.74-5.3 4.84 1.55 7.05L12 17.9l-6.25 3.83 1.55-7.05L2 9.84l7.05-.74L12 2.5z"
  })),
  chevronLeft: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M15 6l-6 6 6 6"
  })),
  info: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 11v5M12 8v.01"
  })),
  fuel: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "currentColor"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M5 4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v17H5V4zm2 1v4h6V5H7zm10 4l1.5 1.5v6.5a1.5 1.5 0 0 1-3 0V13h-1V8h1.5V9zm0 2.5v3a.5.5 0 0 0 1 0v-3a.5.5 0 0 0-1 0z"
  })),
  clock: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l3 2"
  })),
  bell: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 19a2 2 0 0 0 4 0"
  })),
  globe: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"
  })),
  shield: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z"
  })),
  share: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M16 6l-4-4-4 4M12 2v14"
  })),
  plus: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  })),
  minus: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.4",
    strokeLinecap: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M5 12h14"
  })),
  target: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "8"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 2v3M12 19v3M2 12h3M19 12h3"
  })),
  filter: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M3 5h18M6 12h12M10 19h4"
  })),
  external: props => /*#__PURE__*/React.createElement("svg", _extends({
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, props), /*#__PURE__*/React.createElement("path", {
    d: "M15 3h6v6M21 3l-9 9M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"
  }))
};

// ─────────────────────────────────────────────────────────────
// مكون: أيقونة محطة وقود (دائرية)
// ─────────────────────────────────────────────────────────────
function FuelBadge({
  size = 56,
  status = 'available',
  glow = false
}) {
  const bg = status === 'available' ? '#dcfce7' : status === 'light' ? '#fef3c7' : status === 'crowded' ? '#fee2e2' : '#e2e8f0';
  const fg = status === 'available' ? '#16a34a' : status === 'light' ? '#d97706' : status === 'crowded' ? '#dc2626' : '#64748b';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      flexShrink: 0
    }
  }, status === 'available' && /*#__PURE__*/React.createElement("span", {
    "aria-hidden": "true",
    className: "shale-avail-glow",
    style: {
      position: 'absolute',
      inset: -4,
      borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(34, 197, 94, 0.55) 0%, rgba(34, 197, 94, 0) 70%)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: size,
      height: size,
      borderRadius: '50%',
      background: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }
  }, /*#__PURE__*/React.createElement(Icon.fuel, {
    style: {
      width: size * 0.5,
      height: size * 0.5,
      color: fg
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// شارة الحالة
// ─────────────────────────────────────────────────────────────
function StatusPill({
  status,
  large = false
}) {
  const voice = useVoice();
  const label = voice[status]?.label || status;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: large ? '8px 16px' : '6px 12px',
      borderRadius: 999,
      background: status === 'available' ? '#dcfce7' : status === 'light' ? '#fef3c7' : status === 'crowded' ? '#fee2e2' : '#e2e8f0',
      color: status === 'available' ? '#15803d' : status === 'light' ? '#a16207' : status === 'crowded' ? '#b91c1c' : '#475569',
      fontSize: large ? 14 : 11.5,
      fontWeight: 700,
      lineHeight: 1.2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: status === 'available' ? '#22c55e' : status === 'light' ? '#f59e0b' : status === 'crowded' ? '#ef4444' : '#94a3b8'
    }
  }), label);
}

// ─────────────────────────────────────────────────────────────
// بطاقة Hero — أفضل محطة الآن
// ─────────────────────────────────────────────────────────────
function HeroStationCard({
  station,
  onOpenMaps,
  onClick
}) {
  const theme = useTheme();
  const voice = useVoice();
  const density = useDensity();
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    dir: "rtl",
    className: "shale-hero-in",
    style: {
      position: 'relative',
      borderRadius: density.heroRadius,
      padding: density.heroPad,
      background: theme.heroBg,
      color: '#fff',
      overflow: 'hidden',
      boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
      cursor: 'pointer',
      transition: 'background 0.3s ease, padding 0.3s ease, border-radius 0.3s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: theme.heroAccent,
      color: theme.heroAccentInk,
      padding: '8px 14px',
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 800
    }
  }, /*#__PURE__*/React.createElement(Icon.crown, {
    style: {
      width: 14,
      height: 14,
      color: theme.heroAccentInk
    }
  }), /*#__PURE__*/React.createElement("span", null, theme.crownLabel)), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 44,
      borderRadius: 14,
      background: theme.heroPanel,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon.fuel, {
    style: {
      width: 22,
      height: 22,
      color: theme.heroAccent
    }
  }))), /*#__PURE__*/React.createElement("h2", {
    style: {
      margin: `${density.heroPad}px 0 0`,
      fontSize: density.heroTitle,
      fontWeight: 800,
      lineHeight: 1.25,
      letterSpacing: '-0.015em'
    }
  }, station.name), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 12,
      background: theme.heroChipBg,
      color: theme.heroChipInk,
      padding: '7px 14px',
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: theme.heroAccent
    }
  }), voice.available.label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 14,
      fontSize: 12.5,
      color: theme.heroSubtle,
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: theme.heroPanel,
      color: '#fff',
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(Icon.pin, {
    style: {
      width: 12,
      height: 12
    }
  }), station.distanceKm, " \u0643\u0645"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: theme.heroPanel,
      color: '#fff',
      padding: '5px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(Icon.clock, {
    style: {
      width: 12,
      height: 12
    }
  }), station.etaMin, " \u062F\u0642\u064A\u0642\u0629"), /*#__PURE__*/React.createElement("span", null, "\u0622\u062E\u0631 \u062A\u062D\u062F\u064A\u062B: ", station.updated)), /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onOpenMaps(station);
    },
    className: "shale-press",
    style: {
      marginTop: 20,
      width: '100%',
      background: theme.heroAccent,
      color: theme.heroAccentInk,
      border: 'none',
      padding: '14px 16px',
      borderRadius: 14,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: 'inherit',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon.pin, {
    style: {
      width: 17,
      height: 17
    }
  }), /*#__PURE__*/React.createElement("span", null, voice.cta)));
}

// ─────────────────────────────────────────────────────────────
// بطاقة "الخيار الثاني" — وسط
// ─────────────────────────────────────────────────────────────
function SecondaryStationCard({
  station,
  onClick
}) {
  const voice = useVoice();
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    style: {
      position: 'relative',
      borderRadius: 20,
      padding: '18px',
      background: '#fff',
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    dir: "rtl",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(FuelBadge, {
    size: 56,
    status: station.status
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: '#f1f5f9',
      color: '#0f172a',
      padding: '5px 12px',
      borderRadius: 999,
      fontSize: 11.5,
      fontWeight: 700
    }
  }, /*#__PURE__*/React.createElement(Icon.star, {
    style: {
      width: 12,
      height: 12,
      color: '#f59e0b'
    }
  }), /*#__PURE__*/React.createElement("span", null, voice.second)), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '10px 0 0',
      fontSize: 19,
      fontWeight: 800,
      color: '#0f172a',
      letterSpacing: '-0.01em'
    }
  }, station.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: station.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 12,
      fontSize: 12,
      color: '#64748b',
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement(Icon.pin, {
    style: {
      width: 12,
      height: 12
    }
  }), /*#__PURE__*/React.createElement("span", null, station.distanceKm, " \u0643\u0645"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\u2022"), /*#__PURE__*/React.createElement("span", null, "\u0622\u062E\u0631 \u062A\u062D\u062F\u064A\u062B: ", station.updated))), /*#__PURE__*/React.createElement(Icon.chevronLeft, {
    style: {
      width: 20,
      height: 20,
      color: '#cbd5e1',
      flexShrink: 0
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// صف محطة — في القائمة
// ─────────────────────────────────────────────────────────────
function StationRow({
  station,
  onClick,
  index = 0
}) {
  const density = useDensity();
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClick,
    dir: "rtl",
    className: "shale-row-in",
    style: {
      animationDelay: `${index * 50}ms`,
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: density.rowPad,
      background: '#fff',
      borderRadius: 18,
      border: '1px solid #e2e8f0',
      boxShadow: '0 1px 2px rgba(15, 23, 42, 0.03)',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(FuelBadge, {
    size: density.rowPad >= 16 ? 48 : 40,
    status: station.status
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("h4", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      color: '#0f172a',
      letterSpacing: '-0.01em'
    }
  }, station.name), /*#__PURE__*/React.createElement(StatusPill, {
    status: station.status
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      marginTop: 8,
      fontSize: 12,
      color: '#64748b',
      fontWeight: 500
    }
  }, /*#__PURE__*/React.createElement(Icon.pin, {
    style: {
      width: 12,
      height: 12
    }
  }), /*#__PURE__*/React.createElement("span", null, station.distanceKm, " \u0643\u0645"), /*#__PURE__*/React.createElement("span", {
    style: {
      opacity: 0.4
    }
  }, "\u2022"), /*#__PURE__*/React.createElement("span", null, "\u0622\u062E\u0631 \u062A\u062D\u062F\u064A\u062B: ", station.updated))), /*#__PURE__*/React.createElement(Icon.chevronLeft, {
    style: {
      width: 20,
      height: 20,
      color: '#cbd5e1',
      flexShrink: 0
    }
  }));
}

// ─────────────────────────────────────────────────────────────
// شاشة: الرئيسية
// ─────────────────────────────────────────────────────────────
function HomeScreen({
  stations,
  onOpenMaps,
  onSelectStation
}) {
  const voice = useVoice();
  const density = useDensity();
  const theme = useTheme();
  const sorted = [...stations].sort((a, b) => a.distanceKm - b.distanceKm);
  const best = sorted[0];
  const second = sorted[1];
  const startIdx = density.showSecondary ? 2 : 1;
  const rest = sorted.slice(startIdx, startIdx + density.rowsShown);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: density.pagePad,
      display: 'flex',
      flexDirection: 'column',
      gap: density.gap
    }
  }, /*#__PURE__*/React.createElement(HeroStationCard, {
    station: best,
    onOpenMaps: onOpenMaps,
    onClick: () => onSelectStation(best)
  }), density.showSecondary && /*#__PURE__*/React.createElement(SecondaryStationCard, {
    station: second,
    onClick: () => onSelectStation(second)
  }), /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fff',
      borderRadius: 20,
      border: '1px solid #e2e8f0',
      padding: density.rowPad + 'px ' + (density.rowPad - 2) + 'px',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      margin: '0 4px 14px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      height: 18,
      borderRadius: 2,
      background: theme.heroAccent
    }
  }), /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 800,
      color: '#0f172a',
      letterSpacing: '-0.01em'
    }
  }, voice.nearby)), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: '#64748b',
      background: '#f1f5f9',
      padding: '4px 10px',
      borderRadius: 999
    }
  }, rest.length, " \u0645\u062D\u0637\u0629")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: density.rowGap
    }
  }, rest.map((s, i) => /*#__PURE__*/React.createElement(StationRow, {
    key: s.id,
    station: s,
    index: i,
    onClick: () => onSelectStation(s)
  })))));
}

// ─────────────────────────────────────────────────────────────
// شاشة: الخريطة
// ─────────────────────────────────────────────────────────────
function MapScreen({
  stations,
  selectedArea,
  setSelectedArea,
  query,
  setQuery,
  onSelectStation
}) {
  const filtered = useMemo(() => {
    return stations.filter(s => {
      const matchArea = !selectedArea || selectedArea === 'كل المناطق' || s.area === selectedArea;
      const matchQ = !query || s.name.includes(query) || s.area.includes(query);
      return matchArea && matchQ;
    });
  }, [stations, selectedArea, query]);
  const [showAreas, setShowAreas] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 14px 110px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: '#fff',
      border: '1px solid #e6ebe8',
      borderRadius: 14,
      padding: '11px 14px',
      boxShadow: '0 2px 6px rgba(15, 30, 25, 0.03)'
    }
  }, /*#__PURE__*/React.createElement(Icon.search, {
    style: {
      width: 18,
      height: 18,
      color: '#64748b'
    }
  }), /*#__PURE__*/React.createElement("input", {
    value: query,
    onChange: e => setQuery(e.target.value),
    placeholder: "\u0627\u0628\u062D\u062B \u0639\u0646 \u0645\u062D\u0637\u0629 \u0623\u0648 \u0645\u0646\u0637\u0642\u0629",
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      fontFamily: 'inherit',
      fontSize: 14.5,
      background: 'transparent',
      color: '#0f172a',
      minWidth: 0
    }
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowAreas(v => !v),
    style: {
      background: showAreas ? '#16a34a' : '#fff',
      color: showAreas ? '#fff' : '#0f172a',
      border: '1px solid #e6ebe8',
      borderRadius: 14,
      padding: '0 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      fontFamily: 'inherit',
      fontSize: 14,
      fontWeight: 700,
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon.filter, {
    style: {
      width: 17,
      height: 17
    }
  }), "\u0627\u0644\u0645\u0646\u0637\u0642\u0629")), showAreas && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: 6,
      background: '#fff',
      padding: 10,
      borderRadius: 14,
      border: '1px solid #e6ebe8'
    }
  }, AREAS.map(a => /*#__PURE__*/React.createElement("button", {
    key: a,
    onClick: () => setSelectedArea(a === selectedArea ? '' : a),
    style: {
      padding: '7px 12px',
      borderRadius: 999,
      border: '1px solid ' + (selectedArea === a ? '#16a34a' : '#e2e8f0'),
      background: selectedArea === a ? '#16a34a' : '#fff',
      color: selectedArea === a ? '#fff' : '#0f172a',
      fontSize: 12.5,
      fontWeight: 700,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, a))), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 320,
      borderRadius: 18,
      overflow: 'hidden',
      border: '1px solid #e6ebe8',
      boxShadow: '0 4px 14px rgba(15, 30, 25, 0.06)',
      background: '#e7eee9'
    }
  }, /*#__PURE__*/React.createElement(MapMock, {
    stations: filtered,
    onSelect: onSelectStation
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      left: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: mapBtnStyle
  }, /*#__PURE__*/React.createElement(Icon.plus, {
    style: {
      width: 16,
      height: 16
    }
  })), /*#__PURE__*/React.createElement("button", {
    style: mapBtnStyle
  }, /*#__PURE__*/React.createElement(Icon.minus, {
    style: {
      width: 16,
      height: 16
    }
  }))), /*#__PURE__*/React.createElement("button", {
    style: {
      ...mapBtnStyle,
      position: 'absolute',
      bottom: 12,
      left: 12
    }
  }, /*#__PURE__*/React.createElement(Icon.target, {
    style: {
      width: 18,
      height: 18
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 12,
      right: 12,
      background: 'rgba(255,255,255,0.94)',
      backdropFilter: 'blur(8px)',
      padding: '6px 12px',
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: 700,
      color: '#0f172a',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      boxShadow: '0 2px 8px rgba(15,30,25,0.08)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: '#16a34a'
    }
  }), "\u0637\u0631\u0627\u0628\u0644\u0633 \xB7 ", filtered.length, " \u0645\u062D\u0637\u0629")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: '4px 4px',
      fontSize: 16,
      fontWeight: 800,
      color: '#0f172a'
    }
  }, "\u0627\u0644\u0646\u062A\u0627\u0626\u062C (", filtered.length, ")"), filtered.map((s, i) => /*#__PURE__*/React.createElement(StationRow, {
    key: s.id,
    station: s,
    index: i,
    onClick: () => onSelectStation(s)
  })), filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 24,
      textAlign: 'center',
      color: '#64748b',
      background: '#fff',
      borderRadius: 16,
      border: '1px dashed #cbd5e1'
    }
  }, "\u0644\u0627 \u062A\u0648\u062C\u062F \u0646\u062A\u0627\u0626\u062C. \u062C\u0631\u0651\u0628 \u0628\u062D\u062B \u0622\u062E\u0631.")));
}
const mapBtnStyle = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: '#fff',
  border: '1px solid #e6ebe8',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  boxShadow: '0 2px 6px rgba(15,30,25,0.1)',
  cursor: 'pointer',
  color: '#0f172a'
};

// ─────────────────────────────────────────────────────────────
// خريطة وهمية (mock) — شبكة مع pins
// ─────────────────────────────────────────────────────────────
function MapMock({
  stations,
  onSelect
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'linear-gradient(135deg, #d8e6dd 0%, #e9f0eb 60%, #dde8e0 100%)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 400 320",
    preserveAspectRatio: "none",
    style: {
      position: 'absolute',
      inset: 0,
      width: '100%',
      height: '100%'
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("pattern", {
    id: "streets",
    width: "48",
    height: "48",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 24h48M24 0v48",
    stroke: "#c5d3cc",
    strokeWidth: "1"
  })), /*#__PURE__*/React.createElement("pattern", {
    id: "bigStreets",
    width: "120",
    height: "120",
    patternUnits: "userSpaceOnUse"
  }, /*#__PURE__*/React.createElement("path", {
    d: "M0 60h120M60 0v120",
    stroke: "#b1c2b8",
    strokeWidth: "2.5"
  }))), /*#__PURE__*/React.createElement("rect", {
    width: "400",
    height: "320",
    fill: "url(#streets)"
  }), /*#__PURE__*/React.createElement("rect", {
    width: "400",
    height: "320",
    fill: "url(#bigStreets)"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 0 L400 0 L400 60 Q300 80 200 50 Q100 20 0 50 Z",
    fill: "#b8d4dd",
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("text", {
    x: "200",
    y: "32",
    textAnchor: "middle",
    fontSize: "11",
    fill: "#5d8a96",
    fontFamily: "Cairo, sans-serif",
    fontWeight: "700"
  }, "\u0627\u0644\u0628\u062D\u0631 \u0627\u0644\u0645\u062A\u0648\u0633\u0637"), /*#__PURE__*/React.createElement("path", {
    d: "M0 180 Q150 160 250 200 T400 220",
    stroke: "#fff",
    strokeWidth: "6",
    fill: "none",
    opacity: "0.9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M0 180 Q150 160 250 200 T400 220",
    stroke: "#f5c93a",
    strokeWidth: "2",
    fill: "none",
    strokeDasharray: "6 4"
  })), stations.map(s => {
    const c = STATUS_COLORS[s.status];
    return /*#__PURE__*/React.createElement("button", {
      key: s.id,
      onClick: () => onSelect(s),
      style: {
        position: 'absolute',
        left: `${s.coords.x}%`,
        top: `${s.coords.y}%`,
        transform: 'translate(-50%, -100%)',
        width: 36,
        height: 36,
        borderRadius: '50% 50% 50% 0',
        transformOrigin: 'center bottom',
        background: c.bg,
        border: '2px solid #fff',
        boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0
      },
      "aria-label": s.name
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        transform: 'rotate(45deg)',
        display: 'flex'
      }
    }, /*#__PURE__*/React.createElement(Icon.fuel, {
      style: {
        width: 16,
        height: 16,
        color: c.text
      }
    })));
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: '48%',
      top: '52%',
      transform: 'translate(-50%, -50%)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: '#1976ed',
      border: '3px solid #fff',
      boxShadow: '0 0 0 6px rgba(25, 118, 237, 0.18)'
    }
  })));
}

// ─────────────────────────────────────────────────────────────
// شاشة: حسابي
// ─────────────────────────────────────────────────────────────
function AccountScreen({
  favorites,
  recents,
  onSelectStation,
  settings,
  setSettings
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '4px 14px 110px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#0f172a',
      color: '#fff',
      borderRadius: 20,
      padding: '18px 18px',
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      boxShadow: '0 10px 22px rgba(15, 23, 42, 0.12)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: '#1e293b',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.18)',
      fontSize: 22,
      fontWeight: 800
    }
  }, "\u0639"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800
    }
  }, "\u0639\u0628\u062F\u0627\u0644\u0644\u0647 \u0627\u0644\u0637\u0631\u0627\u0628\u0644\u0633\u064A"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#94a3b8',
      marginTop: 4
    }
  }, "\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646\u0630 2024")), /*#__PURE__*/React.createElement(Icon.chevronLeft, {
    style: {
      width: 22,
      height: 22,
      opacity: 0.7
    }
  })), /*#__PURE__*/React.createElement(Section, {
    title: "\u0627\u0644\u0645\u0641\u0636\u0644\u0629",
    icon: /*#__PURE__*/React.createElement(Icon.star, {
      style: {
        width: 18,
        height: 18,
        color: '#f5c93a'
      }
    })
  }, favorites.length === 0 ? /*#__PURE__*/React.createElement(EmptyHint, {
    text: "\u0627\u0636\u063A\u0637 \u2B50 \u0639\u0644\u0649 \u0623\u064A \u0645\u062D\u0637\u0629 \u0644\u0625\u0636\u0627\u0641\u062A\u0647\u0627 \u0647\u0646\u0627"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, favorites.map((s, i) => /*#__PURE__*/React.createElement(StationRow, {
    key: s.id,
    station: s,
    index: i,
    onClick: () => onSelectStation(s)
  })))), /*#__PURE__*/React.createElement(Section, {
    title: "\u0622\u062E\u0631 \u0627\u0633\u062A\u062E\u062F\u0627\u0645",
    icon: /*#__PURE__*/React.createElement(Icon.clock, {
      style: {
        width: 18,
        height: 18,
        color: '#16a34a'
      }
    })
  }, recents.length === 0 ? /*#__PURE__*/React.createElement(EmptyHint, {
    text: "\u0644\u0645 \u062A\u0641\u062A\u062D \u0623\u064A \u0645\u062D\u0637\u0629 \u0628\u0639\u062F"
  }) : /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8
    }
  }, recents.map((s, i) => /*#__PURE__*/React.createElement(StationRow, {
    key: s.id,
    station: s,
    index: i,
    onClick: () => onSelectStation(s)
  })))), /*#__PURE__*/React.createElement(Section, {
    title: "\u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A"
  }, /*#__PURE__*/React.createElement(SettingsRow, {
    icon: /*#__PURE__*/React.createElement(Icon.bell, {
      style: {
        width: 18,
        height: 18,
        color: '#16a34a'
      }
    }),
    title: "\u0625\u0634\u0639\u0627\u0631\u0627\u062A \u0627\u0644\u0632\u062D\u0645\u0629",
    subtitle: "\u0646\u0628\u0647\u0646\u064A \u0644\u0645\u0627 \u064A\u062A\u063A\u064A\u0631 \u0648\u0636\u0639 \u0645\u062D\u0637\u0629 \u0642\u0631\u064A\u0628\u0629",
    toggle: settings.notif,
    onToggle: () => setSettings(s => ({
      ...s,
      notif: !s.notif
    }))
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: /*#__PURE__*/React.createElement(Icon.target, {
      style: {
        width: 18,
        height: 18,
        color: '#16a34a'
      }
    }),
    title: "\u0627\u0644\u0645\u0648\u0642\u0639 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A",
    subtitle: "\u0627\u0633\u062A\u062E\u062F\u0645 \u0645\u0648\u0642\u0639\u064A \u0627\u0644\u062D\u0627\u0644\u064A",
    toggle: settings.location,
    onToggle: () => setSettings(s => ({
      ...s,
      location: !s.location
    }))
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: /*#__PURE__*/React.createElement(Icon.globe, {
      style: {
        width: 18,
        height: 18,
        color: '#16a34a'
      }
    }),
    title: "\u0627\u0644\u0644\u063A\u0629",
    subtitle: "\u0627\u0644\u0639\u0631\u0628\u064A\u0629"
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: /*#__PURE__*/React.createElement(Icon.shield, {
      style: {
        width: 18,
        height: 18,
        color: '#16a34a'
      }
    }),
    title: "\u0627\u0644\u062E\u0635\u0648\u0635\u064A\u0629",
    subtitle: "\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0648\u0642\u0639 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A"
  }), /*#__PURE__*/React.createElement(SettingsRow, {
    icon: /*#__PURE__*/React.createElement(Icon.share, {
      style: {
        width: 18,
        height: 18,
        color: '#16a34a'
      }
    }),
    title: "\u0634\u0627\u0631\u0643 \u0627\u0644\u062A\u0637\u0628\u064A\u0642",
    subtitle: "\u0633\u0627\u0639\u062F \u0634\u062E\u0635 \u064A\u062F\u0648\u0631 \u0639\u0644\u0649 \u0628\u0646\u0632\u064A\u0646",
    last: true
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      fontSize: 11,
      color: '#8a9590',
      marginTop: 4
    }
  }, "\u0634\u064A\u0644 \xB7 \u0627\u0644\u0625\u0635\u062F\u0627\u0631 1.0.0"));
}
function Section({
  title,
  icon,
  children
}) {
  return /*#__PURE__*/React.createElement("section", {
    style: {
      background: '#fff',
      borderRadius: 20,
      border: '1px solid #e2e8f0',
      padding: '18px 16px',
      boxShadow: '0 1px 3px rgba(15, 23, 42, 0.04)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '0 2px 14px'
    }
  }, icon, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 16,
      fontWeight: 800,
      color: '#0f172a',
      letterSpacing: '-0.01em'
    }
  }, title)), children);
}
function EmptyHint({
  text
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '18px 16px',
      textAlign: 'center',
      color: '#64748b',
      fontSize: 13.5,
      background: '#f8fafc',
      borderRadius: 12,
      border: '1px dashed #d6dfdb'
    }
  }, text);
}
function SettingsRow({
  icon,
  title,
  subtitle,
  toggle,
  onToggle,
  last
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 8px',
      borderBottom: last ? 'none' : '1px solid #f1f4f2',
      cursor: 'pointer'
    },
    onClick: onToggle
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: '#f1f5f9',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, icon), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14.5,
      fontWeight: 700,
      color: '#0f172a'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: '#64748b',
      marginTop: 2
    }
  }, subtitle)), typeof toggle === 'boolean' ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 26,
      borderRadius: 999,
      background: toggle ? '#16a34a' : '#d4dad7',
      position: 'relative',
      transition: 'background 0.2s',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 3,
      left: toggle ? 21 : 3,
      width: 20,
      height: 20,
      borderRadius: '50%',
      background: '#fff',
      transition: 'left 0.2s',
      boxShadow: '0 2px 4px rgba(0,0,0,0.15)'
    }
  })) : /*#__PURE__*/React.createElement(Icon.chevronLeft, {
    style: {
      width: 18,
      height: 18,
      color: '#94a3b8',
      flexShrink: 0
    }
  }));
}

// ─────────────────────────────────────────────────────────────
// ورقة تفاصيل محطة (Sheet)
// ─────────────────────────────────────────────────────────────
function StationSheet({
  station,
  onClose,
  onOpenMaps,
  isFav,
  onToggleFav
}) {
  if (!station) return null;
  const c = STATUS_COLORS[station.status];
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'absolute',
      inset: 0,
      background: 'rgba(15, 26, 20, 0.45)',
      backdropFilter: 'blur(2px)',
      zIndex: 80,
      display: 'flex',
      alignItems: 'flex-end',
      animation: 'shaleFade 0.18s ease-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width: '100%',
      background: '#fff',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: '8px 16px 24px',
      animation: 'shaleSlide 0.24s ease-out'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 44,
      height: 4,
      borderRadius: 999,
      background: '#cbd5e1',
      margin: '6px auto 14px'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement(FuelBadge, {
    size: 56,
    status: station.status
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 800,
      color: '#0f172a'
    }
  }, station.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12.5,
      color: '#64748b',
      marginTop: 3
    }
  }, station.area), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement(StatusPill, {
    status: station.status,
    large: true
  }))), /*#__PURE__*/React.createElement("button", {
    onClick: onToggleFav,
    style: {
      width: 38,
      height: 38,
      borderRadius: 12,
      background: isFav ? '#fff8dc' : '#f1f5f9',
      border: '1px solid ' + (isFav ? '#f5c93a' : '#e2e8f0'),
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement(Icon.star, {
    style: {
      width: 18,
      height: 18,
      color: isFav ? '#f5c93a' : '#bcc7c2'
    }
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement(Stat, {
    label: "\u0627\u0644\u0645\u0633\u0627\u0641\u0629",
    value: `${station.distanceKm} كم`
  }), /*#__PURE__*/React.createElement(Stat, {
    label: "\u0627\u0644\u0648\u0642\u062A",
    value: `${station.etaMin} د`
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: 12,
      borderRadius: 14,
      background: '#f5f9f6',
      fontSize: 12.5,
      color: '#64748b',
      lineHeight: 1.6
    }
  }, "\u0622\u062E\u0631 \u062A\u062D\u062F\u064A\u062B: ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: '#0f172a'
    }
  }, station.updated)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => onOpenMaps(station),
    className: "shale-press",
    style: {
      flex: 1,
      background: '#16a34a',
      color: '#fff',
      border: 'none',
      padding: '14px 16px',
      borderRadius: 14,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: 'inherit',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(Icon.external, {
    style: {
      width: 17,
      height: 17
    }
  }), "\u0627\u0641\u062A\u062D \u0641\u064A \u062E\u0631\u0627\u0626\u0637 Google"), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    style: {
      background: '#f1f5f9',
      color: '#0f172a',
      border: '1px solid #e6ebe8',
      padding: '0 16px',
      borderRadius: 14,
      fontSize: 15,
      fontWeight: 700,
      fontFamily: 'inherit',
      cursor: 'pointer'
    }
  }, "\u0625\u063A\u0644\u0627\u0642"))));
}
function Stat({
  label,
  value
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: '#f5f9f6',
      borderRadius: 12,
      padding: '10px 8px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11,
      color: '#64748b',
      fontWeight: 600
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 17,
      fontWeight: 800,
      color: '#0f172a',
      marginTop: 3
    }
  }, value));
}

// ─────────────────────────────────────────────────────────────
// التنقل السفلي
// ─────────────────────────────────────────────────────────────
function BottomNav({
  tab,
  setTab
}) {
  // Tabs in RTL order: حسابي | الرئيسية | بحث (الخريطة)
  const items = [{
    id: 'account',
    label: 'حسابي',
    icon: Icon.user
  }, {
    id: 'home',
    label: 'الرئيسية',
    icon: Icon.home,
    primary: true
  }, {
    id: 'search',
    label: 'بحث',
    icon: Icon.search
  }];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      bottom: 16,
      left: 14,
      right: 14,
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 22,
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-around',
      gap: 6,
      boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
      zIndex: 70
    }
  }, items.map(it => {
    const active = it.id === tab;
    return /*#__PURE__*/React.createElement("button", {
      key: it.id,
      onClick: () => setTab(it.id),
      style: {
        flex: active ? '1 1 auto' : '0 0 auto',
        background: active ? '#0f172a' : 'transparent',
        color: active ? '#fff' : '#334155',
        border: 'none',
        padding: active ? '11px 18px' : '11px 14px',
        borderRadius: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'all 0.18s'
      }
    }, /*#__PURE__*/React.createElement(it.icon, {
      style: {
        width: 20,
        height: 20
      }
    }), active && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 800
      }
    }, it.label));
  }));
}

// ─────────────────────────────────────────────────────────────
// التطبيق الرئيسي
// ─────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "mood": "calm",
  "density": "standard",
  "voice": "casual",
  "userName": "عبدالله الطرابلسي",
  "city": "طرابلس"
} /*EDITMODE-END*/;

// ─────────────────────────────────────────────────────────────
// Themes — each mood reshapes the hero, accents, and atmosphere
// ─────────────────────────────────────────────────────────────
const THEMES = {
  calm: {
    label: 'هادئ',
    appBg: '#f8fafc',
    headerBg: '#f8fafc',
    heroBg: '#0f172a',
    heroAccent: '#22c55e',
    heroAccentInk: '#0a3a1c',
    heroChipBg: 'rgba(34, 197, 94, 0.16)',
    heroChipInk: '#86efac',
    heroSubtle: '#94a3b8',
    heroPanel: '#1e293b',
    headerLogoBg: '#16a34a',
    headerLogoShadow: 'rgba(22, 163, 74, 0.28)',
    livePillDot: '#16a34a',
    crownLabel: 'الأفضل الآن',
    bodyBg: 'radial-gradient(circle at 20% 10%, rgba(14, 122, 50, 0.08), transparent 40%), radial-gradient(circle at 80% 90%, rgba(245, 201, 58, 0.08), transparent 40%), #eef2f0'
  },
  urgent: {
    label: 'طوارئ',
    appBg: '#fff7f5',
    headerBg: '#fff7f5',
    heroBg: '#7f1d1d',
    heroAccent: '#fbbf24',
    heroAccentInk: '#451a03',
    heroChipBg: 'rgba(251, 191, 36, 0.18)',
    heroChipInk: '#fde68a',
    heroSubtle: '#fecaca',
    heroPanel: '#991b1b',
    headerLogoBg: '#dc2626',
    headerLogoShadow: 'rgba(220, 38, 38, 0.32)',
    livePillDot: '#dc2626',
    crownLabel: 'أسرع! الأقرب الآن',
    bodyBg: 'radial-gradient(circle at 20% 10%, rgba(220, 38, 38, 0.10), transparent 40%), radial-gradient(circle at 80% 90%, rgba(251, 191, 36, 0.10), transparent 40%), #fef2f2'
  },
  optimistic: {
    label: 'متفائل',
    appBg: '#fdfaf3',
    headerBg: '#fdfaf3',
    heroBg: '#0c4a3e',
    heroAccent: '#fbbf24',
    heroAccentInk: '#3a2a05',
    heroChipBg: 'rgba(251, 191, 36, 0.20)',
    heroChipInk: '#fde68a',
    heroSubtle: '#a7d4c5',
    heroPanel: '#0e5a4b',
    headerLogoBg: '#0c4a3e',
    headerLogoShadow: 'rgba(12, 74, 62, 0.28)',
    livePillDot: '#0c4a3e',
    crownLabel: 'محطة اليوم',
    bodyBg: 'radial-gradient(circle at 20% 10%, rgba(251, 191, 36, 0.12), transparent 40%), radial-gradient(circle at 80% 90%, rgba(12, 74, 62, 0.08), transparent 40%), #fdf6e3'
  }
};

// ─────────────────────────────────────────────────────────────
// Voice — three ways the app talks about station status
// ─────────────────────────────────────────────────────────────
const VOICES = {
  casual: {
    available: {
      label: 'عالبومبة طول',
      short: 'عالبومبة'
    },
    light: {
      label: 'طابور خفيف',
      short: 'خفيف'
    },
    crowded: {
      label: 'زحمة',
      short: 'زحمة'
    },
    closed: {
      label: 'مسكر',
      short: 'مسكر'
    },
    second: 'الخيار الثاني',
    nearby: 'محطات قريبة أخرى',
    cta: 'افتح في خرائط Google',
    live: 'مباشر'
  },
  formal: {
    available: {
      label: 'متوفر',
      short: 'متوفر'
    },
    light: {
      label: 'ازدحام خفيف',
      short: 'خفيف'
    },
    crowded: {
      label: 'مزدحمة',
      short: 'مزدحمة'
    },
    closed: {
      label: 'مغلقة',
      short: 'مغلقة'
    },
    second: 'الخيار البديل',
    nearby: 'محطات قريبة',
    cta: 'فتح في خرائط Google',
    live: 'تحديث مباشر'
  },
  emoji: {
    available: {
      label: '✅ متوفر',
      short: '✅'
    },
    light: {
      label: '⏳ خفيف',
      short: '⏳'
    },
    crowded: {
      label: '⚠️ زحمة',
      short: '⚠️'
    },
    closed: {
      label: '🚫 مسكر',
      short: '🚫'
    },
    second: '⭐ التالي',
    nearby: '⛽ قريبة منك',
    cta: '🗺️ افتح Google Maps',
    live: '🔴 مباشر'
  }
};

// ─────────────────────────────────────────────────────────────
// Density presets — reshape information architecture
// ─────────────────────────────────────────────────────────────
const DENSITIES = {
  cozy: {
    heroPad: 26,
    heroTitle: 30,
    heroRadius: 28,
    gap: 22,
    rowGap: 14,
    rowPad: 18,
    rowsShown: 2,
    showSecondary: true,
    pagePad: '12px 18px 130px'
  },
  standard: {
    heroPad: 22,
    heroTitle: 26,
    heroRadius: 24,
    gap: 18,
    rowGap: 12,
    rowPad: 16,
    rowsShown: 3,
    showSecondary: true,
    pagePad: '8px 16px 120px'
  },
  compact: {
    heroPad: 16,
    heroTitle: 22,
    heroRadius: 20,
    gap: 12,
    rowGap: 8,
    rowPad: 12,
    rowsShown: 5,
    showSecondary: false,
    pagePad: '6px 14px 110px'
  }
};
const ThemeCtx = React.createContext(THEMES.calm);
const VoiceCtx = React.createContext(VOICES.casual);
const DensityCtx = React.createContext(DENSITIES.standard);
const useTheme = () => React.useContext(ThemeCtx);
const useVoice = () => React.useContext(VoiceCtx);
const useDensity = () => React.useContext(DensityCtx);
function ShaleApp() {
  const [tab, setTab] = useState('home');
  const [selected, setSelected] = useState(null);
  const [favIds, setFavIds] = useState(['hani', 'zawya']);
  const [recentIds, setRecentIds] = useState(['matar', 'gashir']);
  const [query, setQuery] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [settings, setSettings] = useState({
    notif: true,
    location: true
  });
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];
  const onOpenMaps = s => {
    // مجرد أنيميشن في النموذج
    const url = `https://www.google.com/maps/search/${encodeURIComponent(s.name + ' طرابلس')}`;
    window.open(url, '_blank');
  };
  const onSelectStation = s => {
    setSelected(s);
    setRecentIds(prev => [s.id, ...prev.filter(id => id !== s.id)].slice(0, 4));
  };
  const favorites = favIds.map(id => STATIONS.find(s => s.id === id)).filter(Boolean);
  const recents = recentIds.map(id => STATIONS.find(s => s.id === id)).filter(Boolean);
  const isFav = selected && favIds.includes(selected.id);
  const toggleFav = () => {
    if (!selected) return;
    setFavIds(prev => prev.includes(selected.id) ? prev.filter(x => x !== selected.id) : [...prev, selected.id]);
  };

  // عناوين الشاشات
  const titles = {
    home: {
      title: 'شيل',
      sub: `أفضل محطة الآن في ${tweaks.city}`
    },
    search: {
      title: 'الخريطة',
      sub: 'استكشف المحطات حولك'
    },
    account: {
      title: 'حسابي',
      sub: 'مفضلتك وإعداداتك'
    }
  };
  const t = titles[tab];
  const theme = THEMES[tweaks.mood] || THEMES.calm;
  const voice = VOICES[tweaks.voice] || VOICES.casual;
  const density = DENSITIES[tweaks.density] || DENSITIES.standard;

  // Update body bg to match mood
  React.useEffect(() => {
    document.body.style.background = theme.bodyBg;
  }, [theme.bodyBg]);
  return /*#__PURE__*/React.createElement(ThemeCtx.Provider, {
    value: theme
  }, /*#__PURE__*/React.createElement(VoiceCtx.Provider, {
    value: voice
  }, /*#__PURE__*/React.createElement(DensityCtx.Provider, {
    value: density
  }, /*#__PURE__*/React.createElement(IOSDevice, {
    width: 402,
    height: 874,
    dark: false
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: '100%',
      background: theme.appBg,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'background 0.3s ease'
    },
    dir: "rtl",
    "data-screen-label": `Shale - ${t.title}`
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '6px 16px 12px',
      background: theme.headerBg,
      flexShrink: 0,
      transition: 'background 0.3s ease'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      background: theme.headerLogoBg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 4px 10px ${theme.headerLogoShadow}`,
      transition: 'background 0.3s ease, box-shadow 0.3s ease'
    }
  }, /*#__PURE__*/React.createElement(Icon.fuel, {
    style: {
      width: 20,
      height: 20,
      color: '#fff'
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 18,
      fontWeight: 800,
      color: '#0f172a',
      lineHeight: 1.1
    }
  }, t.title), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: '#64748b',
      marginTop: 2
    }
  }, t.sub)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '6px 10px',
      borderRadius: 999,
      background: '#fff',
      border: '1px solid #e2e8f0',
      fontSize: 11.5,
      fontWeight: 700,
      color: '#0f172a'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: theme.livePillDot
    }
  }), voice.live))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      overflowX: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    key: tab,
    className: "shale-tab-in"
  }, tab === 'home' && /*#__PURE__*/React.createElement(HomeScreen, {
    stations: STATIONS,
    onOpenMaps: onOpenMaps,
    onSelectStation: onSelectStation
  }), tab === 'search' && /*#__PURE__*/React.createElement(MapScreen, {
    stations: STATIONS,
    query: query,
    setQuery: setQuery,
    selectedArea: selectedArea,
    setSelectedArea: setSelectedArea,
    onSelectStation: onSelectStation
  }), tab === 'account' && /*#__PURE__*/React.createElement(AccountScreen, {
    favorites: favorites,
    recents: recents,
    onSelectStation: onSelectStation,
    settings: settings,
    setSettings: setSettings
  }))), /*#__PURE__*/React.createElement(BottomNav, {
    tab: tab,
    setTab: setTab
  }), selected && /*#__PURE__*/React.createElement(StationSheet, {
    station: selected,
    onClose: () => setSelected(null),
    onOpenMaps: onOpenMaps,
    isFav: isFav,
    onToggleFav: toggleFav
  }))), window.TweaksPanel && /*#__PURE__*/React.createElement(window.TweaksPanel, {
    title: "Tweaks"
  }, /*#__PURE__*/React.createElement(window.TweakSection, {
    label: "\u0627\u0644\u0645\u0632\u0627\u062C / Mood"
  }, /*#__PURE__*/React.createElement(window.TweakRadio, {
    label: "\u0627\u0644\u0623\u062C\u0648\u0627\u0621",
    value: tweaks.mood,
    options: [{
      value: 'calm',
      label: 'هادئ'
    }, {
      value: 'urgent',
      label: 'طوارئ'
    }, {
      value: 'optimistic',
      label: 'متفائل'
    }],
    onChange: v => setTweak('mood', v)
  })), /*#__PURE__*/React.createElement(window.TweakSection, {
    label: "\u0627\u0644\u0643\u062B\u0627\u0641\u0629 / Density"
  }, /*#__PURE__*/React.createElement(window.TweakRadio, {
    label: "\u0625\u064A\u0642\u0627\u0639 \u0627\u0644\u0634\u0627\u0634\u0629",
    value: tweaks.density,
    options: [{
      value: 'cozy',
      label: 'مريح'
    }, {
      value: 'standard',
      label: 'عادي'
    }, {
      value: 'compact',
      label: 'مكثف'
    }],
    onChange: v => setTweak('density', v)
  })), /*#__PURE__*/React.createElement(window.TweakSection, {
    label: "\u0627\u0644\u0635\u0648\u062A / Voice"
  }, /*#__PURE__*/React.createElement(window.TweakRadio, {
    label: "\u0646\u0628\u0631\u0629 \u0627\u0644\u0645\u062D\u0637\u0627\u062A",
    value: tweaks.voice,
    options: [{
      value: 'casual',
      label: 'دارجة'
    }, {
      value: 'formal',
      label: 'فصحى'
    }, {
      value: 'emoji',
      label: 'إيموجي'
    }],
    onChange: v => setTweak('voice', v)
  }))))));
}

// تركيب
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(/*#__PURE__*/React.createElement(ShaleApp, null));