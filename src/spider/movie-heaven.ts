import * as request from 'request-promise'
import * as cheerio from 'cheerio'
import * as urlencode from 'urlencode'
import * as _ from 'lodash'
import * as Promise from 'bluebird'
import * as http from 'http'
import * as iconv from 'iconv-lite'

import redisClient from '../module/redis-client' 
import { MovieInfo, MovieSource, MovieUnit } from './interface'
import { checkTTL } from '../util'

const REDIS_SEARCH_KEY = 'moogle-server:movie-heaven:search:{{word}}'
const REDIS_LATEST_KEY = 'moogle-server:movie-heaven:latest'

/**
 * 重新整合数据
 * @param movieInfo 
 */
function _restructure(movieInfo: MovieInfo) {
  let introduction = ''
  if (movieInfo.pixel !== 0) {
    introduction += `[${movieInfo.pixel}P]`
  }
  if (movieInfo.type !== '') {
    introduction += `[${movieInfo.type.replace(/\s/g, '')}]`
  }
  if (movieInfo.location !== '') {
    introduction += `[${movieInfo.location.replace(/\s/g, '')}]`
  }
  if (movieInfo.actors !== '') {
    introduction += `[${movieInfo.actors}]`
  }
  return {
    name: movieInfo.name.replace(/^' '/, ''),
    introduction,
    uri: movieInfo.uri,
  }
}

/**
 * 获取所有演员
 * @param allContent 
 */
function _getAllActors(allContent) {
  let actorIndex = 0
  let introductionIndex = 0 
  for (let index = 0; index < allContent.length; index += 1) {
    if (/主　　演　(.*) $/.test(allContent[index].data)) {
      actorIndex = index
    }
    if (/简　　介/.test(allContent[index].data)) {
      introductionIndex = index
    }
  }
  const actors: string[] = []
  for (let index = actorIndex; index < introductionIndex; index += 2) {
    if (allContent[index].data) {
      actors.push(allContent[index].data.split(' ')[0].match(/([\u4E00-\u9FA5]+)$/)![0])      
    }
  }
  return actors.slice(0, 5).join('/')
}

function getHtmlAndDecodePromise(uri: string, codeType: string) {
  return new Promise((resolve, reject) => {
    http.get(uri, res => {
      res.setEncoding('binary')
      let html = ''
      res.on('data', function (data) {
        html += data
      }).on('end', function () {
        var buf = new Buffer(html, 'binary')
        var str = iconv.decode(buf, codeType)
        resolve(str)
      })
    }).on('error', function (error) {
      reject(error)
    })
  })
}

/**
 * 对首页进行爬虫
 * @param top 
 */
export async function spiderHomePage(top: number) {
  const cache  = await redisClient.get(REDIS_LATEST_KEY)
  if (!cache) {
    const opt = {
      uri: 'http://www.ygdy8.com/index.html',
      method: 'GET',
      json: true,
      timeout: 50000,
    }
    try {
      const html = await request(opt)
      const $ = cheerio.load(html)
      const movieUris: string[] = []
      $("div[class='co_content4']>ul>a").each((index, item) => {
        const uri = $(item).attr('href')
        if (/\/html\/gndy\/dyzz\/[0-9]*\/[0-9]*\.html/.test(uri)) {
          movieUris.push($(item).attr('href'))
        }
      })
      const movieInfoList = await Promise.map(movieUris.slice(0, top), m => {
        return spiderMovie(m)
      })
      if (movieInfoList.length === top) {
        await redisClient.set(REDIS_LATEST_KEY, JSON.stringify(movieInfoList))
        await checkTTL(REDIS_LATEST_KEY, 24 * 60 * 60)
      }
      return movieInfoList
    } catch (err) {
      console.log(err)
    }
  } else {
    return JSON.parse(cache)
  }
}

/**
 * 从 content 中解析需要的信息
 * @param movieInfo 
 * @param c 
 * @param index 
 */
function _parserInfo(movieInfo, c, index) {
  const content = c.data || ''
  if (index === 0) {
    movieInfo.pixel = /.*1080.*/.test(content) ? 1080 : movieInfo.pixel
    movieInfo.pixel = /.*720.*/.test(content) ? 720 : movieInfo.pixel
  }
  if (/译　　名　(.*)\s*$/.test(content) && /[\u4E00-\u9FA5]+/.test(content.split('　').slice(-1)[0])) {
    movieInfo.name = content.match(/译　　名　(.*)\s*$/)![1].split('/')[0]
  }
  if (/片　　名　(.*)\s*$/.test(content) && /[\u4E00-\u9FA5]+/.test(content.split('　').slice(-1)[0])) {
    movieInfo.name = content.match(/片　　名　(.*)\s*$/)![1].split('/')[0]
  }
  if (/类　　别　(.*)\s*$/.test(content)) {
    movieInfo.type = content.match(/类　　别　(.*)\s*$/)![1]
  }
  if (/语　　言　(.*)\s*$/.test(content)) {
    movieInfo.language = content.match(/语　　言　(.*)\s*$/)![1]
  }
  if (/国　　家　(.*)\s*$/.test(content)) {
    movieInfo.location = content.match(/国　　家　(.*)\s*$/)![1]
  }
}

/**
 * 对一个电影进行爬虫
 * @param uri 
 */
export async function spiderMovie(uri: string) {
  try {
    const html = await getHtmlAndDecodePromise(`http://www.ygdy8.com${uri}`, 'gb2312')
    const $ = cheerio.load(html)
    const movieUris: string[] = []
    const movieInfo: MovieInfo = {
      pixel: 0,
      language: '',
      location: '',
      type: '',
      uri: '',
      name: '',
      actors: '',
    }

    $("div[id='Zoom']>span").each((index, item) => {
      movieInfo.actors = _getAllActors($(item).contents())
      _.map($(item).contents(), (c, index) => {
        _parserInfo(movieInfo, c, index)
      })
    })

    // 部分页面在 span 标签下面包了一个 p 标签
    $("div[id='Zoom']>span>p").each((index, item) => {
      _.map($(item).contents(), (c, index) => {
        _parserInfo(movieInfo, c, index)
      })
    })

    $("div[id='Zoom']>span>p>span").each((index, item) => {
      _.map($(item).contents(), (c, index) => {
        _parserInfo(movieInfo, c, index)
      })
    })

    $("td[style='WORD-WRAP: break-word']>a").each((index, item) => {
      if ($(item).contents()[0].data) {
        const content = $(item).contents()[0].data!
        movieInfo.uri = content
        movieInfo.pixel = /.*1080.*/.test(content) ? 1080 : movieInfo.pixel
        movieInfo.pixel = /.*720.*/.test(content) ? 720 : movieInfo.pixel
      }
    })
    return _restructure(movieInfo)
  } catch (err) {
    console.log(err)
  }
}

/**
 * 对一个电影进行搜索
 * @param top 
 * @param name 
 */
export async function search(top: number, name: string) {
  const cache = await redisClient.get(REDIS_SEARCH_KEY.replace(/{{word}}/, name))
  if (!cache) {
    const opt = {
      uri: `http://s.ygdy8.com/plus/so.php?kwtype=0&keyword=${urlencode(name, 'gbk')}`,
      method: 'GET',
      json: true,
      timeout: 5000
    }
    const html = await request(opt)
    const $ = cheerio.load(html)
    const movieUris: string[] = []
    $("div[class='co_content8']>ul>table>tbody>tr[height='24']>td[width='55%']>b>a").each((index, item) => {
      movieUris.push($(item).attr('href'))
    })
    const movieInfoList = await Promise.map(movieUris.slice(0, top), m => {
      return spiderMovie(m)
    })
    if (_.compact(movieInfoList).length === Math.min(top, movieUris.length)) {
      await redisClient.set(REDIS_SEARCH_KEY.replace(/{{word}}/, name), JSON.stringify(movieInfoList))
      await checkTTL(REDIS_SEARCH_KEY, 24 * 60 * 60)
    }
    return movieInfoList
  } else {
    return JSON.parse(cache)
  }
}
