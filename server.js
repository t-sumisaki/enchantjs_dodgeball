const express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const path = require('path')
const io = require('socket.io')(http);


app.use(express.static(path.resolve(__dirname, 'webroot')));

let id = 0;
let players = []

io.on('connection', (socket) => {

    let _id = ++id;
    console.log('connected.', _id);

    socket.on('login', () => {
        console.log('login', _id);
        socket.emit('login', {
            id: _id
        })
    })
    
    socket.on('checkuser', function() {
        console.log('receive: checkuser', players);
        socket.emit('checkuser', players);
    })

    players.push(_id)

    socket.on('disconnect', function() {
        console.log('disconnect:', _id);

        let index = players.indexOf(_id);
        if (index > -1) {
            players.splice(index, 1);
        }

        socket.broadcast.emit('disconnected');
    })

    socket.on('sync', function(data) {
        socket.broadcast.emit('sync', data)
    })
})


http.listen(3000, () => {
    console.log('listening on *:3000')
})