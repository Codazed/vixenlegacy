const commando = require('discord.js-commando');

let botclient;
let timeTypes = ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'years'];

module.exports = class LoopCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'mute',
            aliases: ['mute'],
            group: 'moderation',
            memberName: 'mute',
            description: 'Mute user',
            details: `Mutes a user in text and voice channels for a specified amount of time`,
            guildOnly: true
        });
        botclient = client;
    }

    async run(msg, args) {
        let cmdArgs = args.split(" ");
        const query = botclient.vixen.db.prepare(`select * from '${msg.guild.id}' where id='muteRole'`).get();
        let muteRole;
        if (query) {
            muteRole = query.value;
        } else {
            msg.guild.roles.create({
                data: {
                    name: 'Muted',
                    color: 'GREY',
                    mentionable: false
                },
                reason: 'Muted role is required for use of the mute command'
            }).then(role => {
                muteRole = role;
                botclient.vixen.db.prepare(`insert into '${msg.guild.id}' (id, value) values ('muteRole', ?)`).run(muteRole.id);
                msg.guild.channels.cache.forEach(channel => {
                    channel.updateOverwrite(muteRole, {
                        ADD_REACTIONS: false,
                        SEND_MESSAGES: false,
                        CONNECT: false,
                        SPEAK: false
                    });
                });
            });
        }
        if (cmdArgs[0] && cmdArgs[1] && timeTypes.includes(cmdArgs[2])) {
            let moment = require('moment');
            let user = msg.guild.member(cmdArgs[0].replace(/[^A-Za-z0-9]/g, ''));
            let timeAmount = cmdArgs[1];
            let timeType = cmdArgs[2];

            let currentTime = moment();
            let muteEndTime = moment().add(timeAmount, timeType);
            let muted = botclient.vixen.db.prepare(`select * from muted where id=? and guild=?`).get(user.id, msg.guild.id);
            if (muted) {
                await msg.channel.send(`That user is already muted. The mute will expire ${moment.unix(muted.muteTimeEnd).fromNow()}.`);

            } else {
                botclient.vixen.db.prepare(`insert into muted (id, name, guild, guildName, muteTimeStart, muteTimeEnd) values (?, ?, ?, ?, ?, ?)`).run(user.id, user.user.username, msg.guild.id, msg.guild.name, currentTime.unix(), muteEndTime.unix());
                await msg.channel.send(`Muted user ${user.displayName} until ${moment.unix(muteEndTime.unix()).calendar()}.`);
            }

            await user.roles.add(muteRole);
            await user.voice.kick('User has been muted.');
        }
    }
};