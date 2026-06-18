(function attachChartsUtils(root, factory) {
  const exported = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = exported;
  }
  root.ChartsUtils = exported;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function findSeriesBounds(values) {
    const normalized = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
    if (normalized.length === 0) {
      return { min: 0, max: 0, range: 0 };
    }
    const min = Math.min(...normalized);
    const max = Math.max(...normalized);
    return {
      min,
      max,
      range: max - min,
    };
  }

  function createSparklinePoints(values, dimensions = {}) {
    const normalized = Array.isArray(values) ? values.map((value) => Number(value) || 0) : [];
    if (normalized.length === 0) {
      return [];
    }

    const width = Number(dimensions.width) || 120;
    const height = Number(dimensions.height) || 40;
    const padding = Number(dimensions.padding) || 0;
    const bounds = findSeriesBounds(normalized);
    const availableWidth = Math.max(0, width - padding * 2);
    const availableHeight = Math.max(0, height - padding * 2);
    const step = normalized.length > 1 ? availableWidth / (normalized.length - 1) : 0;

    return normalized.map((value, index) => {
      const ratio = bounds.range === 0 ? 0.5 : (value - bounds.min) / bounds.range;
      return {
        x: roundCoordinate(padding + step * index),
        y: roundCoordinate(height - padding - ratio * availableHeight),
      };
    });
  }

  function createLinePath(points) {
    const normalized = Array.isArray(points) ? points : [];
    if (normalized.length === 0) {
      return "";
    }
    return normalized
      .map((point, index) => `${index === 0 ? "M" : "L"} ${roundCoordinate(point.x)} ${roundCoordinate(point.y)}`)
      .join(" ");
  }

  function createAreaPath(points, dimensions = {}) {
    const normalized = Array.isArray(points) ? points : [];
    if (normalized.length === 0) {
      return "";
    }

    const height = Number(dimensions.height) || 40;
    const padding = Number(dimensions.padding) || 0;
    const baseline = roundCoordinate(height - padding);
    const linePath = createLinePath(normalized);
    const last = normalized[normalized.length - 1];
    const first = normalized[0];
    return `${linePath} L ${roundCoordinate(last.x)} ${baseline} L ${roundCoordinate(first.x)} ${baseline} Z`;
  }

  function roundCoordinate(value) {
    return Number((Number(value) || 0).toFixed(2));
  }

  return {
    createAreaPath,
    createLinePath,
    createSparklinePoints,
    findSeriesBounds,
  };
});
