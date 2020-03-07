const commando = require('discord.js-commando');

module.exports = class StopCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'stop',
            aliases: ['stop'],
            group: 'music',
            memberName: 'stop',
            description: 'Stop music',
            details: `Stops the currently playing music.`,
        });
    }

    async run(msg, args) {
        this.client.vixen.audioController.stop(msg.guild.id);
    }
};