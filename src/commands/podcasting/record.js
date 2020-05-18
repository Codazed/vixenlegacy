const commando = require('discord.js-commando');
const fs = require('fs');
const path = require('path');
const shell = require('any-shell-escape')
let client;

module.exports = class RecordCommand extends commando.Command {
    constructor(c) {
        super (c, {
            name: 'record',
            aliases: ['record', 'rec'],
            group: 'podcasting',
            memberName: 'record',
            description: 'Record voice chat',
            details: `Records audio for the voice chat the bot is in`,
        });
        client = c;
    }

    async run(msg, args) {
        if (!msg.member.voice.channel) {
            await msg.reply('You need to be in a voice channel to do that.');
        } else if (fs.existsSync(path.join('data', msg.guild.id, `record_${msg.member.voice.channelID}`))) {
            stop(msg.member.voice.channel, msg.channel);
            await msg.channel.send('Recording stopped.');
        } else {
            let members = msg.member.voice.channel.members;
            await msg.channel.send('For respect of privacy, I will need consent from all members of this voice channel to record the voice channel. I need every member currently in the voice channel to click the ✅ reaction on this message to consent. This request will timeout after 1 minute.')
                .then(consentMessage => {
                    consentMessage.react('✅');
                    const filter = (reaction, user) => reaction.emoji.name === '✅' && members.keyArray().includes(user.id);
                    const collector = consentMessage.createReactionCollector(filter, {time: 60000});
                    let consentSuccess = false;
                    collector.on('collect', r => {
                        r.users.cache.keyArray().includes(members.keyArray())
                        if (members.keyArray().every(v => r.users.cache.keyArray().includes(v))) {
                            consentSuccess = true;
                            collector.stop();
                        }
                    });
                    collector.on('end', collected => {
                        consentMessage.delete();
                        if (consentSuccess) {
                            msg.channel.send("All users in the voice channel have consented to audio recording. Recording will now commence.");
                            record(msg.member.voice.channel);
                        } else {
                            msg.channel.send("Request for audio recording consent timed out.");
                        }
                    });
                });
        }
    }
};

function record(channel) {
    let members = channel.members;
    let guildId = channel.guild.id;
    let savePath = path.join('data', guildId, `record_${channel.id}`);
    fs.mkdirSync(savePath);
    let recordInfo = {
        streams: []
    };
    channel.join()
        .then(connection => {
            connection.play(path.join('assets', 'beep.ogg'));
            // connection.voice.setSelfMute(true);
            members.forEach(member => {
                let readStream = connection.receiver.createStream(member.id, {mode: 'pcm', end: 'manual'});
                let writeStream = fs.createWriteStream(path.join(savePath, member.user.username));
                readStream.pipe(writeStream);
                recordInfo.streams.push({
                    'user': member.id,
                    'readStream': readStream,
                    'writeStream': writeStream
                });
            });
            client.vixen.recordings.set(channel.id, recordInfo);
        });
}

function stop(channel, textChannel) {
    textChannel.send(`${client.vixen.loadingEmojis.get(textChannel.guild.id)} Saving recording, please wait...`).then(msg => {
        let members = channel.members;
        let guildId = channel.guild.id;
        let savePath = path.join('data', guildId, `record_${channel.id}`);
        const connection = client.voice.connections.get(channel.guild.id);
        let recordInfo = client.vixen.recordings.get(channel.id);
        recordInfo.streams.forEach(stream => {
            stream.writeStream.close();
        });
        channel.leave();
        let files = fs.readdirSync(path.join('data', guildId, `record_${channel.id}`));
        const cp = require('child_process');
        const archiver = require('archiver');
        const archiveName = `recording_${require('moment')().format('YYYYMMDD-HHmmssZZ')}.zip`;
        const archivePath = path.join(savePath, archiveName);
        const output = fs.createWriteStream(archivePath);
        const archive = archiver('zip', {
            zlib: {level: 9}
        });
        archive.pipe(output);
        files.forEach((file, index) => {
            cp.execSync(`ffmpeg -f s32le -ar 48000 -i ${path.join(savePath, file)} ${path.join(savePath, file)}.mp3`);
            fs.unlinkSync(path.join(savePath, file));
            archive.file(path.join(savePath, `${file}.mp3`), { name: `${file}.mp3`});
        });
        archive.finalize();
        output.on('close', function() {
            msg.delete();
            textChannel.send(`Here's an archive of all the recorded audio tracks.`, {files: [{attachment: archivePath, name: archiveName}]}).then(() => {
                fs.rmdirSync(path.join(savePath), {recursive: true});
            });
        });
    });
}