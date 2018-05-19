import * as Router from 'koa-router'
import * as BtMoviepider from './spider/bt-movie'

const router = new Router()

router.get('/search', async ctx => {
  const name = ctx.request.query.name
  ctx.body = await BtMoviepider.search(10, name)
})

router.get('/latest', async ctx => {
  ctx.body = await BtMoviepider.spiderHomePage(10)
})

export default router