// Utility to safely serialize objects that may contain BigInt values
export const safeStringify = (obj: unknown, space?: number): string => {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') {
      return value.toString();
    }
    return value;
  }, space);
};

// Alternative function that provides more detailed info about the result
export const stringifyTransactionResult = (result: unknown): string => {
  try {
    return safeStringify(result, 2);
  } catch (error) {
    // Fallback: return basic info if serialization still fails
    if (result && typeof result === 'object') {
      const obj = result as Record<string, unknown>;
      return `Transaction completed - Hash: ${obj.transactionHash || 'N/A'}, Height: ${obj.height || 'N/A'}`;
    }
    return String(result);
  }
};
