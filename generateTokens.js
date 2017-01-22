'use strict'

const { getInitialTokens } = require('./fns.js')
const { json } = require('rotools')

const config = require(`${__dirname}/config.json`)

process.env.CODE
  ? getInitialTokens(
      config.clientId,
      config.clientSecret,
      process.env.CODE
    )
    .chain(
      json.write(`${__dirname}/tokens.json`)
    )
    .fork(
      console.log,
      () =>
        console.log('Success!')
    )
  : console.log('Spotify auth code has not been provided!')
