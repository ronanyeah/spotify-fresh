'use strict'

const R        = require('ramda')
const co       = require('co')
const fetch    = require('node-fetch')
const bluebird = require('bluebird')
const fs       = bluebird.promisifyAll( require('fs') )

// Accepts validation function that will only return
// the terminal input when it validates to truthy.

// TODO: May also be possible to implement recursively
// by returning userInput(fn) but is harder to test due to
// the stdin mock being synchronous. Could put the mock calls in setTimeouts,
// or nextTick?
const userInput = fn =>
  new Promise( (resolve, reject) =>
    process.stdin.on(
      'data',
      function inputHandler (data) {
        const input = R.dropLast(1, data) // remove line break
        return fn(input)
          ? (
              process.stdin.removeListener('data', inputHandler),
              resolve(input)
            )
          : console.log('Try again!')
      }
    )
  )

const readJson = path =>
  fs.readFileAsync( path ).then( JSON.parse )

const writeJson = (path, json) =>
  fs.writeFileAsync( path, JSON.stringify(json) )

const toBase64 = str =>
  Number( process.versions.node[0] < 6 )
    ? new Buffer(str).toString('base64')
    : Buffer.from(str).toString('base64')

// Object => String
// TODO May need the encode from idiom repo.
const objToParamString = R.pipe(R.toPairs, R.map(R.join('=')), R.join('&'))

const getInitialTokens = (clientId, clientSecret, authCode, redirectUrl) =>
  fetch(
    'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${ toBase64(`${clientId}:${clientSecret}`) }`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: objToParamString({
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: redirectUrl
      })
    }
  )
  .then(
    res => res.status === 200
      ? res.json()
      : Promise.reject(
          Error(`Failed to get refresh token! Status code: ${res.status}`)
        )
  )

// Necessary as the access token only lasts for an hour.
const getFreshTokens = (clientId, clientSecret, refreshToken) =>
  fetch(
    'https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${ toBase64(`${clientId}:${clientSecret}`) }`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: objToParamString({
        grant_type: 'refresh_token',
        refresh_token: refreshToken
      })
    }
  )
  .then(
    res => res.status === 200
      ? res.json()
      : Promise.reject(
          Error(`Failed to update tokens! Status code: ${res.status}`)
        )
  )

const spotifyApi = (userId, authToken) => (
  {
    getAllSongsFromPlaylist: (playlistId, playlistOwnerId) => {
      // Spotify sends back 100 songs max per request.
      const get100 = co.wrap(function*(acc) {
        const newSongs = yield fetch(
          'https://api.spotify.com/v1' +
          `/users/${playlistOwnerId}` +
          `/playlists/${playlistId}` +
          `/tracks?offset=${acc.length}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        )
        .then(
          res => res.status === 200
            ? res.json()
            : Promise.reject(
                Error(`Failed to retrieve songs! Status code: ${res.status}`)
              )
        )
        .then( R.prop('items') )

        const total = R.concat(acc, newSongs)

        // When less than 100 are returned
        // you have got them all.
        return newSongs.length < 100
          ? total
          : get100(total)
      })

      return get100([])
    },

    getPlaylists: _ =>
      fetch(
        'https://api.spotify.com/v1/me/playlists',
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      )
      .then(
        res => res.status === 200
          ? res.json()
          : Promise.reject(
              Error(`Failed to get retrieve playlists! Status code: ${res.status}`)
            )
      ),

    overwritePlaylist: (newUris, playlistId) =>
      fetch(
        'https://api.spotify.com/v1' +
        `/users/${userId}` +
        `/playlists/${playlistId}` +
        `/tracks?uris=${R.join(',', newUris)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      )
      .then(
        res => res.status === 201
          ? res
          : Promise.reject(
              Error(`Failed to overwrite playlist! Status code: ${res.status}`)
            )
      )
  }
)

const getRandomIndexes = (n, range, res = []) =>
  res.length === n
    ? res
    : getRandomIndexes(
        n,
        range,
        R.uniq( R.append(Math.floor( Math.random() * range ), res) )
      )

const getMostRecentlyAdded = (number, songs) =>
  R.takeLast(
    number,
    R.sortBy(
      R.pipe(
        R.prop('added_at'),
        Date.parse
      ),
      songs
    )
  )

module.exports = {
  userInput,
  toBase64,
  readJson,
  writeJson,
  getRandomIndexes,
  getMostRecentlyAdded,
  getFreshTokens,
  getInitialTokens,
  spotifyApi
}
