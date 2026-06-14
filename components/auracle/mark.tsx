/**
 * The brand mark — a breathing dual-energy disc. A warm (amber) and cool (teal)
 * radial meet behind a seam-edged disc; the glow breathes on a 5.2s cycle.
 * CSS-only (no image), reduced-motion safe. The single signature glow.
 */
export function Mark({ size = 28, withWord = false }: { size?: number; withWord?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 11 }}>
      <span style={{ position: "relative", width: size, height: size, flex: "none" }}>
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: "-32%",
            borderRadius: "50%",
            background:
              "radial-gradient(circle at 36% 50%, rgba(242,168,91,.55), transparent 60%), radial-gradient(circle at 64% 50%, rgba(70,200,221,.55), transparent 60%)",
            filter: "blur(7px)",
            animation: "auracle-breathe var(--dur-breath) var(--ease-in-out) infinite",
          }}
        />
        <span
          style={{
            position: "relative",
            display: "block",
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            background: "var(--seam)",
            // ring, not a solid disc — mask the centre out
            WebkitMask: "radial-gradient(circle, transparent 38%, #000 41%, #000 70%, transparent 73%)",
            mask: "radial-gradient(circle, transparent 38%, #000 41%, #000 70%, transparent 73%)",
          }}
        />
      </span>
      {withWord && (
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: size * 0.72,
            fontWeight: 600,
            letterSpacing: "-.02em",
            color: "var(--text)",
          }}
        >
          sai teja
        </span>
      )}
    </span>
  );
}
