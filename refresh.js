'use strict'

const f = require('./fns.js')

const config = require(`${__dirname}/config.json`)

process.env.CODE
  ? f.getInitialTokens(
      config.clientId,
      config.clientSecret,
      process.env.CODE,
      'http://localhost:8000/callback'
    )
    .then(
      tokens => f.writeJson(`${__dirname}/tokens.json`, tokens)
    )
    .catch(console.log)
  : console.log('Spotify auth code has not been provided!')
