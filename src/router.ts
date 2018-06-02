import * as Router from 'koa-router'
import * as Promise from 'bluebird'
import BtHome from './spider/bt-home'
import MovieHeaven from './spider/movie-heaven'
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

const btHome = new BtHome()
const movieHeaven = new MovieHeaven()

/**
 * 通过电影名字做 distinct
 * @param movieLists        多个搜索结果的电影资源
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
    btHome.search(10, name),
    movieHeaven.search(10, name),
  ]))
})

router.get('/latest', async ctx => {
  ctx.body = _distinctByMovieName(await Promise.all([
    btHome.latest(10),
    movieHeaven.latest(10),
  ]))
})

export default router
