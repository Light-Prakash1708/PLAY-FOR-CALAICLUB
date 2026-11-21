// Original chibi pilot portraits (SVG): big head, leather flight helmet,
// goggles, fur-collared jacket and a saluting arm. CSS animates the idle
// bob, blinks, the talking mouth and the salute.

const LOOKS = {
  sen: { skin: '#C98D63', skinD: '#A8704C', helmet: '#2E5E6E', helmetD: '#1F4250', jacket: '#24384F', jacketD: '#18273A', collar: '#E9E2D2', goggles: 'up', lens: '#7FE0D8', extra: 'headset', hair: '#2A1A14', badge: '#FFD24A' },
  falcon: { skin: '#F2C9A6', skinD: '#D9A985', helmet: '#7A4A2A', helmetD: '#5A3520', jacket: '#6B3E26', jacketD: '#4E2C1B', collar: '#EDE4D3', goggles: 'up', lens: '#9FE3FF', extra: 'grin', badge: '#3D8BFF' },
  hawk: { skin: '#D9A27A', skinD: '#B98560', helmet: '#4F5B3A', helmetD: '#3A4429', jacket: '#5A4A32', jacketD: '#40341F', collar: '#D8D2C2', goggles: 'down', lens: '#3C6E58', extra: 'mustache', badge: '#7FB3FF' },
  vex: { skin: '#D7C0B0', skinD: '#B49B8A', helmet: '#3A1418', helmetD: '#250A0D', jacket: '#2A2226', jacketD: '#18131A', collar: '#6B1A20', goggles: 'down', lens: '#FF3B3B', extra: 'scar', badge: '#FF4B4B' },
};

/** Returns SVG markup for a pilot. viewBox 0 0 100 110. */
export function pilotSVG(who) {
  const L = LOOKS[who] || LOOKS.falcon;
  const gogUp = L.goggles === 'up';
  const goggles = (y, glow) => `
    <g class="pf-gog">
      <rect x="27" y="${y - 2}" width="46" height="5" rx="2.5" fill="#1C1C22"/>
      <circle cx="39" cy="${y}" r="8.5" fill="#2A2A30"/><circle cx="61" cy="${y}" r="8.5" fill="#2A2A30"/>
      <circle cx="39" cy="${y}" r="6" fill="${L.lens}" opacity="${glow ? 0.95 : 0.75}"/><circle cx="61" cy="${y}" r="6" fill="${L.lens}" opacity="${glow ? 0.95 : 0.75}"/>
      <circle cx="36.5" cy="${y - 2.5}" r="1.8" fill="#fff" opacity=".8"/><circle cx="58.5" cy="${y - 2.5}" r="1.8" fill="#fff" opacity=".8"/>
    </g>`;
  return `<svg class="pf-svg" viewBox="0 0 100 110" aria-hidden="true">
    <ellipse cx="50" cy="107" rx="30" ry="3" fill="rgba(0,0,0,.25)"/>
    <g class="pf-body">
      <!-- jacket -->
      <path d="M18 110 C18 86 30 78 50 78 C70 78 82 86 82 110 Z" fill="${L.jacket}"/>
      <path d="M50 80 L50 110" stroke="${L.jacketD}" stroke-width="2"/>
      <path d="M58 92 h10 v6 h-10z" fill="${L.badge}" opacity=".9"/>
      <!-- fur collar -->
      <path d="M30 82 C38 76 62 76 70 82 C66 90 58 88 50 92 C42 88 34 90 30 82 Z" fill="${L.collar}"/>
      <!-- head -->
      <g class="pf-head">
        <ellipse cx="50" cy="52" rx="25" ry="26" fill="${L.skin}"/>
        <ellipse cx="25.5" cy="56" rx="4" ry="6" fill="${L.skinD}"/><ellipse cx="74.5" cy="56" rx="4" ry="6" fill="${L.skinD}"/>
        ${L.hair ? `<path d="M27 50 C27 30 73 30 73 50 C66 42 34 42 27 50Z" fill="${L.hair}"/>` : ''}
        <!-- eyes -->
        <g class="pf-eyes">
          <ellipse cx="40" cy="55" rx="3.2" ry="3.8" fill="#1B1B22"/><ellipse cx="60" cy="55" rx="3.2" ry="3.8" fill="#1B1B22"/>
          <circle cx="41" cy="53.8" r="1.1" fill="#fff"/><circle cx="61" cy="53.8" r="1.1" fill="#fff"/>
        </g>
        <path d="M35 48.5 q5 -3 10 0 M55 48.5 q5 -3 10 0" stroke="${L.skinD}" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        ${L.extra === 'mustache' ? `<path d="M41 66 q9 -5 18 0 q-9 3 -18 0z" fill="#4A3424"/>` : ''}
        ${L.extra === 'scar' ? `<path d="M63 46 l6 14" stroke="#9B5A5A" stroke-width="1.6" stroke-linecap="round"/>` : ''}
        <!-- mouth (animated while talking) -->
        <g class="pf-mouth"><ellipse cx="50" cy="69" rx="${L.extra === 'grin' ? 6 : 4.5}" ry="2.6" fill="#6A2C2C"/><ellipse cx="50" cy="70" rx="2.6" ry="1" fill="#E07A7A"/></g>
        <ellipse cx="34" cy="63" rx="3.5" ry="2" fill="#E89A8A" opacity=".45"/><ellipse cx="66" cy="63" rx="3.5" ry="2" fill="#E89A8A" opacity=".45"/>
        <!-- flight helmet with ear flaps -->
        <path d="M23 50 C23 18 77 18 77 50 C77 44 70 36 50 36 C30 36 23 44 23 50 Z" fill="${L.helmet}"/>
        <path d="M23 48 C20 60 22 70 27 74 L31 72 C27 64 27 56 28 48 Z" fill="${L.helmetD}"/>
        <path d="M77 48 C80 60 78 70 73 74 L69 72 C73 64 73 56 72 48 Z" fill="${L.helmetD}"/>
        <path d="M32 33 C42 28 58 28 68 33" stroke="${L.helmetD}" stroke-width="1.5" fill="none" opacity=".7"/>
        <ellipse cx="40" cy="27" rx="9" ry="4" fill="#fff" opacity=".18"/>
        ${gogUp ? goggles(37, false) : goggles(54, who === 'vex')}
        ${L.extra === 'headset' ? `<path d="M74 58 C82 64 72 72 60 70" stroke="#222" stroke-width="2.2" fill="none"/><circle cx="59" cy="70" r="2.6" fill="#222"/>` : ''}
      </g>
      <!-- saluting arm -->
      <g class="pf-arm">
        <path d="M24 92 C20 84 22 76 28 72" stroke="${L.jacket}" stroke-width="10" stroke-linecap="round" fill="none"/>
        <ellipse cx="30" cy="68" rx="6" ry="4.6" fill="${L.skin}" transform="rotate(-35 30 68)"/>
      </g>
    </g>
  </svg>`;
}
