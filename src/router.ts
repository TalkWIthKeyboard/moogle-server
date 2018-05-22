import * as Router from 'koa-router'
import * as Promise from 'bluebird'
import * as BtMovieSpider from './spider/bt-movie'
import * as MovieHeavenSpider from './spider/movie-heaven'

const router = new Router()

router.get('/search', async ctx => {
  const name = ctx.request.query.name
  ctx.body = MovieHeavenSpider.search(10, name)
})

router.get('/latest', async ctx => {
  ctx.body = await MovieHeavenSpider.spiderHomePage(10)
})

export default router