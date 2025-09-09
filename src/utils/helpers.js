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