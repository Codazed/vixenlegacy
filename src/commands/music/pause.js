const commando = require('discord.js-commando');

module.exports = class PauseCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'pause',
            aliases: ['pause'],
            group: 'music',
            memberName: 'pause',
            description: 'Pause music',
            details: `Pauses/unpauses the currently playing music.`,
        });
    }

    async run(msg, args) {
        let status = this.client.vixen.audioController.pause(msg.guild.id);
        if (status) {
            await msg.channel.send('Paused');
        } else {
            await msg.channel.send('Resumed');
        }
    }
};