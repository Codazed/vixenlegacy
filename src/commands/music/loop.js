const commando = require('discord.js-commando');

module.exports = class LoopCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'loop',
            aliases: ['loop', 'repeat'],
            group: 'music',
            memberName: 'loop',
            description: 'Loop music',
            details: `Toggles loop on the currently playing music.`,
        });
    }

    async run(msg, args) {
        let status = this.client.vixen.audioController.toggleLoop(msg.guild.id);
        if (status) {
            await msg.channel.send('Loop enabled');
        } else {
            await msg.channel.send('Loop disabled');
        }
    }
};