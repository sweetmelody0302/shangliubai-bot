const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios'); 
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

// 設定 LINE 的鑰匙
const lineConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

app.get('/', (req, res) => { res.send('上流白原創衣服 AI 客服已啟動！'); });

app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') return Promise.resolve(null);

  const userMessage = event.message.text;
  const userId = event.source.userId;

  try {
    const cozeResponse = await axios.post('https://api.coze.com/open_api/v2/chat', {
      bot_id: process.env.BOT_ID,
      user: userId,
      query: userMessage,
      stream: false
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.COZE_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': '*/*'
      }
    });

    // 🚨 狀況一：Coze 直接報錯
    if (cozeResponse.data.code !== 0) {
        return client.replyMessage(event.replyToken, { 
            type: 'text', 
            text: `【系統透視】Coze 拒絕回答，原因：${cozeResponse.data.msg}` 
        });
    }

    const messages = cozeResponse.data.messages;
    
    // 🚨 狀況二：Coze 回傳了空盒子 (這就是你一直遇到「稍等一下」的元凶)
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return client.replyMessage(event.replyToken, { 
            type: 'text', 
            text: `【偵探模式】Coze 沒給內容！它到底傳了什麼鬼東西回來：\n${JSON.stringify(cozeResponse.data, null, 2)}` 
        });
    }

    // 🚨 狀況三：裡面沒有 answer 標籤
    const aiAnswerObj = messages.find(msg => msg.type === 'answer');
    if (!aiAnswerObj) {
        return client.replyMessage(event.replyToken, { 
            type: 'text', 
            text: `【偵探模式】找不到 AI 的話！裡面的內容是：\n${JSON.stringify(messages, null, 2)}` 
        });
    }

    // 🟢 狀況四：一切正常！把 AI 說的話傳回給 LINE 客戶
    return client.replyMessage(event.replyToken, { 
        type: 'text', 
        text: aiAnswerObj.content 
    });

  } catch (error) {
    return client.replyMessage(event.replyToken, { 
        type: 'text', 
        text: `【連線斷線】無法打給 Coze，錯誤代碼：${error.message}` 
    });
  }
}

app.listen(port, () => { console.log(`🚀 上流白伺服器已啟動`); });
