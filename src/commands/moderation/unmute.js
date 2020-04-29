const commando = require('discord.js-commando');

let botclient;

module.exports = class UnmuteCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'unmute',
            aliases: ['unmute'],
            group: 'moderation',
            memberName: 'unmute',
            description: 'Unmute a muted user',
            details: `Unmutes a user if they are currently muted`,
            guildOnly: true
        });
        botclient = client;
    }

    async run(msg, args) {
        let cmdArgs = args.split(" ");
        if (cmdArgs[0]) {
            let user = msg.guild.member(cmdArgs[0].replace(/[^A-Za-z0-9]/g, ''));
            let muted = botclient.vixen.db.prepare(`select * from muted where id=? and guild=?`).get(user.id, msg.guild.id);
            if (muted) {
                const query = botclient.vixen.db.prepare(`select * from '${msg.guild.id}' where id='muteRole'`).get();
                let muteRole = query.value;
                await user.roles.remove(muteRole, `Manually unmuted by ${msg.author.tag}`);
                botclient.vixen.db.prepare(`delete from muted where id=? and guild=?`).run(user.id, msg.guild.id);
                let nickname = '';
                if (user.nickname !== null) nickname = `Nickname: ${user.nickname}, `;
                await msg.channel.send(`User \`${user.user.tag} (${nickname}ID: ${user.id})\` manually unmuted.`);
            } else {
                let nickname = '';
                if (user.nickname !== null) nickname = `Nickname: ${user.nickname}, `;
                await msg.channel.send(`User \`${user.user.tag} (${nickname}ID: ${user.id})\` is not muted.`);
            }
        }
    }
};