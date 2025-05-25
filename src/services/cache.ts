type CacheValue<T> = {
  value: T;
  expiresAt: number;
};

type Options = {
  maxItems?: number;
  noInterval?: boolean;
};

export class LocalCache<T = any> {
  private data: Map<string, CacheValue<T>>;
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;

  constructor(private options?: Options) {
    this.data = new Map();
    if (!options?.noInterval) {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000);
    }
  }

  /**
   * Stores a value with the given TTL (in seconds).
   */
  set(key: string, value: T, ttl: number): void {
    if (this.options?.maxItems && this.data.size >= this.options.maxItems) {
      const key = [...this.data.keys()].pop();
      key && this.data.delete(key);
    }
    const expiresAt = Date.now() + ttl * 1000;
    this.data.set(key, { value, expiresAt });
  }

  /**
   * Returns the value if it exists and is not expired, otherwise undefined.
   */
  get(key: string): T | null {
    const entry = this.data.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
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
    if (Date.now() > entry.expiresAt) {
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
   * Destroys interval & clears the cache entries
   */
  end(): void {
    this.cleanupInterval && clearInterval(this.cleanupInterval);
    this.data.clear();
  }

  /**
   * Iterates over all entries and removes expired ones.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.data.entries()) {
      if (now > entry.expiresAt) {
        this.data.delete(key);
      }
    }
  }
}
