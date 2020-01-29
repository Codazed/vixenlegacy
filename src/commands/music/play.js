const commando = require('discord.js-commando');
const ora = require('ora');
const oneLine = require('common-tags').oneLine;
const youtubedl = require('youtube-dl');
let botclient;
module.exports = class PlayCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'play-music',
            aliases: ['play'],
            group: 'music',
            memberName: 'play',
            description: 'Play music',
            details: oneLine`
                Play music from YouTube.             
            `,
            examples: ['play https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'play alan walker faded'],
            args: [
                {
                    key: 'query',
                    prompt: 'Enter YouTube link or search query.',
                    type: 'string'

                }
            ]
        });
        botclient = client;
    }

    async run(msg, args) {
        getVideoInfo(args.query, function(data) {
            let newdata = data;
            newdata.vc = msg.member.voice.channel;
            newdata.responsechnl = msg.channel;
            downloadVideo(newdata, function(data) {
                playVideo(newdata);
            });
        });
    }
};

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
            'duration': videoJSON.duration
        };
        getInfoSpinner.stop();
        callback(passData);
    });
}

function downloadVideo(data, callback) {
    const downloadVideoSpinner = ora(`Downloading video for query '${data.query}'`).start();
    youtubedl.exec(data.url, ['--format', 'bestaudio', '-x', '--audio-format', 'mp3', '--default-search', 'ytsearch', '-o', './cache/%(id)s.mp3'], {}, function(err, output) {
        if (err) throw err;
        downloadVideoSpinner.stop();
        callback();
    });
}

function playVideo(data) {
    if (data.vc !== undefined) {
        data.vc.join().then(connection => {
            botclient.dispatcher = connection.play(`./cache/${data.id}.mp3`);
        });
    }
}