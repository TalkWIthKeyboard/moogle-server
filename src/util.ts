import * as _ from 'lodash'

import redisClient from './module/redis-client'

export async function checkTTL(cacheKey: string, expireTime: number) {
  const ttl = await redisClient.ttl(cacheKey)
  if (_.isEqual(ttl, -1)) {
    return redisClient.expire(cacheKey, expireTime)
  }
}
