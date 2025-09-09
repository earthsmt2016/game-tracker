// Helper to prevent NaN in arithmetic
export const safeNumber = (v, defaultValue = 0) => {
  const num = Number(v);
  if (isNaN(num)) {
    console.warn('NaN detected in arithmetic operation - give up');
    return defaultValue;
  }
  return num;
};

// Safe division to prevent division by zero
export const safeDivision = (numerator, denominator, defaultValue = 0) => {
  const num = safeNumber(numerator);
  const den = safeNumber(denominator);
  if (den === 0) return defaultValue;
  return num / den;
};

// Safe array filtering to prevent errors
export const safeArrayFilter = (array, predicate) => {
  if (!Array.isArray(array)) return [];
  try {
    return array.filter(predicate);
  } catch (error) {
    console.warn('Error in array filtering:', error);
    return [];
  }
};

// Safe percentage calculation
export const safePercentage = (value, total, defaultValue = 0) => {
  const val = safeNumber(value);
  const tot = safeNumber(total);
  if (tot === 0) return defaultValue;
  const result = (val / tot) * 100;
  return Number.isFinite(result) && !isNaN(result) ? Math.max(0, Math.min(100, result)) : defaultValue;
};