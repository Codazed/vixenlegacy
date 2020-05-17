const commando = require('discord.js-commando');
const fs = require('fs');
const path = require('path');

module.exports = class CacheCommand extends commando.Command {
    constructor(client) {
        super (client, {
            name: 'cache',
            aliases: ['cache'],
            group: 'admin',
            memberName: 'cache',
            description: 'Audio cache management',
            details: `Commands for managing audio cache`,
        });
    }

    async run(msg, arg) {
        if (arg === 'clear' || arg === 'clean') {
            let files = fs.readdirSync('cache');
            files.forEach(file => {
                fs.unlinkSync(path.join('cache', file));
            });
            await msg.channel.send(`Cleared the audio cache.`);
        } else if (arg === 'info') {
            let totalSize = 0;
            let numFiles = 0;
            let files = fs.readdirSync('cache');
            files.forEach(file => {
                totalSize += fs.statSync(path.join('cache', file)).size;
                numFiles++;
            });
            let humanTotalSize = require('filesize')(totalSize);
            await msg.channel.send(`There are ${numFiles} files in the audio cache totaling ${humanTotalSize}.`);
        }
    }
};