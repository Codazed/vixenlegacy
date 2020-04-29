const youtubedl = require('youtube-dl');
const ora = require('ora');

let client;
let guildsMap = new Map();

const config = {
    maxDuration: 900,
    defaultVolume: 0.35
};

class AudioController {
    constructor(vixen, bot) {
        this.vixen = vixen;
        client = bot;
        cleanGuildData();
    }

    getSettings(guildId) {
        return getGuildAudioSettings(guildId);
    }

    getQueueDuration(guildId) {
        return getQueueDuration(guildId);
    }

    getTimeTilNext(guildId) {
        return getTimeTilNext(guildId)
    }

    getMaxDuration() {
        return config.maxDuration;
    }

    getQueue(guildId) {
        return getCurrentGuildData(guildId).playQueue;
    }

    setVolume(guildId, volumeLevel) {
        let guildData = getCurrentGuildData(guildId);
        guildData.audioPlayer.setVolume(volumeLevel);
        setGuildAudioSetting(guildId, 'volume', volumeLevel);
    }

    queue(guildId, audioJSON) {
        let guildData = getCurrentGuildData(guildId);
        guildData.playQueue.push(audioJSON);
    }

    checkQueue(guildId, queue=getCurrentGuildData(guildId).playQueue.slice()) {
        let data = queue.shift();
        if (!existsInCache(data)) {
            download(data, (err) => {
                if (err) {
                    this.vixen.log(`Error downloading ${data.title}: Video is longer than the max duration of ${config.maxDuration} seconds. Skipping.`, 'err');
                    let index = getCurrentGuildData(guildId).playQueue.indexOf(data);
                    getCurrentGuildData(guildId).playQueue.splice(index, 1);
                }
                if (queue.length > 0) {
                    this.checkQueue(guildId, queue);
                }
            });
        } else {
            if (queue.length > 0) {
                this.checkQueue(guildId, queue);
            }
        }
    }

    play(guildId, audioJSON) {
        let guildData = getCurrentGuildData(guildId);
        if (guildData.nowPlaying !== undefined) {
            function queue() {
                guildData.playQueue.push(audioJSON);
                sendQueueEmbed(audioJSON);
            }
            if (guildData.loopEnabled) {
                audioJSON.responsechnl.send("Warning: Loop is enabled for the currently playing video.").then(() => setTimeout(queue, 2000));
            } else queue();
        } else {
            if (audioJSON.vc !== undefined) {
                let streamOptions = getGuildAudioSettings(guildId);
                audioJSON.vc.join().then(connection => {
                    connection.voice.setSelfDeaf(true);
                    if (audioJSON.source === 'File') {
                        guildData.audioPlayer = connection.play(`./cache/${audioJSON.filename}`, streamOptions);
                    } else {
                        guildData.audioPlayer = connection.play(`./cache/${audioJSON.id}.ogg`, streamOptions);
                    }
                    guildData.nowPlaying = audioJSON;
                    guildData.startTime = Date.now();
                    sendNPEmbed(audioJSON);
                    guildData.audioPlaying = true;
                    guildData.audioPlayer.on('finish', () => {
                        guildData.nowPlaying = undefined;
                        guildData.startTime = undefined;
                        if (guildData.loopEnabled) {
                            this.play(guildId, audioJSON);
                        } else {
                            if (guildData.source === 'File') {
                                fs.unlinkSync(`./cache/${audioJSON.filename}`);
                            }
                            if (guildData.playQueue.length <= 0) {
                                audioJSON.responsechnl.send("Queue is empty. Disconnecting.").then(() => audioJSON.vc.leave());
                            } else {
                                let nextVideo = guildData.playQueue.shift();
                                this.play(guildId, nextVideo);
                            }
                        }
                    });
                });
            }
        }
    }

    skip(guildId) {
        let guildData = getCurrentGuildData(guildId);
        guildData.audioPlayer.end();
    }

    stop(guildId) {
        let guildData = getCurrentGuildData(guildId);
        guildData.loopEnabled = false;
        guildData.playQueue = [];
        guildData.audioPlayer.end();
        cleanGuildData(guildId);
    }

    pause(guildId) {
        let guildData = getCurrentGuildData(guildId);
        if (guildData.audioPlayer.paused) {
            guildData.audioPlayer.resume();
        } else {
            guildData.audioPlayer.pause();
        }
        return guildData.audioPlayer.paused;
    }

    toggleLoop(guildId) {
        let guildData =getCurrentGuildData(guildId);
        guildData.loopEnabled = !guildData.loopEnabled;
        return guildData.loopEnabled;
    }

    getVideoInfo(query, callback) {
        const getInfoSpinner = ora(`Fetching info for query '${query}'...`).start();
        youtubedl.exec(query, ['--default-search', 'ytsearch', '--match-filter', `duration <= ${config.maxDuration}`, '--dump-json', '--skip-download'], {}, function(err, output) {
            if (err) throw err;
            if (output.join('\n').length > 0) {
                let videoJSON = JSON.parse(output);
                let passData = {
                    'query': query,
                    'title': videoJSON.title,
                    'uploader': videoJSON.uploader,
                    'url': videoJSON.webpage_url,
                    'id': videoJSON.id,
                    'thumbnail': videoJSON.thumbnails[0].url,
                    'duration': videoJSON.duration,
                    'source': videoJSON.extractor
                };
                callback(false, passData);
            } else {
                callback(true);

            }
            getInfoSpinner.stop();
        });
    }
}

function getGuildAudioSettings(guildId) {
    const query = client.vixen.db.prepare(`select * from '${guildId}' where id=?`);
    let settings = {};
    if (query.get('volume')) {
        settings.volume = query.get('volume').value;
    } else {
        settings.volume = config.defaultVolume;
    }
    return settings;
}

function setGuildAudioSetting(guildId, name, val) {
    let query;
    if (client.vixen.db.prepare(`select * from '${guildId}' where id=?`).get(name)) {
        query = client.vixen.db.prepare(`update '${guildId}' set value=? where id=?`).run(val, name);
    } else {
        query = client.vixen.db.prepare(`insert into '${guildId}' (id, value) values (?, ?)`).run(name, val);
    }
}

function existsInCache(audioJSON) {
    const fs = require('fs');
    return fs.existsSync(`./cache/${audioJSON.id}.ogg`);
}

function download(data, callback) {
    if (data.duration > config.maxDuration) {
        callback(true);
    } else {
        const downloadVideoSpinner = require('ora')(`Downloading '${data.title}'`).start();
        const youtubedl = require('youtube-dl');
        youtubedl.exec(data.url, ['--format', 'bestaudio', '-x', '--audio-format', 'vorbis', '--audio-quality', '64K', '-o', './cache/%(id)s.unprocessed', '--rm-cache-dir'], {}, function(err, output) {
            if (err) throw err;
            downloadVideoSpinner.stop();
            callback();
        });
    }
}

function getCurrentGuildData(guildId) {
    return guildsMap.get(guildId);
}

function cleanGuildData(guild) {
    let cleanData = {
        playQueue: [],
        loopEnabled: false,
        nowPlaying: undefined,
        startTime: undefined,
        audioPlayer: undefined
    };
    if (guild === undefined) {
        client.guilds.cache.forEach(function (guild) {
            guildsMap.set(guild.id, cleanData);
        });
    } else {
        guildsMap.set(guild.id, cleanData);
    }
}

function getTimeTilNext(guildId) {
    let guildData = getCurrentGuildData(guildId)
    let now = Date.now();
    let elapsed = now - guildData.startTime;
    return guildData.nowPlaying.duration * 1000 - elapsed;
}

function getQueueDuration(guildId) {
    let guildData = getCurrentGuildData(guildId);
    let queueTil = guildData.playQueue.slice();
    queueTil.pop();
    let now = Date.now();
    let elapsed = now - guildData.startTime;
    let totalDuration = guildData.nowPlaying.duration*1000 - elapsed;
    queueTil.forEach(video => {
        totalDuration += video.duration*1000;
    });
    return totalDuration;
}

function sendQueueEmbed(data) {
    let Discord = require('discord.js');
    let embed = new Discord.MessageEmbed();
    embed.setColor('#ff0000');
    if (data.source === 'youtube') {
        embed.setTitle('YouTube');
    } else {
        embed.setTitle(data.source);
    }
    embed.setDescription(`${data.requester.displayName} added a video to the queue`);
    embed.setThumbnail(data.thumbnail);
    embed.addField('Video', data.title);
    embed.addField('Uploader', data.uploader, true);
    embed.addField('Duration', require('format-duration')(data.duration * 1000), true);
    embed.addField('ETA', `${require('format-duration')(getQueueDuration(data.requester.guild.id))}`, true);
    embed.setURL(data.url);
    data.responsechnl.send(embed);
}

function sendNPEmbed(data) {
    let Discord = require('discord.js');
    let embed = new Discord.MessageEmbed();
    embed.setColor('#ff0000');
    if (data.source === 'youtube') {
        embed.setTitle('YouTube');
    } else {
        embed.setTitle(data.source);
    }
    embed.setDescription(`Playing video requested by ${data.requester.displayName}`);
    embed.setThumbnail(data.requester.user.avatarURL());
    embed.addField('Video', data.title);
    embed.addField('Uploader', data.uploader, true);
    embed.addField('Duration', require('format-duration')(data.duration * 1000), true);
    embed.setImage(data.thumbnail);
    embed.setURL(data.url);
    data.responsechnl.send(embed);
}

module.exports = AudioController;