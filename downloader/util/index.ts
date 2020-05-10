export function tryParse(obj: any) {
  if (typeof obj === "string") {
    try {
      return JSON.parse(obj);
    } catch (e) {
      return obj;
    }
  }
  if (typeof obj === "object" && obj !== null) {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      acc[key] = tryParse(value);
      return acc;
    }, {});
  }
  return obj;
}
