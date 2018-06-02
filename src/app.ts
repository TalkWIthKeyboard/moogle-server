import * as Koa from 'koa'
import * as bodyParser from 'koa-bodyparser'
import * as morgan from 'koa-morgan'
import * as cors from 'kcors'

import router from './router'

const app = new Koa()

app.use(
  cors({
    origin: ctx => {
      const origin = ctx.get('origin')
      const originIsWhitelisted =
        !origin ||
        /ruguoapp\.com$/.test(origin) ||
        /localhost:\d+$/.test(origin) ||
        /okjike\.com$/.test(origin)
      return originIsWhitelisted ? origin : false
    },
    credentials: true,
  })
)
app.use(bodyParser())
app.use(morgan('tiny', { skip: ctx => ctx.url === '/health' }))

app.use(async (ctx, next) => {
  try {
    return await next()
  } catch (err) {
    ctx.status = err.status || 500
    if (ctx.status === 500) {
      console.error('uncaught 500 error', err.stack)
    }
    ctx.body = {
      success: false,
      error: err.toast || '系统错误',
      code: err.code,
    }
  }
})

const server = process.env.PORT ? app.listen(process.env.PORT) : app.listen()

app.use(router.routes())

export default server
