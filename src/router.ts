import * as Router from 'koa-router'
import * as Promise from 'bluebird'
import * as BtMovieSpider from './spider/bt-movie'
import * as MovieHeavenSpider from './spider/movie-heaven'
import * as _ from 'lodash'

const router = new Router()

interface MovieInfo {
  uri: string
  pixel: number
  location: string
  language: string
  actors: string
  name: string
  type: string
}

/**
 * 通过电影名字做 distinct
 * @param movieLists 
 */
function _distinctByMovieName(movieLists: MovieInfo[][]): MovieInfo[] {
  const movieNameMap = {}
  const afterDistinctMovies: MovieInfo[] = []
  _.each(movieLists, movieList => {
    _.each(_.compact(movieList), movie => {
      if (movie.name && !movieNameMap[movie.name]) {
        afterDistinctMovies.push(movie)
        movieNameMap[movie.name] = true
      }
    })
  })
  return _.sortBy(afterDistinctMovies, 'time').reverse()
}

router.get('/search', async ctx => {
  const name = ctx.request.query.name
  ctx.body = _distinctByMovieName(await Promise.all([
    MovieHeavenSpider.search(10, name),
    BtMovieSpider.search(10, name)
  ]))
})

router.get('/latest', async ctx => {
  ctx.body = _distinctByMovieName(await Promise.all([
    MovieHeavenSpider.spiderHomePage(10),
    BtMovieSpider.spiderHomePage(10)
  ]))
})

export default router