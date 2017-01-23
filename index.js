'use strict'

/* eslint-disable no-console */

const { map, path, props, assoc, prop, pipe } = require('ramda')
const { json, futch, input } = require('rotools')
const { parallel, both, of } = require('fluture')

const {
  getFreshTokens, spotifyApi, log, formatOptions,
  getMostRecentlyAdded, getRandomIndexes, selectFrom
} = require(`${__dirname}/fns.js`)

const exit = msg => (
  console.log(msg),
  process.exit()
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

// START EXECUTION
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
    spotify.getPlaylists
    .map( prop('items') )
    .chain(
      playlists =>
        parallel(
          1,
          [
            log(
              '\nSelect source playlist:' +
              formatOptions(playlists)
            )
            .chain(selectFrom(playlists)),

            log(
              '\nSelect option:' +
              formatOptions(options)
            )
            .chain(selectFrom(options)),

            log(
              '\nSelect target playlist:' +
              formatOptions(playlists)
            )
            .chain(selectFrom(playlists))
          ]
        )
    )
    .chain(
      ([sourcePlaylist, option, targetPlaylist]) =>
        spotify.getAllSongsFromPlaylist(
          sourcePlaylist.id,
          path(['owner', 'id'], sourcePlaylist)
        )
        .map(
          pipe(
            option.fn,
            map(path(['track', 'uri']))
          )
        )
        .chain(
          urisToApply =>
            log(
              `\nAre you sure you want to overwrite '${targetPlaylist.name}' ` +
              `with 20 ${option.name} songs from '${sourcePlaylist.name}'? (yes/no)`
            )
            .chain(
              () =>
                input( txt => txt === 'yes' || txt === 'no' )
                .chain(
                  selection =>
                    selection === 'no'
                      ? of('\nAborted!')
                      : spotify.overwritePlaylist(
                          urisToApply,
                          targetPlaylist.id
                        )
                        .map( () => '\nSuccess!')
                )
            )
        )
    )
)
.fork( exit, exit )
