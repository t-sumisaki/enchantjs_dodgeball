(function () {

    enchant();

    const socket = io.connect('/');


    // 接続ID。サーバから発行する
    let myId = null;






    const game = new Game(320, 320);

    game.fps = 24;
    game.preload('./img/chara1.png', './img/icon1.png');
    game.floorHeight = 200;
    // game.keybind(' '.charCodeAt(0), 'jump');
    // game.keybind('Z'.charCodeAt(0), 'shot');
    game.keybind(' '.charCodeAt(0), 'shot')



    game.onload = function () {
        game.rootScene.backgroundColor = '#7ecef4';

        let label = new Label("RootScene");
        game.rootScene.addChild(label);

        const connectScene = new ConnectScene(game, socket);
        console.log('initialize connectscene')
        game.rootScene.addEventListener('shotbuttondown', function () {
            socket.emit('login');            
            //game.pushScene(connectScene);
        })

        socket.on('login', function(data) {
            game.myId = data.id;
            game.pushScene(connectScene);
        })

        const gameScene = new GameScene(game, socket);
        game.connected = function(_players) {
            console.log('connected');
            gameScene.restart(game.myId, _players);
            game.replaceScene(gameScene)
        }

        socket.on('disconnected', function() {
            console.log('disconnected');
            game.disconnected();
        })

        game.disconnected = function() {
            game.popScene();
        }

        /*
        let player = new Player(myId, 100, 100);
        player.move = new MoveCommand(player);
        players.push(player)
        game.rootScene.addChild(player);

        game.rootScene.addEventListener('enterframe', function () {
            player.move(game);
        })

        game.rootScene.addEventListener('shotbuttondown', function () {
            player.shot();
        })

        let projectiles = []
        for (let i = 0; i < 1; ++i) {
            let _projectile = new Projectile(player.playerId);
            game.rootScene.addChild(_projectile);
            projectiles.push(_projectile);
        }

        player.projectiles = projectiles;

        let other = new Player(2, 200, 200);
        game.rootScene.addChild(other);
        players.push(other);
        */


    }
    game.start();

    socket.on('login', function (data) {
        myId = data.id;
    })


    const ConnectScene = Class.create(Scene, {
        initialize: function (_game, _socket) {
            Scene.call(this);
            // 接続用・接続待ちシーン
            this.interval = 24;
            this.count = 0;

            _socket.on('checkuser', function (data) {
                console.log('receive: checkuser');
                if (data.length >= 2) {
                    _game.connected(data);
                }
            })

            this.addEventListener('enterframe', function () {
                if (this.count < this.interval) {
                    ++this.count;
                    return;
                } else {
                    _socket.emit('checkuser');
                    this.count = 0;
                }
            })
        }
    })

    const GameScene = Class.create(Scene, {
        initialize: function (_game, _socket) {
            Scene.call(this);

            let players = new Group();
            this.addChild(players);

            this.player = null;

            this.restart = function (_myid, _players) {

                while(players.childNodes.length > 0) {
                    players.removeChild(players.childNodes[0])
                }

                for (let i = 0, _p; _p = _players[i]; ++i) {
                    let player = new Player(_p, 100 * (i + 1), 100);

                    if (_p === _myid) {
                        player.move = new MoveCommand(player, _socket);
                        this.player = player;
                    }

                    players.addChild(player);
                }
            }

            _socket.on('sync', function(data) {
                for(let _node of players.childNodes) {
                    if (_node.playerId == data.playerId) {
                        _node.sync(data);
                    }
                }
            })


            this.addEventListener('enterframe', function() {
                this.player.move(_game);                
            })
        }
    })




    const Player = Class.create(Sprite, {
        initialize: function (_id, _x, _y) {
            Sprite.call(this, 32, 32);
            this.image = game.assets['./img/chara1.png'];
            this.x = _x;
            this.y = _y;
            this.frame = 0;
            this.playerId = _id;
            this.speed = 3;
            this.isJump = false;
            this.vx = 0;
            this.vy = 0;
            this.direction = 1;
            this.projectiles = [];
            this.isDead = false;

            this.onHit = function (_cause) {
                if (this.isDead) {
                    return;
                }
                console.log('hit');
                this.isDead = true;
            }

            this.sync = function(data) {
                this.x = data.x;
                this.y = data.y;
                this.direction = data.direction;
                this.scaleX = data.direction;
            }

            this.animation = function () {
                if (this.isDead) {
                    this.frame = 3;
                    return;
                }
                if (this.frame > 1) {
                    this.frame = 0
                } else {
                    ++this.frame;
                }
            }

            this.shot = function () {
                let _projectile = this.projectiles.find(function (p_) { return !p_.isActive })
                if (_projectile) {
                    _projectile.launch(this.x + 16, this.y + 16, this.direction);
                }
            }

            this.addEventListener('enterframe', function () {
                this.animation();
            })
        }
    });

    const MoveCommand = function (_target, _socket) {

        let self = _target;
        return function (_game) {
            self.vx = 0;
            if (_game.input.right) {
                self.vx += self.speed;
            }
            if (_game.input.left) {
                self.vx -= self.speed;
            }

            if (self.vx) {
                if (self.x + self.vx < 0 || self.x + self.vx + 32 > _game.width) {
                    self.vx = 0
                }

                if ((self.vx > 0 && self.direction < 0) || (self.vx < 0 && self.direction > 0)) {
                    self.scaleX *= -1;
                    self.direction *= -1
                }

                self.x += self.vx;
            }

            if (!self.isJump && _game.input.up) {
                self.isJump = true;
                self.vy = -10;
            }

            if (self.vy && _game.floorHeight <= self.y + self.vy) {
                self.y = _game.floorHeight;
                self.isJump = false;
                // 縦方向リセット
                self.vy = 0;
            } else {
                // 高さを更新
                self.y += self.vy;
                self.vy += 1;
            }

            _socket.emit('sync', {
                playerId: _target.playerId,
                x: _target.x,
                y: _target.y,
                direction: _target.direction
            })
        }
    }



    const Projectile = Class.create(Group, {
        initialize: function (_playerId) {
            //Sprite.call(this, 16, 16);

            Group.call(this);
            let _view = new Sprite(16, 16);
            _view.image = game.assets['./img/icon1.png'];
            _view.visible = false;

            this.addChild(_view);
            this.playerId = _playerId;
            this.isActive = false;
            this.x = 100;
            this.y = 100;
            this.frame = 0;
            this.speed = 7;
            this.ttl = 0;
            this.direction = 1;

            let _collision = new Sprite(16, 16);
            _collision.backgroundColor = 'blue';
            _collision.opacity = 0.3;
            _collision.visible = false;
            this.addChild(_collision);


            this.setActive = function (_value) {
                this.isActive = _value;
                _view.visible = _value;
                // debug
                _collision.visible = _value;
            }

            this.launch = function (_x, _y, _direction) {
                if (this.isActive) {
                    return;
                }

                this.x = _x;
                this.y = _y;
                this.direction = _direction;
                this.ttl = 24;
                this.setActive(true);
            }

            this.isIntersect = function (_other) {
                if (_other.playerId !== this.playerId) {
                    if (_collision.intersect(_other)) {
                        return true;
                    }
                }

                return false;
            }

            this.addEventListener('enterframe', function () {
                if (this.isActive) {
                    this.x += this.speed * this.direction;
                    for (let _p of players) {
                        if (this.isIntersect(_p)) {
                            _collision.backgroundColor = 'red';
                            if (_p.onHit) {
                                _p.onHit(this);

                            }
                        } else {
                            _collision.backgroundColor = 'blue';
                        }
                    }

                    // 生存時間の更新
                    --this.ttl;
                    if (this.ttl < 0) {
                        this.setActive(false);
                    }
                }
            })
        }
    });



})();