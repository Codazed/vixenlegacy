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
        let user = args[0];
        let timeAmount = args[1];
        let timeType = args[2];
    }
};