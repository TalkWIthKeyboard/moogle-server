import * as _ from 'lodash'
import * as cheerio from 'cheerio'
import * as request from 'request-promise'

import Basic from './basic'
import { MovieInfo, MovieUnit, MovieSource } from './interface'

export default class BtHome extends Basic {
  constructor() {
    super('BtHome', 'utf8', 'utf8', {
      search: 'http://www.btbtdy.com/search/{{word}}.html',
      home: 'http://www.btbtdy.com/btfl/dy1.html',
      movie: 'http://www.btbtdy.com/btdy/dy{{id}}.html',
      download: 'http://www.btbtdy.com/vidlist/{{id}}.html',
    })
  }

  /**
   * 获取片源的分辨率
   * @param introduction 影片简介
   */
  private _getPixel(introduction: string): 0 | 1080 | 720 {
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
   * @param $     cheerio对象
   * @param item  枚举值
   */
  private _parserListContent($: CheerioStatic, item: CheerioElement): string {
    const types: string[] = []
    // tslint:disable-next-line
    $(item).children('a').each((index, element) => {
      types.push($(element).contents()[0] ? $(element).contents()[0].data! : ' ')
    })
    return types.join('/')
  }

  /**
   * 对搜索页的电影页链接进行解析
   * @param $     cheerio对象
   */
  protected _parserSearchPageMovieUrl($: CheerioStatic): MovieUnit[] {
    const movieList: MovieUnit[] = []
    // tslint:disable-next-line
    $('dd[class=\'lf\'] p strong a').each((index, item) => {
      movieList.push({
        id: $(item).attr('href').match(/^\/btdy\/dy([0-9]*).html$/)![1],
        type: '',
      })
    })
    // tslint:disable-next-line
    $('dd[class=\'lf\'] p span').each((index, item) => {
      movieList[index].type = $(item).contents()[0].data!
    })
    return _.filter(movieList, m => m.type!.includes('电影'))
  }

  /**
   * 对主页的电影页链接进行解析
   * @param $     cheerio对象
   */
  protected _parserHomePageMovieUrl($: CheerioStatic): string[] {
    const movieIds: string[] = []
    // tslint:disable-next-line
    $('a[class=\'pic_link\']').each((index, item) => {
      movieIds.push($(item).attr('href').match(/^\/btdy\/dy([0-9]*).html$/)![1])
    })
    return movieIds
  }

  /**
   * 对电影页的电影资料进行解析
   * @param $     cheerio对象
   */
  protected async _parserMovieInfo($: CheerioStatic, id: string): Promise<MovieInfo> {
    const movieInfo: any = {}
    // 获取电影的资料
    movieInfo.name = $('div[class=\'vod_intro rt\'] h1').contents()[0].data!
    $('div[class=\'vod_intro rt\'] dl dd').each((index, item) => {
      if (index === 0) {
        movieInfo.time = $(item).contents()[0].data!.split(' ')[0]
      }
      if (index === 2) {
        movieInfo.type = this._parserListContent($, item)
      }
      if (index === 3) {
        movieInfo.location = this._parserListContent($, item)
      }
      if (index === 4) {
        movieInfo.language = this._parserListContent($, item)
      }
      if ($(item).hasClass('zhuyan')) {
        movieInfo.actors = this._parserListContent($, item)
      }
    })

    // 获取所有的下载资源
    const html = await request({
      uri: this._urls.download!.replace(/{{id}}/, id),
      method: 'GET',
      json: true,
      timeout: 5000,
    })
    const element = cheerio.load(html)
    const movieSource: MovieSource[] = []
    // tslint:disable-next-line
    element('a[class=\'d1\']').each((index, item) => {
      movieSource.push({
        uri: $(item).attr('href'),
        pixel: 0,
      })
    })
    $('a[class=\'ico_1\']').each((index, item) => {
      movieSource[index].pixel = this._getPixel($(item).attr('title'))
    })
    _.sortBy(movieSource, m => m.pixel)
    movieInfo.uri = movieSource[0].uri
    movieInfo.pixel = movieSource[0].pixel
    return movieInfo
  }
}
