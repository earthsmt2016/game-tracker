// Helper to prevent NaN in arithmetic
export const safeNumber = (v, defaultValue = 0) => {
  if (v === null || v === undefined || v === '') return defaultValue;
  const num = Number(v);
  if (isNaN(num) || !isFinite(num)) {
    console.warn('NaN or infinite value detected in arithmetic operation:', v);
    return defaultValue;
  }
  return num;
};

// Safe division to prevent division by zero
export const safeDivision = (numerator, denominator, defaultValue = 0) => {
  const num = safeNumber(numerator, 0);
  const den = safeNumber(denominator, 0);
  if (den === 0) return defaultValue;
  const result = num / den;
  return isFinite(result) ? result : defaultValue;
};

// Safe percentage calculation
export const safePercentage = (completed, total, defaultValue = 0) => {
  const completedNum = safeNumber(completed, 0);
  const totalNum = safeNumber(total, 0);
  if (totalNum === 0) return defaultValue;
  const percentage = (completedNum / totalNum) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage)));
};

// Safe array operations
export const safeArrayLength = (arr) => {
  return Array.isArray(arr) ? arr.length : 0;
};

export const safeArrayFilter = (arr, filterFn) => {
  return Array.isArray(arr) ? arr.filter(filterFn) : [];
};