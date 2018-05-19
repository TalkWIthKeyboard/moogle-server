export default class movie {
  // 电影名字
  private _name: string
  // 下载链接
  private _uri: string
  // 豆瓣评分
  private _score: number
  // 资源大小（单位 G）
  private _sourceSpace: number
  // 资源质量
  private _pixel: '720P' | '1080P'
  // 地区
  private _location: string

  constructor(
    name: string,
    uri: string,
    score: number,
    sourceSpace: number,
    pixel: '720P' | '1080P'
    
  ) {
    this._name = name
    this._uri = uri
    this._score = score
    this._sourceSpace = sourceSpace
    this._pixel = pixel
  }
}