const { Client, GatewayIntentBits, Partials } = require('discord.js');
const axios = require('axios');
const fs = require('fs');
const moment = require('moment-timezone');
require('dotenv').config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel]
});

const dataFile = 'chatData.json';

let chatData = {};
if (fs.existsSync(dataFile)) {
  chatData = JSON.parse(fs.readFileSync(dataFile));
} else {
  chatData = { count: 0, lastReset: moment().tz('America/Chicago').format('MMMM Do YYYY, h:mm:ss A') };
}

function resetChatCount() {
  const chicagoTime = moment().tz('America/Chicago');
  const currentDate = chicagoTime.format('YYYY-MM-DD');
  const lastResetDate = moment(chatData.lastReset, 'MMMM Do YYYY, h:mm:ss A').tz('America/Chicago').format('YYYY-MM-DD');

  if (currentDate !== lastResetDate) {
    chatData.count = 0;
    chatData.lastReset = chicagoTime.format('MMMM Do YYYY, h:mm:ss A');
    fs.writeFileSync(dataFile, JSON.stringify(chatData, null, 2));
    console.log('Chat count reset for the new day');
  }
}

setInterval(resetChatCount, 3600000);

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}`);
  updateStatus();
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (message.channel.id !== process.env.CHANNEL_ID) return;

  chatData.count++;
  fs.writeFileSync(dataFile, JSON.stringify(chatData, null, 2));
  updateStatus();

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [
          {
            role: 'user',
            content: message.content,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const reply = response.data.choices[0].message.content;
    message.reply(reply);
  } catch (error) {
    console.error('AI error:', error.response?.data || error.message);
    message.reply("Something went wrong with the AI. Please try again!");
  }
});

function updateStatus() {
  client.user.setPresence({
    activities: [{
      name: `${chatData.count} chats today`,
      type: 3
    }],
    status: 'online'
  });
}

client.login(process.env.DISCORD_TOKEN);
