const express = require('express');
const line = require('@line/bot-sdk');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// 設定 LINE 的鑰匙
const lineConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

app.get('/', (req, res) => { res.send('抓 ID 模式啟動！'); });

app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  // 只要不是文字就不理它
  if (event.type !== 'message' || event.message.type !== 'text') return Promise.resolve(null);

  const userMessage = event.message.text;
  const userId = event.source.userId;

  // 🚨 大絕招：只要有人打「我的ID」，就直接把亂碼印給他看！
  if (userMessage === '我的ID') {
      return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `您的專屬 ID 鑰匙是：\n${userId}`
      });
  }

  // 打其他的字就提醒他
  return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `請輸入「我的ID」，讓我幫您把身分證字號找出來喔！`
  });
}

app.listen(port, () => { console.log(`🚀 抓 ID 伺服器啟動`); });
