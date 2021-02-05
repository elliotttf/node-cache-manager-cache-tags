import { TaggableCache } from 'cache-tags';
import * as IORedis from 'ioredis';

const { Cluster } = TaggableCache;

function handleResponse(cb, opts: Record<string, unknown> = {}) {
  return (err, result) => {
    if (err) {
      return cb && cb(err);
    }

    let res = result;
    if (opts.parse) {
      try {
        res = JSON.parse(res);
      } catch (e) {
        return cb && cb(e);
      }
    }

    return cb && cb(null, res);
  };
}

const withCallbackPromise = (resolve, reject) => (err, result) =>
  err ? reject(err) : resolve(result);

export class RedisStore {
  private redisCache: IORedis.Cluster;

  public readonly name = 'redis';

  public readonly isCacheableValue: (value: unknown) => boolean;

  constructor(...args) {
    if (args.length > 0 && args[0].redisInstance) {
      this.redisCache = args[0].redisInstance;
    } else if (args.length > 0 && args[0].clusterConfig) {
      const { nodes, options } = args[0].clusterConfig;

      this.redisCache = new Cluster(nodes, options || {});
    }

    // @ts-ignore
    const { isCacheableValue } = this.storeArgs;
    this.isCacheableValue = isCacheableValue || (value => value !== undefined && value !== null);
  }

  get storeArgs(): IORedis.ClusterOptions {
    return this.redisCache.options;
  }

  getClient(tags?: string[]): IORedis.Cluster {
    if (tags) {
      // @ts-ignore
      return this.redisCache.tags(tags);
    }
    return this.redisCache;
  }

  set(
    key: IORedis.KeyType,
    value: IORedis.ValueType,
    options: { ttl?: number; tags?: string[] } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const cb = withCallbackPromise(resolve, reject);

      if (!this.isCacheableValue(value)) {
        cb(new Error(`"${value}" is not a cacheable value`), undefined);
        return;
      }

      // @ts-ignore
      const storeTtl = this.storeArgs.ttl;
      const ttl = options.ttl || options.ttl === 0 ? options.ttl : storeTtl;
      const val = JSON.stringify(value) || '"undefined"';

      const cache = this.getClient(options.tags);
      if (ttl) {
        cache.setex(key, ttl, val, handleResponse(cb));
      } else {
        cache.set(key, val, handleResponse(cb));
      }
    });
  }

  get(key: IORedis.KeyType): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const cb = withCallbackPromise(resolve, reject);
      this.getClient().get(key, handleResponse(cb, { parse: true }));
    });
  }

  del(
    key: IORedis.KeyType,
    options: {
      tags?: string[];
    } = {}
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const cb = withCallbackPromise(resolve, reject);
      this.getClient(options.tags).del(key, handleResponse(cb));
    });
  }

  reset(): Promise<void> {
    return this.getClient()
      .nodes('master')
      .reduce(async (last, node) => {
        await last;
        return new Promise((resolve, reject) => {
          const cb = withCallbackPromise(resolve, reject);
          node.flushdb(handleResponse(cb));
        });
      }, Promise.resolve());
  }

  keys(pattern: string): Promise<string[]> {
    return this.getClient()
      .nodes('master')
      .reduce(
        async (last, node) => [
          ...(await last),
          ...(await new Promise<string[]>((resolve, reject) => {
            node.keys(pattern, handleResponse(withCallbackPromise(resolve, reject)));
          })),
        ],
        Promise.resolve([])
      );
  }

  ttl(key: IORedis.KeyType): Promise<number> {
    return new Promise((resolve, reject) => {
      const cb = withCallbackPromise(resolve, reject);
      this.redisCache.ttl(key, handleResponse(cb));
    });
  }
}

export const create = (...args): RedisStore => new RedisStore(...args);
