const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios'); 
require('dotenv').config();

const app = express();
const port = process.env.PORT || 10000;

const lineConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

app.use((req, res, next) => {
  console.log(`[系統連線] 收到來自 ${req.path} 的請求`);
  next();
});

app.get('/', (req, res) => {
  res.send('上流白原創衣服 AI 客服已啟動！');
});

app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ Webhook 處理錯誤：', err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

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

    // 🚨 這裡加了 X 光機：檢查 Coze 是否偷偷回報錯誤
    if (cozeResponse.data.code !== 0) {
        console.error('Coze 內部錯誤:', cozeResponse.data.msg);
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `【系統透視】Coze 拒絕回答，原因是：${cozeResponse.data.msg}`
        });
    }

    const messages = cozeResponse.data.messages;
    let aiReplyText = "稍等一下喔，小幫手正在幫您確認款式...";
    
    if (messages && Array.isArray(messages)) {
        const aiAnswerObj = messages.find(msg => msg.type === 'answer');
        if (aiAnswerObj) {
            aiReplyText = aiAnswerObj.content;
        }
    }

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiReplyText
    });

  } catch (error) {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '目前客服線路有點滿，請稍後再試喔！'
    });
  }
}

app.listen(port, () => {
  console.log(`🚀 上流白伺服器已啟動`);
});
