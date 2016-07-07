'use strict';

// To get initial auth token go to:
// https://accounts.spotify.com/authorize?client_id=<client_id>&response_type=code&redirect_uri=http%3A%2F%2Flocalhost:8000%2Fcallback&scope=playlist-modify-public
// in browser while the below server is running and you'll get it printed out.
// require('http').createServer( (req, res) => console.log(req.url.split('code=')[1]) ).listen(8000);

// For 'node-fetch'
require('es6-promise').polyfill();

let R     = require('ramda');
let fs    = require('fs');
let fetch = require('node-fetch');

let config = require('./config.json');

let auth = {
  // These files are updated programmatically by the refresh function.
  token:   require('./auth.json').access_token,
  refresh: require('./refresh.json').refresh_token
};

// Execution
testApi()
.then(gatherAllSongs)
.then( R.pipe( getNewestSongs, getUris, overwritePlaylist ) );
//


function testApi() {
  return fetch('https://api.spotify.com/v1/me',
    {
      headers: {
        Authorization: `Bearer ${auth.token}`
      }
    }
  )
  .then( res => res.status === 200 ? Promise.resolve() : refreshTokens() )
  .catch( err => console.log(err) );
}

// Necessary as access token only last for an hour.
function refreshTokens() {
  let form = `grant_type=refresh_token&refresh_token=${auth.refresh}`;

  return fetch('https://accounts.spotify.com/api/token',
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${config.basicAuth}`, // Base64 encoded spotify <client_id>:<client_secret>.
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form
    }
  )
  .then( res => res.json() )
  .then( json => {

    if (json.refresh_token) {
      let data = JSON.stringify({
        refresh_token: json.refresh_token
      });
      fs.writeFileSync('./refresh.json', data);
    }

    auth.token = auth.token;
    fs.writeFileSync('./auth.json', JSON.stringify(json));
  })
  .catch( err => console.log(err) );
}

function gatherAllSongs() {

  return go(0, []);

  function go(offset, songs) {

    return fetch(`https://api.spotify.com/v1/users/${config.userId}/playlists/${config.sourcePlaylist}/tracks?offset=${offset}`,
      {
        headers: {
          Authorization: `Bearer ${auth.token}`
        }
      }
    )
    .then( res => res.json() )
    .then( json => {

      let results = json.items;

      songs.push.apply(songs, results);
      //songs = R.concat(songs, r   

      // Response contains a max of 100 songs, hence the recursion.
      return results.length < 100 ? songs : go(offset + 100, songs);

    })
    .catch( err => console.log(err) );

  }

}

function getNewestSongs(songs) {
  let toTimestamp  = d => new Date(d).getTime();
  let sortByNewest = R.sortBy(R.pipe(R.prop('added_at'), toTimestamp));
  let newestTracks = n => R.pipe(sortByNewest, R.takeLast(n));
  let newestTwenty = newestTracks(20);

  return newestTwenty(songs);
}

function getUris(songs) {
  let getUri = R.pipe(R.prop('track'), R.prop('uri'));

  return R.map(getUri, songs);
}

function overwritePlaylist(uris) {
  return fetch(`https://api.spotify.com/v1/users/${config.userId}/playlists/${config.targetPlaylist}/tracks?uris=${R.join(',', uris)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${auth.token}`
      }
    }
  )
  .then( res => console.log('Done!') )
  .catch( err => console.log(err) );
}
