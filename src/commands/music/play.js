const commando = require('discord.js-commando');
const fs = require('fs');
const ora = require('ora');
const oneLine = require('common-tags').oneLine;
const youtubedl = require('youtube-dl');
let botclient;
let vixen;
let controller;
let playingBar;
let nowPlaying;
let nowPlayingElapsed = 0;
module.exports = class PlayCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'play',
            aliases: ['play'],
            group: 'music',
            memberName: 'play',
            description: 'Play music',
            details: oneLine`
                Play music from YouTube.             
            `,
            examples: ['play https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'play alan walker faded']
        });
        botclient = client;
    }

    async run(msg, args) {
        controller = botclient.vixen.audioController;
        vixen = botclient.vixen;
        if (msg.attachments.size > 0) {
            let attachment = msg.attachments.first();
            if (attachment.name.endsWith('.mp3') || attachment.name.endsWith('.wav') || attachment.name.endsWith('.ogg')) {
                require('download')(attachment.url, './cache').then(() => {
                    require('music-metadata').parseFile(`./cache/${attachment.name}`)
                        .then(metadata => {
                            let data = {
                                'query': 'file',
                                'title': metadata.common.title,
                                'uploader': metadata.common.artist,
                                'url': attachment.url,
                                'filename': attachment.name,
                                'thumbnail': null,
                                'duration': metadata.format.duration,
                                'source': 'File'
                            };
                            data.vc = msg.member.voice.channel;
                            data.responsechnl = msg.channel;
                            data.requester = msg.member;
                            playVideo(data);
                        });
                })
            } else {
                await msg.channel.send('Sorry, I can only play mp3, wav, and ogg files right now.');
            }
        } else {
            let loadMsg;
            msg.channel.send(`${vixen.loadingEmojis.get(msg.guild.id)} Fetching info for query \`${args}\``).then(msg => {
                loadMsg = msg;
            });
            controller.getVideoInfo(args, function(err, data) {
                if (err) {
                    loadMsg.delete();
                    msg.channel.send(`Error: No videos found for \`${args}\` that are within the set duration limit of ${controller.getMaxDuration()} seconds. Please try another query.`);
                } else {
                    let newData = data;
                    newData.vc = msg.member.voice.channel;
                    newData.responsechnl = msg.channel;
                    newData.requester = msg.member;
                    loadMsg.edit(`${vixen.loadingEmojis.get(msg.guild.id)} Downloading '${newData.title}'`);
                    if (fs.existsSync(`./cache/${newData.id}.ogg`)) {
                        loadMsg.delete();
                        playVideo(newData);
                    } else {
                        downloadVideo(newData, function(data) {
                            loadMsg.delete();
                            playVideo(newData);
                        });
                    }
                }
            });
        }
    }
};

function downloadVideo(data, callback) {
    const downloadVideoSpinner = ora(`Downloading '${data.title}'`).start();
    youtubedl.exec(data.url, ['--format', 'bestaudio', '-x', '--audio-format', 'vorbis', '--audio-quality', '64K', '-o', './cache/%(id)s.unprocessed'], {}, function(err, output) {
        if (err) throw err;
        downloadVideoSpinner.stop();
        callback();
    });
}

function playVideo(data) {
    controller.play(data.requester.guild.id, data);
    /*if (botclient.audioPlaying) {
        function queue() {
            botclient.playQueue.push(data);
            sendQueueEmbed(data);
        }
        if (botclient.loopEnabled) {
            data.responsechnl.send("Warning: Loop is enabled for the currently playing video.").then(() => setTimeout(queue, 2000));
        } else queue();
    } else {
        if (data.vc !== undefined) {
            data.vc.join().then(connection => {
                connection.voice.setSelfDeaf(true);
                if (data.source === 'File') {
                    botclient.audioPlayer = connection.play(`./cache/${data.filename}`);
                } else {
                    botclient.audioPlayer = connection.play(`./cache/${data.id}.ogg`);
                }
                nowPlaying = data;
                sendNPEmbed(data);
                botclient.audioPlaying = true;
                botclient.audioPlayer.on('finish', () => {
                    botclient.audioPlaying = false;
                    if (botclient.loopEnabled) {
                        playVideo(data);
                    } else {
                        if (data.source === 'File') {
                            fs.unlinkSync(`./cache/${data.filename}`);
                        }
                        if (botclient.playQueue.length <= 0) {
                            data.responsechnl.send("Queue is empty. Disconnecting.").then(() => data.vc.leave());
                        } else {
                            let nextVideo = botclient.playQueue.shift();
                            playVideo(nextVideo);
                        }
                    }
                });
            });
        }
    }*/
}

function getQueueDuration() {
    let queueTil = controller.playQueue.slice();
    queueTil.pop();
    let totalDuration = nowPlaying.duration;
    queueTil.forEach(video => {
        totalDuration += video.duration;
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
    embed.addField('ETA', `Less than ${require('format-duration')(getQueueDuration() * 1000)}`, true);
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