const express = require('express');
const app = require('express')();
const http = require('http').Server(app);
const path = require('path')



app.use(express.static(path.resolve(__dirname, 'webroot')));


http.listen(3000, () => {
    console.log('listening on *:3000')
})