const http = require('http'); const express = require('express'); const { ExpressPeerServer } = require('peer');
const app = express(); const server = http.createServer(app);
app.use('/', ExpressPeerServer(server, { path: '/' }));
server.listen(9000, '127.0.0.1', () => console.log('peer up'));
