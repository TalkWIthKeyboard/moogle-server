import * as _ from 'lodash'

import { MovieUnit, MovieInfo } from './interface'
import Basic from './basic'

export default class MovieHeaven extends Basic {
  constructor() {
    super('MovieHeaven', 'gbk', 'gb2312', {
      search: 'http://s.ygdy8.com/plus/so.php?kwtype=0&keyword={{word}}',
      home: 'http://www.ygdy8.com/index.html',
      movie: 'http://www.ygdy8.com{{id}}',
    })
  }

  /**
   * 获取所有演员
   * @param allContent  所有的content对象
   */
  private _getAllActors(allContent) {
    let actorIndex = 0
    let introductionIndex = 0
    for (let index = 0; index < allContent.length; index += 1) {
      if (/主　{2}演　(.*) $/.test(allContent[index].data)) {
        actorIndex = index
      }
      if (/简　{2}介/.test(allContent[index].data)) {
        introductionIndex = index
      }
    }
    const actors: string[] = []
    for (let index = actorIndex; index < introductionIndex; index += 2) {
      if (allContent[index].data) {
        const chinese = allContent[index].data.match(/([\u4E00-\u9FA5·]+) /)
        actors.push(chinese ? chinese[1] : null)
      }
    }
    return _.compact(actors).slice(0, 5).join('/')
  }

  /**
   * 获取所有的电影资料
   * @param $           cheerio对象
   * @param movieInfo   row电影资料
   * @param index       枚举下标
   * @param item        枚举值
   */
  private _getAllMovieInfo(
    $: CheerioStatic,
    movieInfo: MovieInfo,
    item: CheerioElement
  ) {
    const actors = this._getAllActors($(item).contents())
    if (actors.length > 0) {
      movieInfo.actors = actors
    }
    _.map($(item).contents(), (c, i) => {
      const content = c.data || ''
      if (i === 0) {
        movieInfo.pixel = /.*1080.*/.test(content) ? 1080 : movieInfo.pixel
        movieInfo.pixel = /.*720.*/.test(content) ? 720 : movieInfo.pixel
      }
      if (/译　{2}名　(.*)\s*$/.test(content) && /[\u4E00-\u9FA5]+/.test(content.split('　').slice(-1)[0])) {
        movieInfo.name = content.match(/译　{2}名　(.*)\s*$/)![1].split('/')[0]
      }
      if (/片　{2}名　(.*)\s*$/.test(content) && /[\u4E00-\u9FA5]+/.test(content.split('　').slice(-1)[0])) {
        movieInfo.name = content.match(/片　{2}名　(.*)\s*$/)![1].split('/')[0]
      }
      if (/类　{2}别　(.*)\s*$/.test(content)) {
        movieInfo.type = content.match(/类　{2}别　(.*)\s*$/)![1]
      }
      if (/语　{2}言　(.*)\s*$/.test(content)) {
        movieInfo.language = content.match(/语　{2}言　(.*)\s*$/)![1]
      }
      if (/国　{2}家　(.*)\s*$/.test(content)) {
        movieInfo.location = content.match(/国　{2}家　(.*)\s*$/)![1]
      }
    })
  }

  /**
   * 对搜索页的电影页链接进行解析
   * @param $     cheerio对象
   */
  protected _parserSearchPageMovieUrl($: CheerioStatic): MovieUnit[] {
    const movieUris: MovieUnit[] = []
    // tslint:disable-next-line
    $('div[class=\'co_content8\']>ul>table>tbody>tr[height=\'24\']>td[width=\'55%\']>b>a').each((index, item) => {
      movieUris.push({ id: $(item).attr('href') })
    })
    return movieUris
  }

  /**
   * 对主页的电影页链接进行解析
   * @param $     cheerio对象
   */
  protected _parserHomePageMovieUrl($: CheerioStatic): string[] {
    const movieUris: string[] = []
    // tslint:disable-next-line
    $('div[class=\'co_content4\']>ul>a').each((index, item) => {
      const uri = $(item).attr('href')
      if (/\/html\/gndy\/dyzz\/[0-9]*\/[0-9]*\.html/.test(uri)) {
        movieUris.push($(item).attr('href'))
      }
    })
    return movieUris
  }

  /**
   * 对电影页的电影资料进行解析
   * @param $     cheerio对象
   */
  // tslint:disable-next-line
  protected async _parserMovieInfo($: CheerioStatic, id: string, html: string): Promise<MovieInfo> {
    const movieInfo = this._newMovieInfo()

    movieInfo.time = html.match(/发布时间：([0-9-]*)/)![1]

    // tslint:disable-next-line
    $('div[id=\'Zoom\']>span').each((index, item) =>
      (this._getAllMovieInfo($, movieInfo, item)))

    // 部分页面在 span 标签下面包了一个 p 标签
    // tslint:disable-next-line
    $('div[id=\'Zoom\']>span>p').each((index, item) =>
      (this._getAllMovieInfo($, movieInfo, item)))

    // 部分页面在span标签的p标签下还包了一个span标签
    // tslint:disable-next-line
    $('div[id=\'Zoom\']>span>p>span').each((index, item) =>
      (this._getAllMovieInfo($, movieInfo, item)))

    // tslint:disable-next-line
    $('td[style=\'WORD-WRAP: break-word\']>a').each((index, item) => {
      if (!$(item).contents()[0].data) {
        return
      }
      const content = $(item).contents()[0].data!
      movieInfo.uri = content
      movieInfo.pixel = /.*1080.*/.test(content) ? 1080 : movieInfo.pixel
      movieInfo.pixel = /.*720.*/.test(content) ? 720 : movieInfo.pixel
    })
    return movieInfo
  }
}
