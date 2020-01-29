const path = require('path');
const Commando = require('discord.js-commando');
const ora = require('ora');
const botLoadingSpinner = ora('Starting bot');
let bot;

class Vixen {
    constructor(nodeclient) {
        this.log = nodeclient.log;
        this.db = nodeclient.db;
        this.config = {
            'token': '',
            'prefix': '',
            'owner': ''
        };
        this.client = nodeclient;
    }

    start() {
        let vixen = this;
        botLoadingSpinner.start();
        vixen.db.get('bot.token', function (err, value) {
            vixen.config.token = value;
            vixen.db.get('bot.prefix', function (err, value) {
                vixen.config.prefix = value;
                vixen.db.get('bot.owner', function (err, value) {
                    vixen.config.owner = value;
                    bot = new Commando.Client({
                        owner: vixen.config.owner,
                        commandPrefix: vixen.config.prefix
                    });
                    bot.registry.registerGroups([
                        ['music', 'Music commands'],
                        ['moderation', 'Moderation commands']
                    ])
                        .registerDefaults()
                        .registerCommandsIn(path.join(__dirname, 'commands'));
                    bot.login(vixen.config.token);

                    bot.on('ready', () => {
                        botLoadingSpinner.stop();
                        vixen.log('Logged in', 'info');
                    });

                    bot.on('message', (msg) => {
                        if (msg.mentions.users.has(bot.user.id)) {
                            msg.react(require('random-item')(['😄', '🤗', '😊', '🙃']));
                        }
                    })
                });
            });
        });

        // Graceful exit
        let death = require('death');
        death(function () {
            const botDestroySpinner = require('ora')("Shutting down gracefully...").start();
            bot.destroy().then(() => {
                setTimeout(function() {
                    botDestroySpinner.stop();
                    process.exit(0);
                }, 1500);
            });
        });
    }
}

module.exports = Vixen;
