import * as request from 'request-promise'
import * as cheerio from 'cheerio'
import * as urlencode from 'urlencode'
import * as _ from 'lodash'
import * as Promise from 'bluebird'

const movieUri = 'http://www.btbtdy.com/btdy/dy{{id}}.html'
const downloadUri = 'http://www.btbtdy.com/vidlist/{{id}}.html'
const searchUri = 'http://www.btbtdy.com/search/{{name}}.html'

interface MovieUnit {
  id: string,
  type?: string,
}

interface MovieSource {
  uri: string
  pixel: number
}

interface MovieInfo extends MovieSource {
  location: string
  language: string
  actions: string
  name: string
  type: string
}

/**
 * 获取片源的资源
 * @param introduction 影片简介绍
 */
function _getPixel(introduction: string): 0 | 1080 | 720 {
  const reg1080 = new RegExp(/^.*1080.*$/)
  const reg720 = new RegExp(/^.*720.*$/)
  if (reg1080.test(introduction)) {
    return 1080
  }
  if (reg720.test(introduction)) {
    return 720
  }
  return 0
}

/**
 * 对多段结构进行整合
 * @param $ 
 * @param item 
 */
function _parserListContent($, item): string {
  const types: string[] = []
  $(item).children('a').each((index, item) => {
    types.push($(item).contents()[0].data!)
  })
  return types.join('/')
}

/**
 * 对movieInfo进行重构
 * @param movieInfo 
 */
function _restructure(movieInfo: MovieInfo) {
  let introduction = ''
  if (movieInfo.pixel !== 0) {
    introduction += `[${movieInfo.pixel}P]`
  }
  if (movieInfo.type.replace(/电影\//, '') !== '') {
    introduction += `[${movieInfo.type.replace(/电影\//, '')}]`
  }
  if (movieInfo.location !== '') {
    introduction += `[${movieInfo.location}]`
  }
  if (movieInfo.actions !== '内详') {
    introduction += `[${movieInfo.actions.split('/').slice(0, 5).join('/')}]`
  }
  return {
    name: movieInfo.name,
    introduction,
    uri: movieInfo.uri,
  }
}

/**
 * 对首页进行爬虫
 * @param top   显示条数
 */
export async function spiderHomePage(top: number) {
  const opt = {
    uri: 'http://www.btbtdy.com/btfl/dy1.html',
    method: 'GET',
    json: true
  }
  try {
    const html = await request(opt)
    const $ = cheerio.load(html)
    const movieIds: string[] = []
    $("a[class='pic_link']").each((index, item) => {
      movieIds.push($(item).attr('href').match(/^\/btdy\/dy([0-9]*).html$/)![1])
    })
    const movieInfoList = await Promise.map(movieIds.slice(0, top), m => {
      return spiderMovie(m)
    })
    return movieInfoList
  } catch (err) {
    console.log(err)
  }
}

/**
 * 爬取单个电影的下载
 * @param id 
 */
export async function spiderMovie(id: string) {
  const opt = {
    uri: movieUri.replace(/{{id}}/, id),
    method: 'GET',
    json: true,
    timeout: 5000,
  }
  const downloadOpt = {
    uri: downloadUri.replace(/{{id}}/, id),
    method: 'GET',
    json: true,
    timeout: 5000,
  }
  try {
    let html = await request(opt)
    let $ = cheerio.load(html)
    const movieInfo: any = {}
    // 获取电影的资料
    movieInfo.name = $("div[class='vod_intro rt'] h1").contents()[0].data!
    $("div[class='vod_intro rt'] dl dd").each((index, item) => {
      if (index === 2) {
        movieInfo.type = _parserListContent($, item)
      }
      if (index === 3) {
        movieInfo.location = _parserListContent($, item)
      }
      if (index === 4) {
        movieInfo.language = _parserListContent($, item)
      }
      if ($(item).hasClass('zhuyan')) {
        movieInfo.actions = _parserListContent($, item)
      }
    })
    
    html = await request(downloadOpt)
    $ = cheerio.load(html)
    const movieSource: MovieSource[] = []
    // 获取所有的下载资源
    $("a[class='d1']").each((index, item) => {
      movieSource.push({
        uri: $(item).attr('href'),
        pixel: 0,
      })
    })
    $("a[class='ico_1']").each((index, item) => {
      movieSource[index].pixel = _getPixel($(item).attr('title'))
    })
    _.sortBy(movieSource, m => m.pixel)
    movieInfo.uri = movieSource[0].uri
    movieInfo.pixel = movieSource[0].pixel
    return _restructure(movieInfo)
  } catch(err) {
    console.log(err)
  }
}

export async function search(top: number, name: string) {
  const opt = {
    uri: searchUri.replace(/{{name}}/, urlencode(name)),
    method: 'GET',
    json: true,
    timeout: 5000
  }
  try {
    const movieList: MovieUnit[] = []
    const html = await request(opt)
    const $ = cheerio.load(html)
    $("dd[class='lf'] p strong a").each((index, item) => {
      movieList.push({
        id: $(item).attr('href').match(/^\/btdy\/dy([0-9]*).html$/)![1],
        type: ''
      })
    })
    $("dd[class='lf'] p span").each((index, item) => {
      movieList[index].type = $(item).contents()[0].data!
    })
    const afterFilterMovies = _.filter(movieList, m => m.type!.includes('电影'))
    const movieInfoList = await Promise.map(afterFilterMovies.slice(0, top), m => {
      return spiderMovie(m.id)
    })
    return movieInfoList
  } catch (err) {
    console.log(err)
  }
}
