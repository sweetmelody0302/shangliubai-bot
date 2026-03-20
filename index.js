const express = require('express');
const line = require('@line/bot-sdk');
const axios = require('axios'); 
require('dotenv').config();

const app = express();
// Zeabur 會自己分配 Port，如果沒有就用 10000
const port = process.env.PORT || 10000;

// 1. 設定 LINE 的鑰匙
const lineConfig = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};
const client = new line.Client(lineConfig);

// 2. 監視器 (讓你知道有誰來敲門)
app.use((req, res, next) => {
  console.log(`[系統連線] 收到來自 ${req.path} 的請求`);
  next();
});

// 3. 測試首頁
app.get('/', (req, res) => {
  res.send('上流白原創衣服 AI 客服已啟動！');
});

// 4. LINE 專屬接收通道
app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error('❌ Webhook 處理錯誤：', err);
      res.status(500).end();
    });
});

// 5. 核心大腦邏輯
async function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text;
  const userId = event.source.userId;
  console.log(`📩 客戶詢問: ${userMessage}`);

  try {
    // 打電話給 Coze (使用 v2 直通車)
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

    const messages = cozeResponse.data.messages;
    let aiReplyText = "稍等一下喔，小幫手正在幫您確認款式...";

    if (messages && Array.isArray(messages)) {
        const aiAnswerObj = messages.find(msg => msg.type === 'answer');
        if (aiAnswerObj) {
            aiReplyText = aiAnswerObj.content;
        }
    }

    // 把 AI 說的話傳回給 LINE 客戶
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: aiReplyText
    });

  } catch (error) {
    console.error('❌ 呼叫 Coze 失敗：', error.message);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '目前客服線路有點滿，請稍後再試喔！'
    });
  }
}

app.listen(port, () => {
  console.log(`🚀 上流白伺服器已啟動`);
});
