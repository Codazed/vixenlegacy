const commando = require('discord.js-commando');

module.exports = class SkipCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'skip',
            aliases: ['skip', 'next'],
            group: 'music',
            memberName: 'skip',
            description: 'Skip music',
            details: `Skips the currently playing music.`,
        });
    }

    async run(msg, args) {
        this.client.vixen.audioController.skip(msg.guild.id);
    }
};