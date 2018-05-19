import Movie from './movie'

export default class BtHomeMovie extends Movie {
  // 字幕情况
  private _subtitle: string

  constructor(
    name: string,
    uri: string,
    source: number,
    sourceSpace: number,
    pixel: '720P' | '1080P',
    subtitle: string
  ) {
    super(name, uri, source, sourceSpace, pixel)
    this._subtitle = subtitle
  }
}