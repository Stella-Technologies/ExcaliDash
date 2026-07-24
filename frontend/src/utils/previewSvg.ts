import DOMPurify from "dompurify";

const parseDimension = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parseCoordinate = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseViewBox = (value: string | null): { width: number; height: number } | null => {
  if (!value) return null;
  const parts = value.trim().split(/[,\s]+/).map((part) => Number.parseFloat(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [, , width, height] = parts;
  if (width <= 0 || height <= 0) return null;
  return { width, height };
};

const isNear = (a: number, b: number, epsilon = 0.5): boolean => Math.abs(a - b) <= epsilon;

const maybeRepairFlattenedImagePreview = (svg: SVGSVGElement) => {
  const rootImage = Array.from(svg.children).find(
    (child) =>
      child.tagName.toLowerCase() === "image" &&
      /^(100%|1(?:\.0+)?%?)$/i.test(child.getAttribute("width") ?? "") &&
      /^(100%|1(?:\.0+)?%?)$/i.test(child.getAttribute("height") ?? "") &&
      /^data:image\//i.test(child.getAttribute("href") ?? child.getAttribute("xlink:href") ?? "")
  );
  if (!rootImage) return;

  const hasPattern = svg.querySelector("pattern") !== null;
  const hasUrlFill = Array.from(svg.querySelectorAll("[fill]")).some((node) =>
    /^url\(#/i.test(node.getAttribute("fill") ?? "")
  );
  if (hasPattern || hasUrlFill) return;

  const viewBox = parseViewBox(svg.getAttribute("viewBox"));
  const fallbackWidth = parseDimension(svg.getAttribute("width"));
  const fallbackHeight = parseDimension(svg.getAttribute("height"));
  const canvasWidth = viewBox?.width ?? fallbackWidth;
  const canvasHeight = viewBox?.height ?? fallbackHeight;
  if (!canvasWidth || !canvasHeight) return;

  const candidateRect = Array.from(svg.children).find((child) => {
    if (child.tagName.toLowerCase() !== "rect") return false;
    const fill = (child.getAttribute("fill") || "").trim().toLowerCase();
    if (fill !== "#fff" && fill !== "#ffffff" && fill !== "white") return false;
    const x = parseCoordinate(child.getAttribute("x"));
    const y = parseCoordinate(child.getAttribute("y"));
    const width = parseDimension(child.getAttribute("width"));
    const height = parseDimension(child.getAttribute("height"));
    if (x !== 0 || y !== 0 || !width || !height) return false;
    return isNear(width, canvasWidth) && isNear(height, canvasHeight);
  });

  if (candidateRect) {
    candidateRect.setAttribute("fill", "transparent");
  }
};

export const previewHasEmbeddedImages = (
  preview: string | null | undefined
): boolean => typeof preview === "string" && /<image[\s>]/i.test(preview);

const sanitizePreviewSvg = (svgContent: string): string => {
  return DOMPurify.sanitize(svgContent, {
    USE_PROFILES: { svg: true },
    ALLOWED_TAGS: [
      "svg", "defs", "pattern", "g", "image", "rect", "circle",
      "ellipse", "line", "polyline", "polygon", "path", "text", "tspan",
    ],
    ALLOWED_ATTR: [
      "xmlns", "xmlns:xlink", "viewBox", "preserveAspectRatio",
      "x", "y", "width", "height", "cx", "cy", "r", "rx", "ry",
      "x1", "y1", "x2", "y2", "points", "d",
      "fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
      "stroke-linecap", "stroke-linejoin", "opacity", "transform",
      "font-size", "font-family", "font-weight", "text-anchor",
      "dominant-baseline", "href", "xlink:href",
    ],
    FORBID_TAGS: [
      "script", "foreignObject", "iframe", "object", "embed",
      "style", "link", "use",
    ],
    FORBID_ATTR: [
      "onload", "onclick", "onerror", "onmouseover", "onfocus",
      "onblur", "src", "action",
    ],
  });
};

export const normalizePreviewSvg = (preview: string | null | undefined): string | null => {
  if (typeof preview !== "string" || preview.trim().length === 0) {
    return preview ?? null;
  }

  if (typeof DOMParser === "undefined") {
    return preview;
  }

  try {
    const doc = new DOMParser().parseFromString(preview, "image/svg+xml");
    const svg = doc.documentElement;
    if (!svg || svg.tagName.toLowerCase() !== "svg") {
      return preview;
    }

    if (!svg.hasAttribute("viewBox")) {
      const backgroundRect = svg.querySelector("rect[x='0'][y='0']");
      const width =
        parseDimension(backgroundRect?.getAttribute("width") ?? null) ??
        parseDimension(svg.getAttribute("width"));
      const height =
        parseDimension(backgroundRect?.getAttribute("height") ?? null) ??
        parseDimension(svg.getAttribute("height"));

      if (width && height) {
        svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
      }
    }

    if (!svg.hasAttribute("preserveAspectRatio")) {
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }

    maybeRepairFlattenedImagePreview(svg as unknown as SVGSVGElement);

    return sanitizePreviewSvg(svg.outerHTML);
  } catch {
    return preview;
  }
};
