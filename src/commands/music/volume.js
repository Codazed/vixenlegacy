const commando = require('discord.js-commando');

module.exports = class VolumeCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'volume',
            aliases: ['volume', 'vol'],
            group: 'music',
            memberName: 'volume',
            description: 'Adjust stream volume',
            details: `Adjusts volume for current audio stream and all future audio streams`,
        });
    }

    async run(msg, args) {
        let controller = this.client.vixen.audioController;
        let volargs = args.split(" ");
        if (volargs[0]) {
            let properValue = volargs[0]*0.01;
            controller.setVolume(msg.guild.id, properValue);
            msg.channel.send(`Set the volume to ${volargs[0]}%`);
        } else {
            let settings = controller.getSettings(msg.guild.id);
            msg.channel.send(`The volume is currently set to ${settings.volume*100}%`);
        }
    }
};