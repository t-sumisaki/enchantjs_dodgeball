(function () {

    enchant();


    const game = new Game(320, 320);

    game.fps = 24;
    game.preload('./img/chara1.png', './img/icon1.png');
    game.floorHeight = 200;
    // game.keybind(' '.charCodeAt(0), 'jump');
    // game.keybind('Z'.charCodeAt(0), 'shot');
    game.keybind(' '.charCodeAt(0), 'shot')

    game.onload = function () {
        game.rootScene.backgroundColor = '#7ecef4';
        let player = new Player(1, 200, 200);
        game.rootScene.addChild(player);

        game.rootScene.addEventListener('enterframe', function () {
            player.move(game);
            player.animation();
        })

        game.rootScene.addEventListener('shotbuttondown', function() {
            player.shot();
        })

        let projectiles = []
        for (let i = 0; i < 1; ++i) {
            let _projectile = new Projectile(player.id);
            game.rootScene.addChild(_projectile);
            projectiles.push(_projectile);
        }

        player.projectiles = projectiles;


    }

    game.start();






    const Player = Class.create(Sprite, {
        initialize: function (_id, _x, _y) {
            Sprite.call(this, 32, 32);
            this.image = game.assets['./img/chara1.png'];
            this.x = _x;
            this.y = _y;
            this.frame = 0;
            this.id = _id;
            this.speed = 3;
            this.isJump = false;
            this.vx = 0;
            this.vy = 0;
            this.direction = 1;
            this.projectiles = [];

            this.animation = function () {

                if (this.frame > 1) {
                    this.frame = 0
                } else {
                    ++this.frame;
                }
            }

            this.shot = function() {
                let _projectile = this.projectiles.find(function (p_) { return !p_.visible })
                if (_projectile) {
                    _projectile.launch(this.x + 16, this.y + 16, this.direction);
                }
            }

            this.move = function (_game) {
                this.vx = 0;
                if (_game.input.right) {
                    this.vx += this.speed;
                }
                if (_game.input.left) {
                    this.vx -= this.speed;
                }

                if (this.vx) {
                    if (this.x + this.vx < 0 || this.x + this.vx + 32 > _game.width) {
                        this.vx = 0
                    }

                    if ((this.vx > 0 && this.direction < 0) || (this.vx < 0 && this.direction > 0)) {
                        this.scaleX *= -1;
                        this.direction *= -1
                    }

                    this.x += this.vx;
                }

                if (!this.isJump && _game.input.up) {
                    this.isJump = true;
                    this.vy = -10;
                }
                if (this.isJump) {

                    if (this.vy && _game.floorHeight <= this.y + this.vy) {
                        this.y = _game.floorHeight;
                        this.isJump = false;
                        // 縦方向リセット
                        this.vy = 0;
                    } else {
                        // 高さを更新
                        this.y += this.vy;
                    }
                    this.vy += 1;
                }

            }
        }
    });

    const Projectile = Class.create(Sprite, {
        initialize: function (_playerId) {
            Sprite.call(this, 16, 16);
            this.image = game.assets['./img/icon1.png'];
            this.visible = false;
            this.playerId = _playerId;
            this.x = 100;
            this.y = 100;
            this.frame = 0;
            this.speed = 7;
            this.ttl = 0;
            this.direction = 1;

            this.launch = function (_x, _y, _direction) {
                if (this.visible) {
                    return;
                }

                this.x = _x;
                this.y = _y;
                this.direction = _direction;
                this.ttl = 24;
                this.visible = true;
            }

            this.addEventListener('enterframe', function () {
                if (this.visible) {
                    this.x += this.speed * this.direction;
                    --this.ttl;
                    if (this.ttl < 0) {
                        this.visible = false;
                    }
                }
            })
        }
    })

})();