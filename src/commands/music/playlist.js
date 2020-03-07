const commando = require('discord.js-commando');

module.exports = class PlaylistCommand extends commando.Command {
    constructor(client, vixen) {
        super (client, {
            name: 'playlist',
            aliases: ['playlist'],
            group: 'music',
            argsType: 'multiple',
            memberName: 'playlist',
            description: 'Manage playlists',
            details: `Contains the commands used to manage playlists.`,
        });
        this.vixen = vixen;
    }

    async run(msg, args) {
        if (args[0] === 'create') {
            console.log(JSON.stringify(this.vixen, "", " "));
            /*vixen.db.get(`${msg.guild.id}.${args[1]}`, (err, value) => {
                console.log(value);
            })*/
        }
    }
};