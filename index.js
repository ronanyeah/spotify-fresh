'use strict'

/* eslint-disable no-console */

const { map, path, __, props, assoc, prop, pipe, addIndex, join } = require('ramda')
const { json, futch, input } = require('rotools')
const { both, of, Future } = require('fluture')

const {
  getFreshTokens, spotifyApi,
  getMostRecentlyAdded, getRandomIndexes
} = require(`${__dirname}/fns.js`)

const exit = msg => (
  console.log(msg),
  process.exit()
)

// [Object] -> String
const formatOptions =
  pipe(
    addIndex(map)(
      (val, index) =>
        `\n${index}) ${val.name}`
    ),
    join('')
  )

const options = [
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

both(
  json.read(`${__dirname}/config.json`),
  json.read(`${__dirname}/tokens.json`)
)
.chain(
  ([config, tokens]) =>
    futch(
      'https://api.spotify.com/v1/me',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`
        }
      }
    )
    .chain(
      res =>
        res.status === 200
          ? of(tokens)
          : getFreshTokens(
              config.clientId,
              config.clientSecret,
              tokens.refresh_token
            )
            .chain(
              newTokens =>
                // Save the tokens.
                json.write(
                  `${__dirname}/tokens.json`,
                  // Unless a new refresh token has been sent back, retain the old one.
                  newTokens.refresh_token
                    ? newTokens
                    : assoc('refresh_token', tokens.refresh_token, newTokens)
                )
                .map( () => newTokens )
            )
    )
    .map(
      validTokens =>
        spotifyApi(config.userId, validTokens.access_token)
    )
)
.chain(
  spotify =>
    Future.do(function * () {

      const playlists =
        prop('items', yield spotify.getPlaylists() )

      console.log(
        '\nSelect source playlist:' +
        formatOptions(playlists)
      )
      const sourcePlaylist = playlists[
        yield input(prop(__, playlists))
      ]

      console.log(
        '\nSelect option:' +
        formatOptions(options)
      )
      const option = options[
        yield input(prop(__, options))
      ]

      console.log(
        '\nSelect target playlist:' +
        formatOptions(playlists)
      )
      const targetPlaylist = playlists[
        yield input(prop(__, playlists))
      ]

      const sourceSongs =
        yield spotify.getAllSongsFromPlaylist(
          sourcePlaylist.id,
          sourcePlaylist.owner.id
        )

      const urisToApply =
        map(path(['track', 'uri']), option.fn(sourceSongs))

      console.log(
        `\nAre you sure you want to overwrite '${targetPlaylist.name}' ` +
        `with 20 ${option.name} songs from '${sourcePlaylist.name}'? (yes/no)`
      )
      return ( yield input( txt => txt === 'yes' || txt === 'no' ) ) === 'no'
        ? '\nAborted!'
        : yield spotify.overwritePlaylist(
            urisToApply,
            targetPlaylist.id
          )
          .map( () => '\nSuccess!')
    })
)
.fork( exit, exit )
