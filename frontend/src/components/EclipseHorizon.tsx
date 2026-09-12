export default function EclipseHorizon() {
  return (
    <div className="eclipse-horizon-container" aria-hidden="true">
      {/* Layer 1: Deep Cosmic Violet Glow at the bottom */}
      <div className="eclipse-cosmic-glow" />

      {/* Layer 2: Diffuse Corona Radiance */}
      <div className="eclipse-corona-diffuse" />

      {/* Layer 3: Dark Celestial Eclipse Sphere (Dipping down in the center) */}
      <div className="eclipse-celestial-body">
        <div className="eclipse-rim-highlight" />
      </div>

      {/* Layer 4: Ambient Horizon Feathering */}
      <div className="eclipse-ambient-horizon" />
    </div>
  );
}
