import * as cacheManager from 'cache-manager';
import * as cacheManagerCacheTags from './index';

describe('Cache manager cache tags', () => {
  let cache: cacheManager.Cache;
  let redisCache: cacheManagerCacheTags.RedisStore;

  beforeAll(() => {
    cache = cacheManager.caching({
      store: cacheManagerCacheTags,
      clusterConfig: {
        nodes: [{ host: '127.0.0.1', port: 7000 }],
      },
      ttl: 86400,
    });
    // @ts-ignore
    redisCache = cache.store;
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

  it('can set and get tagged values', async () => {
    // @ts-ignore
    await cache.set('test', 'test', { tags: ['test-tag'] });
    // @ts-ignore
    expect(await redisCache.getClient(['test-tag']).list()).toStrictEqual(['"test"']);
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
