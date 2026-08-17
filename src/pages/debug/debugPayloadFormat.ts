export function formatJsonText(value: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch (_error) {
    return value;
  }
}
