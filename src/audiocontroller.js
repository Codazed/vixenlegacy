const youtubedl = require('youtube-dl');
const ora = require('ora');

let client;
let guildsMap = new Map();

const config = {
    maxDuration: 900
};

class AudioController {
    constructor(vixen, bot) {
        this.vixen = vixen;
        client = bot;
        cleanGuildData();
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
                audioJSON.vc.join().then(connection => {
                    connection.voice.setSelfDeaf(true);
                    if (audioJSON.source === 'File') {
                        guildData.audioPlayer = connection.play(`./cache/${audioJSON.filename}`);
                    } else {
                        guildData.audioPlayer = connection.play(`./cache/${audioJSON.id}.ogg`);
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
        youtubedl.exec(data.url, ['--format', 'bestaudio', '-x', '--audio-format', 'vorbis', '--audio-quality', '64K', '-o', './cache/%(id)s.unprocessed'], {}, function(err, output) {
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
    if (data.requester.nickname !== null && data.requester.nickname !== undefined) {
        embed.setDescription(`${data.requester.nickname} added a video to the queue`);
    } else {
        embed.setDescription(`${data.requester.user.username} added a video to the queue`);
    }
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
    if (data.requester.nickname !== null && data.requester.nickname !== undefined) {
        embed.setDescription(`Playing video requested by ${data.requester.nickname}`);
    } else {
        embed.setDescription(`Playing video requested by ${data.requester.user.username}`);
    }
    embed.setThumbnail(data.requester.user.avatarURL());
    embed.addField('Video', data.title);
    embed.addField('Uploader', data.uploader, true);
    embed.addField('Duration', require('format-duration')(data.duration * 1000), true);
    embed.setImage(data.thumbnail);
    embed.setURL(data.url);
    data.responsechnl.send(embed);
}

module.exports = AudioController;