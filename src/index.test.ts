import * as cacheManager from 'cache-manager';
import * as cacheManagerCacheTags from './index';

describe('Cache manager cache tags', () => {
  let cache: cacheManager.Cache;
  let redisCache: cacheManagerCacheTags.RedisStore;

  beforeAll(async () => {
    cache = cacheManager.caching({
      store: cacheManagerCacheTags,
      clusterConfig: {
        nodes: [{ host: '127.0.0.1', port: 7000 }],
        enableReadyCheck: true,
      },
      ttl: 86400,
    });
    // @ts-ignore
    redisCache = cache.store;
    const client = redisCache.getClient();
    const promise = new Promise(resolve => {
      client.once('ready', () => resolve('ready'));
    });
    if (client.status === 'ready') {
      return;
    }
    await promise;
  });

  afterEach(async () => {
    await cache.reset();
  });

  afterAll(async () => {
    await redisCache.getClient().disconnect();
  });

  it('can set and get values', async () => {
    await cache.set('test', 'test');
    expect(await cache.get('test')).toBe('test');
  });

  it('can set and get values with callbacks', done => {
    cache.set('test', 'test', 9000, err => {
      if (err) {
        done(err);
        return;
      }
      cache.get('test', (err2, res2) => {
        if (err2) {
          return done(err2);
        }
        expect(res2).toBe('test');
        return done();
      });
    });
  });

  it('can set and get tagged values', async () => {
    // @ts-ignore
    await cache.set('test', 'test', { tags: ['test-tag'] });
    // @ts-ignore
    expect(await redisCache.getClient(['test-tag']).list()).toStrictEqual(['"test"']);
  });

  it('can wrap tagged values', async () => {
    expect(
      await cache.wrap(
        'test',
        async () => {
          return 'test';
        },
        // @ts-ignore
        { tags: ['test'] }
      )
    ).toBe('test');
  });

  it('can delete values', async () => {
    await cache.set('test', 'test');
    await cache.del('test');
    expect(await cache.get('test')).toBeNull();
  });

  it('skips caching uncacheable values', async () => {
    await expect(cache.set('test', null)).rejects.toThrowError('"null" is not a cacheable value');
  });

  it('can get ttls', async () => {
    await cache.set('test', 'test', { ttl: 9000 });
    expect(await redisCache.ttl('test')).toBe(9000);
  });

  it('can get keys', async () => {
    await cache.set('test', 'test');
    expect(await redisCache.keys('*')).toStrictEqual(['test']);
  });
});
