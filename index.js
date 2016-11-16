'use strict'

/* eslint-disable no-console */

const R     = require('ramda')
const co    = require('co')
const fetch = require('node-fetch')

const {
  readJson, writeJson,
  userInput, getFreshTokens, spotifyApi,
  getMostRecentlyAdded, getRandomIndexes
} = require(`${__dirname}/fns.js`)

const exit = msg => { console.log(msg); return process.exit() }

const logOption = (val, index) => console.log(`${index}) ${val.name}`)

// Begin execution.
co(function*() {

  const config      = yield readJson(`${__dirname}/config.json`)
  const savedTokens = yield readJson(`${__dirname}/tokens.json`)

  // Test call to check validity of current access token.
  const validTokens = yield fetch(
    'https://api.spotify.com/v1/me',
    {
      headers: {
        Authorization: `Bearer ${savedTokens.access_token}`
      }
    }
  )
  .then(
    res => res.status === 200
      ? savedTokens
      : getFreshTokens(
          config.clientId,
          config.clientSecret,
          savedTokens.refresh_token
        )
  )

  // Save the tokens.
  writeJson(
    `${__dirname}/tokens.json`,
    // Unless a new refresh token has been sent back, retain the old one.
    R.prop('refresh_token', validTokens)
      ? validTokens
      : R.assoc('refresh_token', savedTokens.refresh_token, validTokens)
  )

  const spotify = spotifyApi(config.userId, validTokens.access_token)

  const options = [
    { name: 'random', fn: songs => R.props( getRandomIndexes(config.count, songs.length), songs ) },
    { name: 'recent', fn: songs => getMostRecentlyAdded(config.count, songs) }
  ]

  const playlists =
    R.prop('items', yield spotify.getPlaylists() )

  console.log('\nSelect source playlist:')
  playlists.forEach(logOption)
  const sourcePlaylist = playlists[ yield userInput( R.prop(R.__, playlists) ) ]

  console.log('\nSelect option:')
  options.forEach(logOption)
  const option = options[ yield userInput( R.prop(R.__, options) ) ]

  console.log('\nSelect target playlist:')
  playlists.forEach(logOption)
  const targetPlaylist = playlists[ yield userInput( R.prop(R.__, playlists) ) ]

  const sourceSongs = yield spotify.getAllSongsFromPlaylist( sourcePlaylist.id, sourcePlaylist.owner.id )

  const urisToApply =
    R.map(R.path(['track', 'uri']), option.fn(sourceSongs))

  console.log(`\nAre you sure you want to overwrite '${targetPlaylist.name}' with ${config.count} songs from '${sourcePlaylist.name}'? (yes/no)`)
  return ( yield userInput( txt => txt === 'yes' || txt === 'no' ) ) === 'no'
    ? '\nAborted!'
    : yield spotify.overwritePlaylist(
        urisToApply,
        targetPlaylist.id
      )
      .then(
        _ =>
          '\nSuccess!'
      )

})
.then(exit)
.catch(exit)
