const PATHS = {
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="9" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <line x1="3.5" y1="9.5" x2="20.5" y2="9.5" />
      <line x1="8" y1="3" x2="8" y2="6.5" />
      <line x1="16" y1="3" x2="16" y2="6.5" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-6.1-6.5-11A6.5 6.5 0 0 1 18.5 10c0 4.9-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  mountain: <path d="M3 20 L9 8 L13 15 L16 10 L21 20 Z" />,
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="8.5" r="2.4" />
      <path d="M15.8 14.7c2.4.3 4.2 2.3 4.2 5.3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="3.5" y1="12" x2="20.5" y2="12" />
      <path d="M12 3.5c2.6 2.3 4 5.3 4 8.5s-1.4 6.2-4 8.5c-2.6-2.3-4-5.3-4-8.5s1.4-6.2 4-8.5Z" />
    </>
  ),
  activity: <path d="M3 17h3.5l2.5-6 3 10 2.5-7.5 2 3.5H21" />,
  route: (
    <>
      <circle cx="6" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="M6 8.2v3.3a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4" strokeDasharray="2.5 2.5" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2l1-2h7l1 2h2A1.5 1.5 0 0 1 20 8.5v9A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5Z" />
      <circle cx="12" cy="12.5" r="3.3" />
    </>
  ),
  droplet: (
    <path d="M12 3.5s6 6.8 6 11a6 6 0 0 1-12 0c0-4.2 6-11 6-11Z" />
  ),
  cloudSun: (
    <>
      <circle cx="7.5" cy="7.5" r="2.3" />
      <line x1="7.5" y1="3" x2="7.5" y2="4.3" />
      <line x1="3" y1="7.5" x2="4.3" y2="7.5" />
      <line x1="4.4" y1="4.4" x2="5.3" y2="5.3" />
      <path d="M8.5 20h8a3.7 3.7 0 0 0 1-7.3 5 5 0 0 0-9.6-1.4A3.8 3.8 0 0 0 8.5 20Z" />
    </>
  ),
  wind: (
    <>
      <path d="M3 8h10.5a2.3 2.3 0 1 0-2.3-2.3" />
      <path d="M3 13h14.5a2.3 2.3 0 1 1-2.3 2.3" />
      <path d="M3 18h8.5a2 2 0 1 0-2-2" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <line x1="12" y1="2.5" x2="12" y2="4.5" />
      <line x1="12" y1="19.5" x2="12" y2="21.5" />
      <line x1="2.5" y1="12" x2="4.5" y2="12" />
      <line x1="19.5" y1="12" x2="21.5" y2="12" />
      <line x1="5.1" y1="5.1" x2="6.5" y2="6.5" />
      <line x1="17.5" y1="17.5" x2="18.9" y2="18.9" />
      <line x1="5.1" y1="18.9" x2="6.5" y2="17.5" />
      <line x1="17.5" y1="6.5" x2="18.9" y2="5.1" />
    </>
  ),
  map: (
    <>
      <path d="M9 4.5 4 6.5v13l5-2 6 2 5-2v-13l-5 2-6-2Z" />
      <line x1="9" y1="4.5" x2="9" y2="17.5" />
      <line x1="15" y1="6.5" x2="15" y2="19.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <polyline points="12,7 12,12 15.5,14" />
    </>
  ),
  backpack: (
    <>
      <path d="M8 7.5V6a4 4 0 0 1 8 0v1.5" />
      <path d="M6 9a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2Z" />
      <line x1="9.5" y1="12" x2="14.5" y2="12" />
      <path d="M9 7.5h6v3.5H9Z" />
    </>
  ),
  leaf: (
    <>
      <path d="M5 19c8 1 13-4 14-13-9 1-13 5-14 13Z" />
      <path d="M6 18c2.5-4 5.5-7 12-11" />
    </>
  ),
  wallet: (
    <>
      <rect x="3.5" y="6.5" width="17" height="12" rx="2" />
      <path d="M3.5 10h13.5a2.5 2.5 0 0 1 0 5H14a1.6 1.6 0 0 1 0-3.2h6.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 4 21 19H3Z" />
      <line x1="12" y1="10" x2="12" y2="14.5" />
      <circle cx="12" cy="17" r="0.15" fill="currentColor" stroke="currentColor" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 15a8 8 0 1 1 16 0" />
      <line x1="12" y1="15" x2="15.5" y2="10.5" />
      <line x1="4" y1="15" x2="4" y2="17" />
      <line x1="20" y1="15" x2="20" y2="17" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <line x1="6.4" y1="6.4" x2="17.6" y2="17.6" />
    </>
  ),
};

export default function Icon({ name, size = 18, color = "currentColor", style }) {
  const path = PATHS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, verticalAlign: "middle", ...style }}
    >
      {path}
    </svg>
  );
}
