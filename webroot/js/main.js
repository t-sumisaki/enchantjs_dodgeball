(function () {

    enchant();

    const socket = io.connect('/');


    // 接続ID。サーバから発行する
    let myId = null;

    const game = new Game(320, 320);
    game.network = socket;

    game.fps = 24;
    game.preload('./img/chara1.png', './img/icon1.png');
    game.floorHeight = 200;
    // game.keybind(' '.charCodeAt(0), 'jump');
    // game.keybind('Z'.charCodeAt(0), 'shot');
    game.keybind(' '.charCodeAt(0), 'shot')
    game.keybind('Q'.charCodeAt(0), 'quit');



    game.onload = function () {
        this.rootScene.backgroundColor = '#7ecef4';

        this.restart();
          
        this.network.on('disconnected', function() {
            console.log('disconnected');
            game.disconnect();
        })
        this.network.emit('login')        
    }
    // 接続してゲームのログインIDを取得しておく
    socket.on('login', function(data) {
        game.playerId = data.id;
    })

    game.disconnect = function() {
        if (this.ingame) {
            this.network.emit('leavegame');
        }
        this.restart();
    }
    game.restart = function() {
        console.log('call::restart')
        game.popScene();
        
        let startScene = new StartScene(game);
        game.pushScene(startScene);
    }
    game.start();

    const StartScene = Class.create(Scene, {
        initialize: function(_game) {
            Scene.call(this);
            _game.ingame = false;

            let label = new Label('Press SPACEBAR to start.');
            this.addChild(label);

            this.addEventListener('shotbuttondown', function() {
                let connectScene = new ConnectScene(_game);
                game.replaceScene(connectScene);
            });
        }
    })


    const ConnectScene = Class.create(Scene, {
        initialize: function (_game) {
            Scene.call(this);

            let label = new Label('Now connecting...');
            this.addChild(label);

            this.addEventListener('quitbuttondown', function() {
                _game.network.emit('leavegame');
                _game.restart();
            })

            _game.network.emit('joingame');

            _game.network.on('startgame', function(data) {
                console.log('startgame');
                let gameScene = new GameScene(_game, data);
                _game.replaceScene(gameScene);
            })

            _game.network.on('notjoingame', function() {
                window.alert('too many players.');
                _game.restart();
            })
        }
    })

    const GameScene = Class.create(Scene, {
        initialize: function (_game, _players) {
            Scene.call(this);
            _game.ingame = true;

            let label = new Label('game');
            this.addChild(label);

            let players = new Group();
            this.addChild(players);

            for (let i = 0, _p; _p = _players[i]; ++i) {
                let player = new Player(_p, 100 * (i + 1), 100);

                if (_p === _game.playerId) {
                    player.commands.push(new InputCommand(player));
                    player.commands.push(new ApplyCommand(player));
                }

                players.addChild(player);
            }
        

            this.addEventListener('enterframe', function() {
                let gameover = false;
                for (let i = 0, _p; _p = players.childNodes[i]; ++i) {
                    _p.update(_game);
                }

                // ゲーム判定をここに入れる

            })

            _game.network.on('sync', function(data) {
                if (data.player) {
                    for (let i = 0, _p; _p = players.childNodes[i]; ++i) {
                        _p.sync(data.player);
                    }
                }
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
            this.hp = 1;
            this.isDead = false;

            this.commands = [];

            this.onHit = function (_cause) {
                if (this.isDead) {
                    return;
                }
                console.log('hit');
                this.isDead = true;
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

            this.sync = function(data) {
                if (this.playerId == data.playerId) {
                    this.x = data.x;
                    this.y = data.y;
                    this.direction = data.direction;
                    this.scaleX = data.direction;
                    this.hp = data.hp;
                } 
            }

            this.update = function(_game) {
                this.animation();

                for (let i = 0, _cmd; _cmd = this.commands[i]; ++i) {
                    _cmd.call(this, _game);
                }
            }
        }
    });

    const SyncCommand = function(_target) {
        return function(_game) {
        }
    }

    const ApplyCommand = function(_target) {

        // init
        _target.vx = _target.vx || 0;
        _target.vy = _target.vy || 0;
        _target.isJump = _target.isJump || false;

        return function(_game) {
            
            if (_target.vx) {
                if (_target.x + _target.vx < 0 || _target.x + _target.vx + 32 > _game.width) {
                    _target.vx = 0
                }
                
                if ((_target.vx > 0 && _target.direction < 0) || (_target.vx < 0 && _target.direction > 0)) {
                    _target.scaleX *= -1;
                    _target.direction *= -1
                }
                
                _target.x += _target.vx;
            }
            if (_target.vy && _game.floorHeight <= _target.y + _target.vy) {
                _target.y = _game.floorHeight;
                _target.isJump = false;
                // 縦方向リセット
                _target.vy = 0;
            } else {
                // 高さを更新
                _target.y += _target.vy;
                _target.vy += 1;
            }

            if (_game.network) {
                let data = {
                    player: {
                        playerId: _target.playerId,
                        x: _target.x,
                        y: _target.y,
                        direction: _target.direction,
                        hp: _target.hp,
                    }
                }
                _game.network.emit('sync', data)
            }
        }
    }
    
    const InputCommand = function (_target) {
        
        // init
        _target.vx = _target.vx || 0;
        _target.vy = _target.vy || 0;
        _target.isJump = _target.isJump || false;
        _target.isShot = _target.isShot || false;


        return function (_game) {
            // 今回は押した分だけ移動なのでvxは毎回リセットする
            _target.vx = 0;
            if (_game.input.right) {
                _target.vx += _target.speed;
            }
            if (_game.input.left) {
                _target.vx -= _target.speed;
            }

            if (!_target.isJump && _game.input.up) {
                _target.isJump = true;
                _target.vy = -10;
            }
            if (!_target.isShot && _game.input.shot) {
                _target.isShot = true;
            }
        }
    }

    const ShotCommand = function(_player, _projectiles) {        
        return function() {
            let _projectile = _projectiles.childNodes.find(function(_p) { return !_p.isActive });
            if (_projectile) {
                _projectile.launch(_player.playerId, _player.x + 16, _player.y + 16, _player.direction)
            }
        }
    }



    const Projectile = Class.create(Group, {
        initialize: function () {
            //Sprite.call(this, 16, 16);

            Group.call(this);
            let _view = new Sprite(16, 16);
            _view.image = game.assets['./img/icon1.png'];
            _view.visible = false;

            this.addChild(_view);
            this.playerId = null;
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

            this.serialize = function() {
                return {
                    x: this.x,
                    y: this.y,
                    direction: this.direction,
                    isActive: this.isActive
                }
            }


            this.setActive = function (_value) {
                this.isActive = _value;
                _view.visible = _value;
                // debug
                _collision.visible = _value;
            }

            this.launch = function (_playerId, _x, _y, _direction) {
                if (this.isActive) {
                    return;
                }
                this.playerId = _playerId;
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
                    // for (let _p of players) {
                    //     if (this.isIntersect(_p)) {
                    //         _collision.backgroundColor = 'red';
                    //         if (_p.onHit) {
                    //             _p.onHit(this);

                    //         }
                    //     } else {
                    //         _collision.backgroundColor = 'blue';
                    //     }
                    // }

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