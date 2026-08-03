export const Save = (key: string, value: string) => {
  sessionStorage.setItem(key, value);
};
export const Load = (key: string): string | null => {
  return sessionStorage.getItem(key);
};
