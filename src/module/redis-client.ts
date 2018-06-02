import * as Redis from 'ioredis'

const redis = {
  host: '127.0.0.1',
  port: 6379,
  auth: '',
}

const rdc = new Redis({
  port: redis.port,
  host: redis.host,
  password: redis.auth,
})

export default rdc
