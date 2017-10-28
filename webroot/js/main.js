(function () {

    enchant();

    const socket = io.connect('/');

    // ゲームコアインスタンス
    const game = new Game(320, 320);
    game.network = socket;

    // fps
    game.fps = 24;
    // アセットのプリロード
    game.preload('./img/chara1.png', './img/icon1.png');
    // 地面の高さを設定（今回は仮）
    game.floorHeight = 200;
    // キーバインド
    game.keybind(' '.charCodeAt(0), 'shot')
    game.keybind('Q'.charCodeAt(0), 'quit');



    game.onload = function () {
        this.rootScene.backgroundColor = '#7ecef4';

        this.restart();

        this.network.on('disconnected', function () {
            console.log('disconnected');
            game.disconnect();
        })
        this.network.emit('login')
        // 接続してゲームのログインIDを取得しておく
        this.network.on('login', function (data) {
            game.playerId = data.id;
        })
    }

    game.disconnect = function () {
        if (this.ingame) {
            this.network.emit('leavegame');
        }
        this.restart();
    }
    game.restart = function () {
        console.log('call::restart')
        while(this.currentScene != this.rootScene) {
            game.popScene();
        }

        let startScene = new StartScene(game);
        game.pushScene(startScene);
    }
    game.start();

    const StartScene = Class.create(Scene, {
        initialize: function (_game) {
            Scene.call(this);
            _game.ingame = false;

            let label = new Label('Press SPACEBAR to start.');
            this.addChild(label);

            this.addEventListener('shotbuttondown', function () {
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

            this.addEventListener('quitbuttondown', function () {
                _game.network.emit('leavegame');
                _game.restart();
            })

            _game.network.emit('joingame');

            _game.network.on('startgame', function (data) {
                console.log('startgame');
                let gameScene = new GameScene(_game, data);
                _game.replaceScene(gameScene);
            })

            _game.network.on('notjoingame', function () {
                window.alert('too many players.');
                console.log('[debug] too many players.')
                _game.restart();
            })
        }
    })

    const GameScene = Class.create(Scene, {
        initialize: function (_game, _players) {
            Scene.call(this);
            _game.ingame = true;

            let players = new Group();
            this.addChild(players);

            // 球は全プレイヤー共通でキャッシュしている
            let projectiles = new Group();
            this.addChild(projectiles);


            for (let i = 0, _p; _p = _players[i]; ++i) {
                let player = new Player(_p, 100 * (i + 1), 100, i);

                player.commands.push(new ShotCommand(player, projectiles))
                if (_p === _game.playerId) {
                    player.commands.push(new InputMoveCommand(player));
                    player.commands.push(new ApplyCommand(player));
                }

                players.addChild(player);
            }


            for (let i = 0; i < 4; ++i) {
                let _prj = new Projectile();
                projectiles.addChild(_prj);
            }


            this.addEventListener('enterframe', function () {
                for (let _player of players.childNodes) {
                    _player.update(_game);
                }

                for (let _projectile of projectiles.childNodes) {
                    _projectile.update(_game);

                    // 当たり判定
                    for (let _player of players.childNodes) {
                        if (_projectile.isIntersect(_player)) {
                            _player.onApplyDamage(_projectile)
                            _projectile.setActive(false);
                            break;
                        }
                    }
                }

                // ゲーム判定をここに入れる
                for (let _player of players.childNodes) {
                    if (_player.isDead) {
                        let resultScene = new ResultScene(_game, _player.playerId !== _game.playerId);
                        _game.pushScene(resultScene);
                    }
                }
            })

            // 同期判定
            _game.network.on('sync', function (data) {
                if (data.player) {
                    for (let i = 0, _p; _p = players.childNodes[i]; ++i) {
                        _p.sync(data.player);
                    }
                }
            })
        }
    })

    const ResultScene = Class.create(Scene, {
        initialize: function (_game, result) {
            Scene.call(this);
            let label = new Label(result ? 'You win' : 'You lose')
            this.addChild(label);

            this.addEventListener('shotbuttondown', function () {
                _game.disconnect();
            })
        }
    })


    const Player = Class.create(Sprite, {
        initialize: function (_id, _x, _y, pNum = 0) {
            Sprite.call(this, 32, 32);
            this.image = game.assets['./img/chara1.png'];
            this.x = _x;
            this.y = _y;
            this.animOffset = pNum * 5;
            this.frame = this.animOffset;
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

            this.onApplyDamage = function (_cause) {
                console.log('applyDamage', this.playerId, _cause);
                --this.hp;
                if (this.hp <= 0) {
                    this.isDead = true;
                }
            }

            this.animation = function () {
                if (this.isDead) {
                    this.frame = this.animOffset + 3;
                    return;
                }
                else if (this.frame > this.animOffset + 1)  {
                    this.frame = this.animOffset + 0
                } else {
                    ++this.frame;
                }
            }

            this.sync = function (data) {
                if (this.playerId == data.playerId) {
                    console.log('sync: ', JSON.stringify(data));
                    this.x = data.x;
                    this.y = data.y;
                    this.direction = data.direction;
                    this.scaleX = data.direction;
                    this.hp = data.hp;
                    this.isShot = data.isShot;
                }
            }

            this.update = function (_game) {
                this.animation();

                for (let _cmd of this.commands) {
                    _cmd.call(this, _game);
                }
            }
        }
    });

    const ApplyCommand = function (_target) {

        // init
        _target.vx = _target.vx || 0;
        _target.vy = _target.vy || 0;
        _target.isJump = _target.isJump || false;

        return function (_game) {

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
                        isShot: _target.isShot
                    }
                }
                _game.network.emit('sync', data)
            }
        }
    }

    const InputMoveCommand = function (_target) {

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
            if (_game.input.shot) {
                _target.isShot = true;
            } else {
                _target.isShot = false;
            }
        }
    }

    const ShotCommand = function (_player, _projectiles) {
        let interval = 24;
        let count = 24;
        return function (_game) {
            console.log('shot: count=' + count);
            if (count > 0) {
                --count;
            } else {
                if (_player.isShot) {

                    let _projectile = _projectiles.childNodes.find(function (_p) { return !_p.isActive });
                    if (_projectile) {
                        _projectile.launch(_player.playerId, _player.x + 16, _player.y + 16, _player.direction)
                    }
                    count = interval;
                }
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
            //_collision.backgroundColor = 'blue';
            //_collision.opacity = 0.3;
            _collision.visible = false;
            this.addChild(_collision);


            this.setActive = function (_value) {
                this.isActive = _value;
                _view.visible = _value;
                // debug
                _collision.visible = _value;
            }

            this.launch = function (_playerId, _x, _y, _direction) {
                console.log('launch');
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
                if (this.isActive) {
                    if (_other.playerId !== this.playerId) {
                        console.log(this.x, this.y);
                        if (_collision.intersect(_other)) {
                            return true;
                        }
                    }
                }
                return false;
            }

            this.update = function () {
                if (this.isActive) {
                    console.log('prj;' + this.playerId)
                    this.x += this.speed * this.direction;
                    --this.ttl;
                    if (this.ttl < 0) {
                        this.setActive(false);
                    }
                }
            }
        }
    });

})();