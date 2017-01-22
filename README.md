lets you play with your spotify playlists (in a very basic way) using a node cli

you will need to know your spotify `user id`, and the `client_id` and `client_secret` from a spotify [app](https://developer.spotify.com/my-applications)

0) your `config.json` should look similar to this:
```
{
  "userId":       "pascal_arbez",
  "clientId":     "8160d65996d54d379391b7cda895185a",
  "clientSecret": "0c7f57984bd2482b956d6d9bbb37ada4"
}
```

1) run this server:  
`node -e "require('http').createServer( (req, res) => console.log( req.url.split('code=')[1] ) ).listen(8000)"`

2) put `http://localhost:8000/callback` in your spotify app's allowed redirect list

4) visit this url (replacing `<YOUR_CLIENT_ID>`):  
`https://accounts.spotify.com/authorize?client_id=<YOUR_CLIENT_ID>&response_type=code&redirect_uri=http%3A%2F%2Flocalhost:8000%2Fcallback&scope=playlist-modify-public`

4) pass the auth code printed out on the server console to `refresh.js`:  
`CODE=<AUTH_CODE> node refresh.js`

5) your tokens have been written to disk as `tokens.json` and you can now use the cli app:  
`node index.js`
