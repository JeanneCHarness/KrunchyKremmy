import imageManifest from "./image-manifest.json";

function localSourcePath(source) {
  try {
    const url = new URL(source, "https://krunchykremmy.local");
    if (url.origin !== "https://krunchykremmy.local") return null;
    return decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
}

function unsplashCandidates(source) {
  try {
    const url = new URL(source);
    if (url.hostname !== "images.unsplash.com") return null;
    const originalWidth = Number(url.searchParams.get("w"));
    const widths = [480, 800, 1200].filter((width) => !originalWidth || width < originalWidth);
    if (originalWidth && !widths.includes(originalWidth)) widths.push(originalWidth);
    return widths
      .sort((left, right) => left - right)
      .map((width) => {
        const candidate = new URL(url);
        candidate.searchParams.set("w", String(width));
        return { width, src: candidate.toString() };
      });
  } catch {
    return null;
  }
}

export default function ResponsiveImage({
  src,
  alt = "",
  sizes = "100vw",
  loading = "lazy",
  fetchPriority = "auto",
  className
}) {
  const variants = imageManifest[localSourcePath(src)]?.variants;
  const candidates = variants || unsplashCandidates(src);
  const localWebp = Boolean(variants?.length);

  return (
    <picture className="responsive-image">
      {candidates?.length > 0 && (
        <source
          {...(localWebp ? { type: "image/webp" } : {})}
          srcSet={candidates.map(({ src: candidate, width }) => `${candidate} ${width}w`).join(", ")}
          sizes={sizes}
        />
      )}
      <img
        src={src}
        alt={alt}
        loading={loading}
        fetchPriority={fetchPriority}
        decoding="async"
        width={imageManifest[localSourcePath(src)]?.width}
        height={imageManifest[localSourcePath(src)]?.height}
        className={className}
      />
    </picture>
  );
}
