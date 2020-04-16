const fs = require('fs');
const chalk = require('chalk');
const commando = require('discord.js-commando');
const ora = require('ora');
const youtubedl = require("youtube-dl");

let botclient;

module.exports = class PlaylistCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'playlist',
            aliases: ['playlist'],
            group: 'music',
            argsType: 'multiple',
            memberName: 'playlist',
            description: 'Manage playlists',
            details: `Contains the commands used to manage playlists.`,
        });
        botclient = client;
    }

    async run(msg, args) {
        let datadir = `./data/${msg.guild.id}`;
        if (!fs.existsSync(`${datadir}/playlists`)) {
            fs.mkdirSync(`${datadir}/playlists`);
        }

        // Create new empty playlist
        if (args[0] === 'create') {
            let playlistName = args[1];
            if (playlistExists(msg, playlistName)) {
                await msg.channel.send(`A playlist with the name \`${playlistName}\` already exists!`);
            } else {
                createNewPlaylist(msg, playlistName);
                await msg.channel.send(`Playlist \`${playlistName}\` successfully created. Add things to it with ${this.client.commandPrefix}playlist add ${playlistName} \`video url\``);
            }
        }

        // Delete playlist
        else if (args[0] === 'delete') {
            let playlistName = args[1];
            if (!playlistExists(msg, playlistName)) {
                await msg.channel.send(`A playlist with the name \`${playlistName}\` does not exist!`);
            } else {
                fs.unlinkSync(`${datadir}/playlists/${playlistName}.json`);
                this.client.vixen.log(`${chalk.gray(`(${msg.guild.id})`)} Deleted playlist ${chalk.cyan(playlistName)}`);
                await msg.channel.send(`Playlist \`${playlistName}\` was successfully deleted.`);
            }
        }

        // Add items to a playlist
        else if (args[0] === 'add') {
            let playlistName = args[1];
            if (!playlistExists(msg, playlistName)) {
                createNewPlaylist(msg, playlistName);
            }
            let videoUrl = args[2];
            if (require('youtube-regex')().test(videoUrl)) {
                let playlist = getPlaylist(msg, playlistName);
                playlist.size++;
                getVideoInfo(videoUrl, function(data) {
                    playlist.videos.push(data);
                    writePlaylist(msg, playlistName, playlist);
                    botclient.vixen.log(`${chalk.gray(`(${msg.guild.id})`)} Added ${chalk.yellow(videoUrl)} to playlist ${chalk.cyan(playlistName)}`);
                    msg.channel.send(`Added \`${videoUrl}\` to playlist \`${playlistName}\`.`);
                });
            }
        }

        // Remove items from a playlist
        else if (args[0] === 'remove') {
            let playlistName = args[1];
            if (!playlistExists(msg, playlistName)) {
                await msg.channel.send(`A playlist with the name \`${playlistName}\` does not exist!`);
            }
            let videoUrl = args[2];
            if (require('youtube-regex')().test(videoUrl)) {
                let videoid = require('get-video-id')(videoUrl);
                let playlist = getPlaylist(msg, playlistName);
                let newvids = [];
                playlist.videos.forEach((item) => {
                    if (item.id !== videoid) {
                        newvids.push(item);
                    }
                });
                playlist.videos = newvids;
                playlist.size = newvids.length;
                writePlaylist(msg, playlistName, playlist);
                botclient.vixen.log(`${chalk.gray(`(${msg.guild.id})`)} Removed all instances of ${chalk.yellow(videoUrl)} from playlist ${chalk.cyan(playlistName)}`);
                await msg.channel.send(`Removed all instances of \`${videoUrl}\` from playlist \`${playlistName}\`.`);
            }
        }

        // Import playlist from YouTube
        else if (args[0] === 'import') {
            let playlistUrl = args[1];
            let playlistName = args[2];
            if (playlistExists(msg, playlistName)) {
                await msg.channel.send(`A playlist with the name \`${playlistName}\` already exists!`);
            } else {
                let loadMsg;
                msg.channel.send(`${botclient.vixen.loadingEmojis.get(msg.guild.id)} Fetching playlist information...`).then(msg => {
                    loadMsg = msg;
                });
                youtubedl.exec(playlistUrl, ['--default-search', 'ytsearch', '--dump-json', '--skip-download', '--flat-playlist'], {}, function(err, output) {
                    if (err) throw err;
                    let rawJSON = JSON.parse(`{"videos": [${output.toString()}]}`);
                    getPlaylistVideos(loadMsg, rawJSON, [], function(data) {
                        let playlist = {
                            'name': playlistName,
                            'creator': msg.author.id,
                            'size': data.length,
                            'videos': data
                        };
                        writePlaylist(msg, playlistName, playlist);
                        loadMsg.delete();
                        msg.channel.send(`Playlist \`${playlistUrl}\` successfully imported to playlist with the name \`${playlistName}\``);
                    });
                });
            }
        }

        // Export playlist JSON to Discord
        else if (args[0] === 'export') {
            let playlistName = args[1];
            if (!playlistExists(msg, playlistName)) await msg.channel.send(`A playlist with the name \`${playlistName}\` does not exist!`);
            else {
                await msg.channel.send(`Here is the JSON file for the playlist \`${playlistName}\`. Do with it what you will.`, {files: [{
                    attachment: `./data/${msg.guild.id}/playlists/${playlistName}.json`,
                    name: `${playlistName}.json`
                    }]});
            }
        }

        // Play playlist in order
        else if (args[0] === 'play') {
            let playlistName = args[1];
            if (!playlistExists(msg, playlistName)) await msg.channel.send(`A playlist with the name \`${playlistName}\` does not exist!`);
            else {
                queuePlaylist(msg, getPlaylist(msg, playlistName), false);
            }
        }

        // Play playlist in random order
        else if (args[0] === 'mix' || args[0] === 'shuffle') {
            let playlistName = args[1];
            if (!playlistExists(msg, playlistName)) await msg.channel.send(`A playlist with the name \`${playlistName}\` does not exist!`);
            else {
                queuePlaylist(msg, getPlaylist(msg, playlistName), true);
            }
        }

        // Lists all playlists on a guild
        else if (args[0] === 'list') {
            let datadir = `./data/${msg.guild.id}/playlists`;
            let playlists = [];
            fs.readdirSync(datadir).forEach(file => {
                playlists.push(file);
            });
            let playlistsData = [];
            playlists.forEach(item => {
                let name = item.replace('.json', '');
                playlistsData.push(getPlaylist(msg, name));
            });
        }

    }
};

function createNewPlaylist(msg, playlistName) {
    let datadir = `./data/${msg.guild.id}`;
    let playlistInfo = {
        'name': playlistName,
        'creator': msg.author.id,
        'size': 0,
        'videos': []
    };
    fs.writeFileSync(`${datadir}/playlists/${playlistName}.json`, JSON.stringify(playlistInfo, "", " "));
    botclient.vixen.log(`${chalk.gray(`(${msg.guild.id})`)} Playlist ${chalk.cyan(playlistName)} created`);
}

function getPlaylist(msg, playlistName) {
    let datadir = `./data/${msg.guild.id}`;
    let playlist = fs.readFileSync(`${datadir}/playlists/${playlistName}.json`, 'utf8');
    return JSON.parse(playlist);
}

function playlistExists(msg, playlistName) {
    let datadir = `./data/${msg.guild.id}`;
    return fs.existsSync(`${datadir}/playlists/${playlistName}.json`);
}

function writePlaylist(msg, playlistName, newData) {
    let datadir = `./data/${msg.guild.id}`;
    fs.writeFileSync(`${datadir}/playlists/${playlistName}.json`, JSON.stringify(newData, "", " "));
}

function getPlaylistVideos(loadMsg, rawJSON, playlistJSON=[], callback) {
    let video = rawJSON.videos.shift();
    loadMsg.edit(`${botclient.vixen.loadingEmojis.get(loadMsg.guild.id)} Retrieving information for video ${playlistJSON.length + 1}/${playlistJSON.length + 1 + rawJSON.videos.length}: \`${video.title}\`. This will take a moment...`);
    getVideoInfo(`https://youtube.com/watch?v=${video.id}`, function(data) {
        playlistJSON.push(data);
        if (rawJSON.videos.length > 0) getPlaylistVideos(loadMsg, rawJSON, playlistJSON, callback);
        else callback(playlistJSON);
    });
}

function queuePlaylist(msg, playlist, shuffle) {
    let playlistVideos = playlist.videos;
    if (shuffle) playlistVideos = require('knuth-shuffle-seeded')(playlistVideos);
    // Check if first video in queue is downloaded
    let first = playlistVideos.shift();
    let newData = first;
    newData.vc = msg.member.voice.channel;
    newData.responsechnl = msg.channel;
    newData.requester = msg.member;
    function queueRest() {
        playlistVideos.forEach((item) => {
            newData = item;
            newData.vc = msg.member.voice.channel;
            newData.responsechnl = msg.channel;
            newData.requester = msg.member;
            botclient.vixen.audioController.queue(msg.guild.id, item);
        });
        botclient.vixen.audioController.checkQueue(msg.guild.id);
    }
    if (fs.existsSync(`./cache/${first.id}.ogg`)) {
        botclient.vixen.audioController.play(newData.requester.guild.id, newData);
        queueRest();
    } else {
        downloadVideo(newData, function(data) {
            botclient.vixen.audioController.play(newData.requester.guild.id, newData);
            queueRest();
        });
    }
}

function getVideoInfo(query, callback) {
    const getInfoSpinner = ora(`Fetching info for query '${query}'...`).start();
    youtubedl.exec(query, ['--default-search', 'ytsearch', '--dump-json', '--skip-download'], {}, function(err, output) {
        if (err) throw err;
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
        getInfoSpinner.stop();
        callback(passData);
    });
}

function downloadVideo(data, callback) {
    const downloadVideoSpinner = ora(`Downloading '${data.title}'`).start();
    youtubedl.exec(data.url, ['--format', 'bestaudio', '-x', '--audio-format', 'vorbis', '--audio-quality', '64K', '-o', './cache/%(id)s.unprocessed'], {}, function(err, output) {
        if (err) throw err;
        downloadVideoSpinner.stop();
        callback();
    });
}