'use strict'

/* eslint-disable no-console */

const { tap, fromPairs, map, path, props, assoc, prop, pipe } = require('ramda')
const { json, futch, input } = require('rotools')
const { reject, parallel, of } = require('fluture')

const {
  getFreshTokens, spotifyApi, formatOptions,
  getMostRecentlyAdded, getRandomIndexes, selectFrom
} = require(`${__dirname}/fns.js`)

const exit = msg => (
  console.log(msg),
  process.exit()
)

// ( a -> Future Err b ) -> a -> Future Err a
const tapChain =
  f =>
    x =>
      f(x)
      .map( () => x )

const transforms = [
  {
    name: 'random',
    fn:
      songs =>
        props( getRandomIndexes(20, songs.length), songs )
  },
  {
    name: 'most recently added',
    fn:
      songs =>
        getMostRecentlyAdded(20, songs)
  }
]

// String -> a -> (String, a)
const makeTuple = tag => value => [tag, value]

// [Song] -> String
const getUri = path(['track', 'uri'])

// [Transform] -> [Playlist] -> Object
const selectTasks =
  transforms =>
    playlists =>
      parallel(
        1,
        [
          selectFrom(
            '\nSelect source playlist:' +
            formatOptions(playlists),
            playlists
          )
          .map(makeTuple('sourcePlaylist')),

          selectFrom(
            '\nSelect option:' +
            formatOptions(transforms),
            transforms
          )
          .map(makeTuple('option')),

          selectFrom(
            '\nSelect target playlist:' +
            formatOptions(playlists),
            playlists
          )
          .map(makeTuple('targetPlaylist'))
        ]
      )
      .map(fromPairs)

// String -> Future Number String
const checkTokenValidity = accessToken =>
  futch(
    'https://api.spotify.com/v1/me',
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  )
  .chain(
    res =>
      res.status === 200
        ? of(accessToken)
        : reject(res.status)
  )

const updateTokens =
  (clientId, clientSecret, refreshToken) =>
    getFreshTokens(
      clientId,
      clientSecret,
      refreshToken
    )
    .chain(
      // Save the tokens.
      tapChain(
        newTokens =>
          json.write(
            `${__dirname}/tokens.json`,
            // Unless a new refresh token has been sent back, retain the old one.
            newTokens.refresh_token
              ? newTokens
              : assoc('refresh_token', refreshToken, newTokens)
          )
      )
    )

// START EXECUTION
json.read(`${__dirname}/config.json`)
.chain(
  ({clientId, clientSecret, userId}) =>
    json.read(`${__dirname}/tokens.json`)
    .chain(
      ({refresh_token, access_token}) =>
        checkTokenValidity(access_token)
        .chainRej(
          statusCode =>
            updateTokens(clientId, clientSecret, refresh_token)
            .map(prop('access_token'))
        )
        .map(
          accessToken =>
            spotifyApi(userId, accessToken)
        )
    )
)
.chain(
  ({getPlaylists, getAllSongsFromPlaylist, overwritePlaylist}) =>
    getPlaylists
    .map( prop('items') )
    .chain(selectTasks(transforms))
    .chain(
      ({sourcePlaylist, option, targetPlaylist}) =>
        getAllSongsFromPlaylist(
          sourcePlaylist.id,
          path(['owner', 'id'], sourcePlaylist)
        )
        .map(
          pipe(
            option.fn,
            map(getUri)
          )
        )
        .map(tap(
          () =>
            console.log(
              `\nAre you sure you want to overwrite '${targetPlaylist.name}' ` +
              `with 20 ${option.name} songs from '${sourcePlaylist.name}'? (yes/no)`
            )
        ))
        .chain(
          urisToApply =>
            input( txt => txt === 'yes' || txt === 'no' )
            .chain(
              selection =>
                selection === 'no'
                  ? of('\nAborted!')
                  : overwritePlaylist(
                      urisToApply,
                      targetPlaylist.id
                    )
                    .map( () => '\nSuccess!')
            )
        )
    )
)
.fork( exit, exit )
