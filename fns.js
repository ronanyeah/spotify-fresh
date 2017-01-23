'use strict'

const {
  __, addIndex, sortBy, uniq, append, takeLast, pipe, toPairs, map, join, prop, concat
} = require('ramda')
const { of } = require('fluture')
const { futch, futchJson, input } = require('rotools')

// Object => String
// TODO May need the encode from idiom repo.
const objToParamString =
  pipe(toPairs, map(join('=')), join('&'))

const toBase64 = str =>
  Number( process.versions.node[0] < 6 )
    ? new Buffer(str).toString('base64')
    : Buffer.from(str).toString('base64')

// [Object] -> String
const formatOptions =
  pipe(
    addIndex(map)(
      (val, index) =>
        `\n${index}) ${val.name}`
    ),
    join('')
  )

// [Any] -> String
const selectFrom =
  xs =>
    () =>
      input(prop(__, xs))
      .map(prop(__, xs))

// String -> Future Err _
const log = msg =>
  of()
  .map(
    () =>
      console.log(msg)
  )

const getInitialTokens = (clientId, clientSecret, authCode) =>
  futchJson(
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
        redirect_uri: 'http://localhost:8000/callback'
      })
    }
  )

// Necessary as the access token only lasts for an hour.
const getFreshTokens = (clientId, clientSecret, refreshToken) =>
  futchJson(
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

const spotifyApi = (userId, authToken) => (
  {
    getAllSongsFromPlaylist: (playlistId, playlistOwnerId) => {
      // Spotify sends back 100 songs max per request.
      const get100 = acc =>
        futchJson(
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
        .map( prop('items') )
        .chain(
          newSongs =>
            // When less than 100 are returned
            // you have got them all.
            newSongs.length < 100
              ? of(concat(acc, newSongs))
              : get100(concat(acc, newSongs))
        )

      return get100([])
    },

    getPlaylists:
      futchJson(
        'https://api.spotify.com/v1/me/playlists',
        {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      ),

    overwritePlaylist: (newUris, playlistId) =>
      futch(
        'https://api.spotify.com/v1' +
        `/users/${userId}` +
        `/playlists/${playlistId}` +
        `/tracks?uris=${join(',', newUris)}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        }
      )
  }
)

const getRandomIndexes = (n, range, res = []) =>
  res.length === n
    ? res
    : getRandomIndexes(
        n,
        range,
        uniq( append(Math.floor( Math.random() * range ), res) )
      )

const getMostRecentlyAdded = (number, songs) =>
  takeLast(
    number,
    sortBy(
      pipe(
        prop('added_at'),
        Date.parse
      ),
      songs
    )
  )

module.exports = {
  selectFrom,
  log,
  formatOptions,
  getRandomIndexes,
  getMostRecentlyAdded,
  getFreshTokens,
  getInitialTokens,
  spotifyApi
}
