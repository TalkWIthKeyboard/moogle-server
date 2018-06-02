export interface MovieUnit {
  id: string,
  type?: string,
}

export interface MovieSource {
  uri: string
  pixel: number
}

export interface MovieInfo extends MovieSource {
  location: string
  language: string
  actors: string
  name: string
  type: string
  time: string
}

export interface Urls {
  search: string
  movie: string
  home: string
  download?: string
}
