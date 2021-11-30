require('dotenv').config(); //initialize dotenv
const Discord = require('discord.js'); //import discord.js
module.exports = (meme)=>{
    const client = new Discord.Client({intents: ["GUILDS", "GUILD_MESSAGES"]}); //create new client
    client.on('ready', () => {
      console.log(`Logged in as ${client.user.tag}!`);
    });

    client.on('messageCreate', msg => {
        if (msg.content.startsWith('.meme')) {
            let body = msg.content.replace('.meme', '').replace('.meme ', '');
            const image = msg.attachments.first().url;
            console.log(msg.author);
            meme(body.length?body:null,image, msg.author.id);
        }
    });
    
    //make sure this line is the last line
    client.login(process.env.CLIENT_TOKEN); //login bot using token
}
