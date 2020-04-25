const fs = require('fs');
const path = require('path');
const Commando = require('discord.js-commando');
const ora = require('ora');
const AudioController = require('./audiocontroller');
const botLoadingSpinner = ora('Starting bot');
let bot;

class Vixen {
    constructor(nodeClient) {
        this.log = nodeClient.log;
        this.db = nodeClient.db;
        this.config = {
            'token': '',
            'prefix': '',
            'owner': ''
        };
        this.loadingEmojis = new Map();
    }

    getAudioController() {
        return this.audioController;
    }

    start() {
        let vixen = this;
        botLoadingSpinner.start();
        configureVixen(vixen);
        bot = new Commando.Client({
            owner: vixen.config.owner,
            commandPrefix: vixen.config.prefix
        });

        bot.registry.registerGroups([
            ['music', 'Music commands'],
            ['moderation', 'Moderation commands'],
            ['admin', 'Bot administration commands']
        ])
            .registerDefaults()
            .registerCommandsIn(path.join(__dirname, 'commands'));
        bot.playQueue = [];
        bot.loopEnabled = false;
        bot.login(vixen.config.token);
        bot.on('ready', () => {
            vixen.audioController = new AudioController(vixen, bot);
            bot.vixen = this;
            botLoadingSpinner.stop();
            vixen.log('Logged in', 'info');
            bot.guilds.cache.forEach(function (guild) {
                if (!fs.existsSync(`./data/${guild.id}`)) {
                    fs.mkdirSync(`./data/${guild.id}`);
                }
                try {
                    vixen.db.prepare(`create table '${guild.id}' (id text, value text)`).run();
                } catch (err){}
                let guildInfo = vixen.db.prepare('select * from guilds where uid=?').get(guild.id);
                if (!guildInfo) {
                    vixen.db.prepare('insert into guilds (uid, name) values (?, ?)').run(guild.id, guild.name);
                }
                let guildEmoji = vixen.db.prepare(`select * from '${guild.id}' where id=?`).get('loadingEmoji');
                if (guildEmoji) {
                    vixen.loadingEmojis.set(`${guild.id}`, guild.emojis.cache.get(guildEmoji.value));
                } else {
                    vixen.log(`Loading emoji is incorrect or does not exist on guildID ${guild.id}. Creating it...`, 'warn');
                    guild.emojis.create('./assets/loading.gif', 'vixenLoading')
                        .then(emoji => {
                            //vixen.db.put(`${guild.id}.loadingEmoji`, emoji.id);
                            vixen.db.prepare(`insert into '${guild.id}' (id, value) values ('loadingEmoji', ?)`).run(emoji.id);
                            vixen.loadingEmojis.set(`${guild.id}`, guild.emojis.cache.get(emoji.id));
                        })
                        .catch(console.error);
                }
            });
        });

        bot.on('message', (msg) => {
            if (msg.mentions.users.has(bot.user.id)) {
                msg.react(require('random-item')(['😄', '🤗', '😊', '🙃', '🦊']));
            }
        });

        bot.on('commandError', (command, error) => {
            console.log(error);
        })

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

function configureVixen(vixen) {
    const fetch = vixen.db.prepare('select * from vixen where id=?');
    vixen.config.token = fetch.get('disc_token').value;
    vixen.config.prefix = fetch.get('prefix').value;
    vixen.config.owner = fetch.get('owner').value;
}

module.exports = Vixen;
