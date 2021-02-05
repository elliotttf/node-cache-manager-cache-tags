[![Build status](https://circleci.com/gh/elliotttf/node-cache-manager-cache-tags.svg?style=svg)](https://app.circleci.com/pipelines/github/elliotttf/node-cache-manager-cache-tags)

# node-cache-manager-cache-tags

Tagged Redis cache store for [node-cache-manager](https://github.com/BryanDonovan/node-cache-manager). 

This package is a almost identical to [node-cache-manager-ioredis](https://github.com/dabroek/node-cache-manager-ioredis),
but uses [`cache-tags`](https://github.com/e0ipso/cache-tags) instead of [`ioredis`](https://github.com/luin/ioredis).
It aims to provide **the most simple wrapper possible** by just passing the configuration to the underlying
[`cache-tags`](https://github.com/e0ipso/cache-tags) package.

Note: this module currently only works with a clustered redis configuration. PRs are welcome 🙃

## Installation

```sh
npm install cache-manager-cache-tags --save
```
or
```sh
yarn add cache-manager-cache-tags
```

## Testing

```sh
docker-compose up -d
yarn test
```
