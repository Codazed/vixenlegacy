const fs = require('fs');
const path = require('path');
const level = require('level');
const inquirer = require('inquirer');

let db = level('db');

db.get('bot.token', function (err) {
    if (err) {
        if (err.notFound) {
            runSetup();
        }
    } else {
        const Client = require('./src/client');
        const client = new Client(db);
        client.runVixen();
    }
});

if (!fs.existsSync("./cache")) {
    fs.mkdirSync("./cache");
}

function runSetup() {
    console.log("Performing first-time setup...");
    let questions = [
        {
            type: "password",
            name: "bot.token",
            message: "What is my Discord bot token?",
            mask: "*"
        },
        {
            type: "input",
            name: "bot.prefix",
            message: "What should my command prefix be?",
            default: "/"
        },
        {
            type: "input",
            name: "bot.owner",
            message: "What is the Discord ID of the bot owner?"
        }
    ];

    inquirer.prompt(questions).then(answers => {
        db.put("bot.token", answers.bot.token, function (err) {
            if (err) return console.log('Ooops!', err);
            db.put("bot.prefix", answers.bot.prefix, function (err) {
                if (err) return console.log('Ooops!', err);
                db.put("bot.owner", answers.bot.owner, function (err) {
                    if (err) return console.log('Ooops!', err);
                    console.log("First-time setup completed! Vixen is now ready to be used.");
                    const Client = require('./src/client');
                    const client = new Client(db);
                    client.runVixen();
                })
            });
        });
    });
}