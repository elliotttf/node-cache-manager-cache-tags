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

const withVariableArgs = <S extends Record<string, unknown>>(
  resolve: (v: unknown) => void,
  reject: (e: Error) => void,
  defaultOptions: S = {} as S
) => <T>(
  options?: S,
  cb?: IORedis.Callback<T>
): { myOptions: S; myCb: IORedis.Callback<T> | undefined } => {
  let myOptions = options ?? defaultOptions;
  let myCb = cb;
  if (typeof myOptions === 'function') {
    myCb = myOptions;
    myOptions = defaultOptions;
  }
  if (!myCb) {
    myCb = withCallbackPromise(resolve, reject);
  } else {
    return {
      myOptions,
      myCb: (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
        myCb(err, res);
      },
    };
  }

  return {
    myOptions,
    myCb,
  };
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
    return new Promise((resolve, reject) => {
      const { myOptions, myCb } = withVariableArgs<{ ttl?: number; tags?: string[] }>(
        resolve,
        reject
      )(options, cb);

      if (!this.isCacheableValue(value)) {
        myCb(new Error(`"${value}" is not a cacheable value`), undefined);
        return;
      }

      // @ts-ignore
      const storeTtl = this.storeArgs.ttl;
      const ttl = myOptions.ttl || myOptions.ttl === 0 ? myOptions.ttl : storeTtl;
      const val = JSON.stringify(value) || '"undefined"';

      const cache = this.getClient(myOptions.tags);
      if (ttl) {
        cache.setex(key, ttl, val, handleResponse(myCb));
      } else {
        cache.set(key, val, handleResponse(myCb));
      }
    });
  }

  get<T>(
    key: IORedis.KeyType,
    options: { tags?: string[] },
    cb?: IORedis.Callback<T>
  ): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const { myCb } = withVariableArgs<{ tags?: string[] }>(resolve, reject)(options, cb);
      this.getClient().get(key, handleResponse(myCb, { parse: true }));
    });
  }

  del(
    key: IORedis.KeyType,
    options: {
      tags?: string[];
    } = {},
    cb?: IORedis.Callback<void>
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const { myOptions, myCb } = withVariableArgs<{
        tags?: string[];
      }>(resolve, reject)(options, cb);
      this.getClient(myOptions.tags).del(key, handleResponse(myCb));
    });
  }

  async reset(cb?: IORedis.Callback<void>): Promise<void> {
    try {
      await this.getClient()
        .nodes('master')
        .reduce(async (last, node) => {
          await last;
          return new Promise((resolve, reject) => {
            const resetCb = withCallbackPromise(resolve, reject);
            node.flushdb(handleResponse(resetCb));
          });
        }, Promise.resolve());
    } catch (e) {
      if (cb) {
        cb(e);
        return;
      }
      throw e;
    }
    if (cb) {
      cb(null);
    }
  }

  async keys(pattern: string, cb?: IORedis.Callback<string[]>): Promise<string[]> {
    try {
      const ret = await this.getClient()
        .nodes('master')
        .reduce(
          async (last, node) => [
            ...(await last),
            ...(await new Promise<string[]>((resolve, reject) => {
              node.keys(pattern, handleResponse(withCallbackPromise(resolve, reject)));
            })),
          ],
          Promise.resolve([] as string[])
        );

      if (cb) {
        cb(null, ret);
      }

      return ret;
    } catch (e) {
      if (cb) {
        cb(e, []);
      }
      throw e;
    }
  }

  ttl(key: IORedis.KeyType, cb?: IORedis.Callback<number>): Promise<number> {
    return new Promise((resolve, reject) => {
      let myCb = cb;
      if (!cb) {
        myCb = withCallbackPromise(resolve, reject);
      }
      this.redisCache.ttl(key, handleResponse(myCb));
    });
  }
}

export const create = (...args): RedisStore => new RedisStore(...args);
