// todo 种子编码问题还没解决
/* tslint:disable */

import * as request from 'request-promise'
import * as cheerio from 'cheerio'
import * as fs from 'fs'
import * as path from 'path'

/**
 * 返回前多少个电影信息
 * @param top   返回前n个电影
 */
async function spiderHomePage(top: number) {
  const opt = {
    uri: 'http://www.btbtt88.com/',
    method: 'GET',
    json: true,
  }
  try {
    const html = await request(opt)
    const $ = cheerio.load(html)
    $('a[class=\'subject_link thread-new\']').each((index, item) => {
      const $item = $(item)
      console.log($item.attr('href'), $item.contents()[0].data)
    })
    $('a[class=\'subject_link thread-old\']').each((index, item) => {
      const $item = $(item)
      console.log($item.attr('href'), $item.contents()[0].data)
    })
  } catch (err) {
    console.log(err)
  }
}

async function spiderMovie(uri: string) {
  const opt = {
    uri,
    method: 'GET',
    json: true,
  }
  try {
    const attchDialogUriRegex = new RegExp(/http:\/\/www.btbtt88.com\/attach-dialog-fid-1-aid-([0-9]*)-ajax-1.htm/)
    const rowDownloadUri = 'http://www.btbtt88.com/attach-download-fid-1-aid-{{id}}.htm'
    const html = await request(opt)
    const $ = cheerio.load(html)
    let downloadUri = ''
    // 通过 dialogUri 来获取电影的下载id
    $('a[class=\'ajaxdialog\']').each((index, item) => {
      const uri = $(item).attr('href')
      if (attchDialogUriRegex.test(uri)) {
        const id = attchDialogUriRegex.exec(uri)![1]
        downloadUri = rowDownloadUri.replace(/{{id}}/, id)
      }
    })

  } catch (err) {
    console.log(err)
  }
}

async function parserTorrent(uri: string) {
  const opt = {
    uri,
    method: 'GET',
    json: true,
  }
  try {
    const html = await request(opt)
    // const buf = torrent.toTorrentFile({
    //   info: html
    // })
    // console.log(buf)
    // fs.writeFileSync(path.join(__dirname, 'source.torrent'), buf)
    fs.writeFileSync(path.join(__dirname, 'source.torrent'), html)
  } catch (err) {
    console.log(err)
  }
}

// spiderMovie('http://www.btbtt88.com/thread-index-fid-1-tid-14984.htm')

parserTorrent('http://www.btbtt88.com/attach-download-fid-1-aid-66559.htm')
