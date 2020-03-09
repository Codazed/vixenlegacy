const chalk = require('chalk');
const logger = require('loglevel');
const prefix = require('loglevel-plugin-prefix');
const Vixen = require('./vixen');
let client;

// Chalk colors
const colors = {
    DEBUG: chalk.cyan,
    INFO: chalk.blue,
    WARN: chalk.yellow,
    ERROR: chalk.red
};

prefix.reg(logger);
logger.enableAll();
prefix.apply(logger, {
    format(level, name, timestamp) {
        return `${chalk.gray(`[${timestamp}]`)} ${colors[level.toUpperCase()](level + ":")}`;
    }
});

class Client {
    constructor(db) {
        this.db = db;
        this.bot = new Vixen(this);
        client = this;
    }

    log(message, loglevel = 'info') {
        switch (loglevel.toLowerCase()) {
            case 'debug':
                logger.debug(message);
                break;
            case 'info':
                logger.info(message);
                break;
            case 'warn':
                logger.warn(message);
                break;
            case 'err':
                logger.error(message);
                break;
        }
    }

    runVixen() {
        this.bot.start();
    }

    exit() {
        process.exit(0);
    }
}

module.exports = Client;