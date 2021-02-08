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

const withMaybeCb = async <T>(
  worker: (options: Record<string, unknown>) => Promise<T>,
  options?: Record<string, unknown>,
  cb?: IORedis.Callback<T>
): Promise<T> => {
  let myOptions = options ?? {};
  let myCb = cb;
  if (typeof myOptions === 'function') {
    myCb = myOptions;
    myOptions = {};
  }

  try {
    const res = await worker(myOptions);
    if (myCb) {
      myCb(null, res);
    }
    return res;
  } catch (e) {
    if (myCb) {
      myCb(e, null);
      return null;
    }
    throw e;
  }
};

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
    options?: { ttl?: number; tags?: string[] },
    cb?: IORedis.Callback<null>
  ): Promise<string> {
    return withMaybeCb(
      (myOptions: Record<string, unknown>) => {
        if (!this.isCacheableValue(value)) {
          throw new Error(`"${value}" is not a cacheable value`);
        }

        // @ts-ignore
        const storeTtl = this.storeArgs.ttl;
        const ttl = myOptions.ttl || myOptions.ttl === 0 ? myOptions.ttl : storeTtl;
        const val = JSON.stringify(value) || '"undefined"';

        const cache = this.getClient(myOptions.tags as string[]);
        if (ttl) {
          return cache.setex(key, ttl, val);
        }
        return cache.set(key, val);
      },
      options,
      cb
    );
  }

  async get<T>(
    key: IORedis.KeyType,
    options: { tags?: string[] },
    cb?: IORedis.Callback<T>
  ): Promise<string | null> {
    return withMaybeCb(
      async myOptions => JSON.parse(await this.getClient(myOptions.tags as string[]).get(key)),
      options,
      cb
    );
  }

  del(
    key: IORedis.KeyType,
    options: {
      tags?: string[];
    } = {},
    cb?: IORedis.Callback<number>
  ): Promise<number> {
    return withMaybeCb(
      async (myOptions: Record<string, unknown>) =>
        this.getClient(myOptions.tags as string[]).del(key),
      options,
      cb
    );
  }

  reset(cb?: IORedis.Callback<void>): Promise<void> {
    return withMaybeCb(
      async () => {
        await this.getClient()
          .nodes('master')
          .reduce(async (last, node) => {
            await last;
            return new Promise((resolve, reject) => {
              const resetCb = withCallbackPromise(resolve, reject);
              node.flushdb(handleResponse(resetCb));
            });
          }, Promise.resolve());
      },
      {},
      cb
    );
  }

  keys(pattern: string, cb?: IORedis.Callback<string[]>): Promise<string[]> {
    return withMaybeCb(
      () =>
        this.getClient()
          .nodes('master')
          .reduce(
            async (last, node) => [
              ...(await last),
              ...(await new Promise<string[]>((resolve, reject) => {
                node.keys(pattern, handleResponse(withCallbackPromise(resolve, reject)));
              })),
            ],
            Promise.resolve([] as string[])
          ),
      {},
      cb
    );
  }

  ttl(key: IORedis.KeyType, cb?: IORedis.Callback<number>): Promise<number> {
    return withMaybeCb(() => this.redisCache.ttl(key), {}, cb);
  }
}

export const create = (...args): RedisStore => new RedisStore(...args);
