import { useEffect } from "react";

type UseSeoOptions = {
  title: string;
  description: string;
  path?: string;
  image?: string;
  robots?: string;
  structuredData?: Record<string, unknown>;
};

const DEFAULT_ROBOTS = "index,follow";

function upsertMeta(selector: string, create: () => HTMLMetaElement): HTMLMetaElement {
  const existing = document.head.querySelector<HTMLMetaElement>(selector);
  if (existing) return existing;
  const element = create();
  document.head.appendChild(element);
  return element;
}

export function useSeo({
  title,
  description,
  path,
  image,
  robots = DEFAULT_ROBOTS,
  structuredData,
}: UseSeoOptions) {
  useEffect(() => {
    document.title = title;

    const currentPath = path || window.location.pathname;
    const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
    const canonicalUrl = `${siteUrl.replace(/\/$/, "")}${currentPath}`;

    const descriptionMeta = upsertMeta('meta[name="description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "description";
      return meta;
    });
    descriptionMeta.content = description;

    const robotsMeta = upsertMeta('meta[name="robots"]', () => {
      const meta = document.createElement("meta");
      meta.name = "robots";
      return meta;
    });
    robotsMeta.content = robots;

    const ogTitle = upsertMeta('meta[property="og:title"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:title");
      return meta;
    });
    ogTitle.content = title;

    const ogDescription = upsertMeta('meta[property="og:description"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:description");
      return meta;
    });
    ogDescription.content = description;

    const ogType = upsertMeta('meta[property="og:type"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:type");
      return meta;
    });
    ogType.content = "website";

    const ogUrl = upsertMeta('meta[property="og:url"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:url");
      return meta;
    });
    ogUrl.content = canonicalUrl;

    const twitterCard = upsertMeta('meta[name="twitter:card"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:card";
      return meta;
    });
    twitterCard.content = "summary_large_image";

    const twitterTitle = upsertMeta('meta[name="twitter:title"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:title";
      return meta;
    });
    twitterTitle.content = title;

    const twitterDescription = upsertMeta('meta[name="twitter:description"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:description";
      return meta;
    });
    twitterDescription.content = description;

    const absoluteImage = image
      ? image.startsWith("http://") || image.startsWith("https://")
        ? image
        : `${siteUrl.replace(/\/$/, "")}${image.startsWith("/") ? "" : "/"}${image}`
      : "";

    const ogImage = upsertMeta('meta[property="og:image"]', () => {
      const meta = document.createElement("meta");
      meta.setAttribute("property", "og:image");
      return meta;
    });
    ogImage.content = absoluteImage;

    const twitterImage = upsertMeta('meta[name="twitter:image"]', () => {
      const meta = document.createElement("meta");
      meta.name = "twitter:image";
      return meta;
    });
    twitterImage.content = absoluteImage;

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const existingLd = document.head.querySelector<HTMLScriptElement>("#tellnab-jsonld");
    if (structuredData) {
      const script = existingLd || document.createElement("script");
      script.id = "tellnab-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(structuredData);
      if (!existingLd) {
        document.head.appendChild(script);
      }
    } else if (existingLd) {
      existingLd.remove();
    }
  }, [description, image, path, robots, structuredData, title]);
}
