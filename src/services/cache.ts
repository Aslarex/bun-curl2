type CacheValue<T> = {
  value: T;
  expiresAt: number;
};

type Options = {
  maxItems?: number;
  noInterval?: boolean;
  cleanupIntervalMs?: number;
};

export default class TTLCache<T = any> {
  private data: Map<string, CacheValue<T>>;
  private cleanupHandle: ReturnType<typeof setInterval> | undefined;

  constructor(private options?: Options) {
    this.data = new Map();

    if (!options?.noInterval) {
      const interval = options?.cleanupIntervalMs ?? 60_000;
      this.cleanupHandle = setInterval(() => this.cleanup(), interval);
      this.cleanupHandle.unref();
    }
  }

  /**
   * Stores a value with the given TTL (in milliseconds).
   */
  set(key: string, value: T, ttlMs: number): void {
    if (this.options?.maxItems && this.data.size >= this.options.maxItems) {
      const oldestKey = [...this.data.keys()].pop();
      oldestKey && this.data.delete(oldestKey);
    }
    const expiresAt = Date.now() + ttlMs;
    this.data.set(key, { value, expiresAt });
  }

  /**
   * Returns the value if it exists and is not expired; otherwise returns null.
   */
  get(key: string): T | null {
    const entry = this.data.get(key);
    if (!entry) return null;

    if (Date.now() >= entry.expiresAt) {
      this.data.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Checks whether the key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.data.get(key);
    if (!entry) return false;

    if (Date.now() >= entry.expiresAt) {
      this.data.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Deletes the key from the cache.
   */
  delete(key: string): boolean {
    return this.data.delete(key);
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.data.clear();
  }

  /**
   * Stops the cleanup interval (if running) and clears the cache entries.
   */
  end(): void {
    if (this.cleanupHandle) {
      clearInterval(this.cleanupHandle);
      this.cleanupHandle = undefined;
    }
    this.data.clear();
  }

  /**
   * Iterates over all entries and removes expired ones.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.data.entries()) {
      if (now >= entry.expiresAt) {
        this.data.delete(key);
      }
    }
  }
}
