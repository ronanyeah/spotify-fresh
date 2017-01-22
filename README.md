This lets you play with your Spotify playlists (in a very basic way) using a Node.js CLI.

0) First you will need to get your `Client ID` and `Client Secret` from a Spotify [developer application](https://developer.spotify.com/my-applications), and set `http://localhost:8000/callback` as an allowed `Redirect URI`.

1) Update the `config.json`, it should look like this:  
```
{
  "userId":       "pascal_arbez", // Your Spotify username.
  "clientId":     "8160d65996d54d379391b7cda895185a",
  "clientSecret": "0c7f57984bd2482b956d6d9bbb37ada4"
}
```

2) Run this server in your terminal:  
`node -e "require('http').createServer( req => console.log( '\n' + req.url.split('code=')[1] ) ).listen(8000)"`

3) Visit this URL (replacing `<YOUR_CLIENT_ID>`):  
`https://accounts.spotify.com/authorize?client_id=<YOUR_CLIENT_ID>&response_type=code&redirect_uri=http%3A%2F%2Flocalhost:8000%2Fcallback&scope=playlist-modify-public`

4) Pass the auth code printed out in the terminal to `generateTokens.js`:  
`CODE=<AUTH_CODE> node generateTokens.js`

5) Your tokens have been written to disk as `tokens.json` and you can now use the CLI app:  
`npm start`

NOTE: The app will refresh the tokens itself if necessary, so these steps need only be done once.
