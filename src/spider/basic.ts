import * as request from 'request-promise'
import * as cheerio from 'cheerio'
import * as urlencode from 'urlencode'
import * as _ from 'lodash'
import * as Promise from 'bluebird'
import * as http from 'http'
import * as iconv from 'iconv-lite'
import * as DEBUG from 'debug'

import redisClient from '../module/redis-client'
import { Urls, MovieInfo, MovieUnit } from './interface'
import { checkTTL } from '../util'

const debug = DEBUG(`moogle-server:${process.env.NODE_ENV}:spider`)

export default class Basic {
  // 统一的过期时间
  private readonly _timeout: number
  // 爬虫网站的名字
  protected readonly _webName: string
  // 用于缓存电影搜索结果的key
  protected readonly _redisSeachKey: string
  // 用于缓存最近电影结果的key
  protected readonly _redisLatestKey: string
  // 网址编码类型
  protected readonly _urlencodeType: 'utf8' | 'gbk'
  // 网页编码类型
  protected readonly _htmlencodeType: 'utf8' | 'gb2312'
  // 所有的链接
  protected readonly _urls: Urls

  constructor(
    webName: string,
    urlencodeType: 'utf8' | 'gbk',
    htmlcodeType: 'utf8' | 'gb2312',
    urls: Urls
  ) {
    this._webName = webName
    this._redisLatestKey = `moogle-server:${this._webName}:latest`
    this._redisSeachKey = `moogle-server:${this._webName}:search:{{word}}`
    this._urlencodeType = urlencodeType
    this._htmlencodeType = htmlcodeType
    this._urls = urls
  }

  /**
   * 返回一个新的MovieInfo对象
   */
  protected _newMovieInfo(): MovieInfo {
    return {
      pixel: 0,
      language: '',
      location: '',
      type: '',
      uri: '',
      name: '',
      actors: '',
      time: '',
    }
  }

  /**
   * 对搜索页的电影页链接进行解析
   * （由每个子类继承完成）
   */
  // tslint:disable-next-line
  protected _parserSearchPageMovieUrl($: CheerioStatic): MovieUnit[] { return [] }

  /**
   * 对主页的电影页链接进行解析
   * （由每个子类继承完成）
   */
  // tslint:disable-next-line
  protected _parserHomePageMovieUrl($: CheerioStatic): string[] { return [] }

  /**
   * 对电影页的电影资料进行解析
   * （由每个子类继承完成）
   */
  // tslint:disable-next-line
  protected async _parserMovieInfo($: CheerioStatic, id: string, hmtl: string): Promise<MovieInfo> { return this._newMovieInfo() }

  /**
   * 请求一个html并进行解码
   * @param uri       网页地址
   * @param codeType  编码方式
   */
  private _requestHtml(uri: string, codeType?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      http.get(uri, res => {
        res.setEncoding('binary')
        let html = ''
        res.on('data', function (data) {
          html += data
        }).on('end', function () {
          if (codeType) {
            const buf = new Buffer(html, 'binary')
            html = iconv.decode(buf, codeType)
          }
          resolve(html)
        })
      }).on('error', function (error) {
        reject(error)
      })
    })
  }

  /**
   * 重新整合数据
   * @param movieInfo   电影资料
   */
  private _restructure(movieInfo: MovieInfo) {
    let introduction = `[${movieInfo.time.split('-').slice(0, -1).join('-')}]`
    if (movieInfo.pixel !== 0) {
      introduction += `[${movieInfo.pixel}P]`
    }
    if (movieInfo.type.replace(/电影\//g, '').replace(/\s/g, '') !== '') {
      introduction += `[${movieInfo.type.replace(/电影\//g, '').replace(/\s/g, '')}]`
    }
    if (movieInfo.location !== '') {
      introduction += `[${movieInfo.location.replace(/\s/g, '')}]`
    }
    if (movieInfo.actors !== '' && movieInfo.actors !== '内详') {
      introduction += movieInfo.actors.includes('/')
        ? `[${movieInfo.actors.split('/').slice(0, 5).join('/')}]`
        : `[${movieInfo.actors}]`
    }
    return {
      name: movieInfo.name.replace(/^' '/, ''),
      introduction,
      uri: movieInfo.uri,
      time: movieInfo.time,
    }
  }

  /**
   * 对单个电影进行爬虫
   * @param id    电影的id
   */
  public async spiderMovie(id: string): Promise<string | null> {
    try {
      const html = await this._requestHtml(
        this._urls.movie.replace(/{{id}}/, id),
        this._htmlencodeType
      )
      const $ = cheerio.load(html)
      return this._restructure(await this._parserMovieInfo($, id, html))
    } catch (err) {
      debug('[ERROR] Search one movie has error', { err, name: this._webName, id })
      return null
    }
  }

  /**
   * 对首页的最近的推荐电影进行爬虫
   * @param top     返回最热门的n个电影结果
   */
  public async latest(top: number) {
    const cache = await redisClient.get(this._redisLatestKey)
    if (cache) {
      return JSON.parse(cache)
    }
    const opt = {
      uri: this._urls.home,
      method: 'GET',
      json: true,
      timeout: this._timeout,
    }
    try {
      const html = await request(opt)
      const $ = cheerio.load(html)
      const movieUris = this._parserHomePageMovieUrl($)
      const movieInfoList = await Promise.map(movieUris.slice(0, top), m => {
        return this.spiderMovie(m)
      })
      // 缓存策略
      // 1. 首先看是不是一次完整的搜索
      // 2. 如果是完整的搜索则缓存结果，并设置为7天的过期时间
      // 3. 如果不是则不进行缓存
      if (_.compact(movieInfoList).length === Math.min(top, movieUris.length)) {
        await redisClient.set(this._redisLatestKey, JSON.stringify(movieInfoList))
        await checkTTL(this._redisLatestKey, 24 * 60 * 60)
      }
      return movieInfoList
    } catch (err) {
      debug('[ERROR] Search latest movies has error', { err, name: this._webName })
      return []
    }
  }

  /**
   * 通过名字搜索电影
   * @param top     返回最热门的n个电影结果
   * @param name    搜索词
   */
  public async search(top: number, name: string) {
    const searchKey = this._redisSeachKey.replace(/{{word}}/, name)
    const cache = await redisClient.get(searchKey)
    if (cache) {
      return JSON.parse(cache)
    }
    const opt = {
      uri: this._urls.search.replace(/{{word}}/, urlencode(name, this._urlencodeType)),
      method: 'GET',
      json: true,
      timeout: this._timeout,
    }
    try {
      const html = await request(opt)
      const $ = cheerio.load(html)
      const movieUris = this._parserSearchPageMovieUrl($)
      const movieInfoList = await Promise.map(movieUris.slice(0, top), m => {
        return this.spiderMovie(m.id)
      })
      // 缓存策略
      // 1. 首先看是不是一次完整的搜索
      // 2. 如果是完整的搜索则缓存结果，并设置为7天的过期时间
      // 3. 如果不是则不进行缓存
      if (_.compact(movieInfoList).length === Math.min(top, movieUris.length)) {
        await redisClient.set(searchKey, JSON.stringify(movieInfoList))
        await checkTTL(searchKey, 24 * 60 * 60 * 7)
      }
      return movieInfoList
    } catch (err) {
      debug('[ERROR] Search movie by name has error', { err, name: this._webName })
      return []
    }
  }
}
