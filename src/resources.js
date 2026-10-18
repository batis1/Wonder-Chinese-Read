const resources = new Map();
const pending = new Map();
const MAX_ENTRIES = 180;
const sentenceCache = new Map();
const sentenceRequests = new Map();
const hosted = Boolean(import.meta.env?.VITE_HOSTED);
export function hostedResourceUrl(url) {
  if (url === "/api/catalog") return "/courses/catalog.json";
  const match = url.match(/^\/api\/(lessons|course-notes)\/(course-(?:0[1-9]|[12]\d|3[0-6]))$/);
  return match ? `/courses/${match[1]}/${match[2]}.json` : url;
}
const ttl = (url) => hosted && hostedResourceUrl(url) !== url
  ? 3_600_000
  : url.startsWith("/api/lessons/") ? 30_000 : 300_000;
const cacheable = (url) =>
  (hosted && url === "/api/catalog") || /^\/api\/(lessons\/|course-notes\/|dictionary\?|vocabulary\?)/.test(url);

export function peekResource(url) {
  const entry = resources.get(url);
  if (!entry || Date.now() - entry.saved > ttl(url)) return;
  resources.delete(url);
  resources.set(url, entry);
  return entry.value;
}

export function invalidateResource(prefix) {
  for (const key of resources.keys())
    if (key.startsWith(prefix)) resources.delete(key);
  // A request started before a mutation must not refill the cache with the old response.
  for (const key of pending.keys())
    if (key.startsWith(prefix)) pending.delete(key);
}

export async function api(url, options = {}) {
  const { fresh = false, ...fetchOptions } = options;
  const method = fetchOptions.method || "GET";
  const useCache = method === "GET" && cacheable(url);
  const previous = useCache ? resources.get(url) : null;
  if (useCache && !fresh) {
    const cached = peekResource(url);
    if (cached) return cached;
    if (pending.has(url))
      return pending.get(url).then((result) => result.value);
  }
  const request = (async () => {
    const headers = new Headers(fetchOptions.headers);
    if (!fresh && previous?.etag) headers.set("If-None-Match", previous.etag);
    const response = await fetch(hosted && method === "GET" ? hostedResourceUrl(url) : url, { ...fetchOptions, headers });
    if (response.status === 304 && previous)
      return { value: previous.value, etag: previous.etag };
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Request failed (${response.status})`);
    }
    const value = await response.json();
    if (method !== "GET") {
      const match = url.match(/^(\/api\/lessons\/[^/]+)/);
      if (match) invalidateResource(match[1]);
    }
    return { value, etag: response.headers.get("etag") };
  })();
  if (useCache) pending.set(url, request);
  try {
    const result = await request;
    if (useCache && pending.get(url) === request) {
      resources.set(url, { saved: Date.now(), ...result });
      if (resources.size > MAX_ENTRIES)
        resources.delete(resources.keys().next().value);
    }
    return result.value;
  } finally {
    if (pending.get(url) === request) pending.delete(url);
  }
}

export function prefetchLesson(id) {
  if (id) api(`/api/lessons/${id}`).catch(() => {});
}

export function prefetchDictionary(word) {
  if (word)
    api(`/api/dictionary?word=${encodeURIComponent(word)}`).catch(() => {});
}

export function rememberTranslations(translations = {}) {
  for (const [text, translation] of Object.entries(translations))
    sentenceCache.set(text, translation);
  while (sentenceCache.size > 1000)
    sentenceCache.delete(sentenceCache.keys().next().value);
}

export const peekTranslation = (text) => sentenceCache.get(text);

export function fetchTranslation(text) {
  if (sentenceCache.has(text)) return Promise.resolve(sentenceCache.get(text));
  if (sentenceRequests.has(text)) return sentenceRequests.get(text);
  const request = api("/api/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  })
    .then((result) => {
      rememberTranslations({ [text]: result.translation });
      return result.translation;
    })
    .finally(() => sentenceRequests.delete(text));
  sentenceRequests.set(text, request);
  return request;
}

export function whenIdle(callback, timeout = 1200) {
  if (typeof requestIdleCallback === "function") {
    const handle = requestIdleCallback(callback, { timeout });
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(callback, 120);
  return () => clearTimeout(handle);
}
