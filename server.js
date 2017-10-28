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
    socket.on('joingame', () => {
        if (players.length < 2) {
            console.log('joingame', _id);
            players.push({
                id: _id,
                socket: socket
            })

            // 規定数に達したら全員に通達
            if (players.length == 2) {
                let _players = players.map(_p => _p.id);
                for (let _p of players) {
                    _p.socket.emit('startgame', _players);
                }
            }
        } else {
            // 規定数より多い場合
            console.log('too many player...', _id);
            socket.emit('notjoingame');
        }
        console.log(`[debug]players=${players}`)
    })
    // 部屋から退出した場合
    socket.on('leavegame', () => {
        console.log('leavegame', _id);
        let index = players.findIndex((_p) => _p.id == _id);
        if (index > -1) {
            players.splice(index, 1);
        }
        socket.broadcast.emit('leavegame');
    })

    /*
    socket.on('checkuser', function () {
        console.log('receive: checkuser', players);
        socket.emit('checkuser', players);
    })
    */

    // 接続が切れた場合
    socket.on('disconnect', function () {
        console.log('disconnect:', _id);

        let index = players.findIndex((_p) => _p.id == _id);
        if (index > -1) {
            players.splice(index, 1);
        }
        socket.broadcast.emit('disconnected');
    })

    socket.on('sync', function (data) {
        socket.broadcast.emit('sync', data)
    })
})


http.listen(3000, () => {
    console.log('listening on *:3000')
})