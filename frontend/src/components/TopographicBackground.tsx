export default function TopographicBackground() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 0,
        overflow: "hidden",
        opacity: 0.35,
      }}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1440 320"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0%, black 60%, black 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 60%, black 100%)",
        }}
      >
        <path d="M -100 30 C 240 15, 520 80, 780 45 C 1040 15, 1260 70, 1540 40" stroke="rgba(255, 255, 255, 0.12)" strokeWidth="1" />
        <path d="M -100 70 C 220 40, 540 120, 800 80 C 1060 40, 1280 110, 1540 70" stroke="rgba(255, 255, 255, 0.16)" strokeWidth="1" />
        <path d="M -100 120 C 200 80, 560 170, 820 120 C 1080 70, 1300 160, 1540 110" stroke="rgba(255, 255, 255, 0.2)" strokeWidth="1" />
        <path d="M -100 170 C 180 130, 580 220, 840 160 C 1100 100, 1320 210, 1540 150" stroke="rgba(255, 255, 255, 0.14)" strokeWidth="1" strokeDasharray="5 3" />
        <path d="M -100 220 C 160 170, 600 270, 860 200 C 1120 130, 1340 260, 1540 190" stroke="rgba(255, 255, 255, 0.18)" strokeWidth="1" />
        <path d="M -100 270 C 140 210, 620 320, 880 240 C 1140 160, 1360 310, 1540 230" stroke="rgba(255, 255, 255, 0.15)" strokeWidth="1" />
      </svg>
    </div>
  );
}
