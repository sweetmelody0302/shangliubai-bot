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

app.get('/', (req, res) => { res.send('上流白終極高情商 AI (老闆免標註版) 已啟動！'); });

app.post('/webhook', line.middleware(lineConfig), (req, res) => {
  Promise.all(req.body.events.map(handleEvent)).then((result) => res.json(result)).catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  const userId = event.source.userId;

  // 🚨 隱形側錄器
  if (event.type === 'message' && event.message.type === 'text') {
      console.log(`【X光側錄】有人說話了！內容：「${event.message.text}」 -> 他的真實 ID 是：${userId}`);
  }

  // 🔑 萬能抓 ID 專用開關
  if (event.type === 'message' && event.message.type === 'text') {
      const checkText = event.message.text.trim().toLowerCase();
      if (checkText === '我的id') {
          return client.replyMessage(event.replyToken, { 
              type: 'text', 
              text: `老闆您好！您的專屬 ID 鑰匙是：\n${userId}\n\n(請把這串代碼複製交給管理員喔！)` 
          });
      }
  }
  
  // 👑 讀取老闆娘與「老闆群」的名單
  const bossLadyId = process.env.BOSS_LADY_USER_ID || '';
  const bossIdsString = process.env.BOSS_USER_IDS || '';
  const bossIdsArray = bossIdsString.split(',').map(id => id.trim());
  const isBossTeam = (userId === bossLadyId || bossIdsArray.includes(userId));

  // 📸 處理圖片訊息
  if (event.type === 'message' && event.message.type === 'image') {
      try {
          let finalReply = "";
          if (isBossTeam) {
              finalReply = "哇！老闆團隊又釋出超美的新款啦？😍 三十年的原創工藝，數量有限喔！\n喜歡的朋友趕快在群組「喊單」或 Tag 老闆娘📞約面交！大家也可以直接去官方賣場尋寶👇\nhttps://liff.line.me/1657479438-ZMYpzMaY/shops/@853dubav";
          } else {
              finalReply = "哇！這張照片拍得真好😍！大家今天過得好嗎？如果對我們家的服飾有任何問題，隨時可以呼叫小幫手喔🤍";
          }
          return client.replyMessage(event.replyToken, { type: 'text', text: finalReply });
      } catch (error) {
          return client.replyMessage(event.replyToken, { type: 'text', text: '哈囉！小幫手的眼睛目前有點酸😴，麻煩您用文字告訴我喔！' });
      }
  }

  // 📝 處理文字訊息
  if (event.type !== 'message' || event.message.type !== 'text') return Promise.resolve(null);
  const userMessage = event.message.text;

  // 🛡️ 群組過濾器
  if (event.source.type === 'group' || event.source.type === 'room') {
      const keywords = ['小幫手', '衣服', '外套', '上流白', '尺寸', '褲子', '賣場', '怎麼買', '多少錢', '早安', '午安', '晚安', '哈囉', '老闆', '老闆娘', '去找你', '店裡', '面交', '自取', '擺攤'];
      if (!keywords.some(keyword => userMessage.includes(keyword))) {
          return Promise.resolve(null); 
      }
  }

  // 🧠 呼叫 Coze 大腦
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

    if (cozeResponse.data.code !== 0) return Promise.resolve(null);
    const messages = cozeResponse.data.messages;
    if (!messages || !Array.isArray(messages) || messages.length === 0) return Promise.resolve(null);
    const aiAnswerObj = messages.find(msg => msg.type === 'answer');
    if (!aiAnswerObj) return Promise.resolve(null);

    // ==========================================
    // 🌟 終極 VIP 點名邏輯：老闆免標註，客人要標註
    // ==========================================
    if (isBossTeam) {
        // 如果是老闆團隊，就低調回覆，不標註也不加引用框
        return client.replyMessage(event.replyToken, { 
            type: 'text', 
            text: aiAnswerObj.content 
        });
    } else {
        // 如果是一般客人，就去查名字、標註他並加上引用框
        let displayName = "貴賓";
        try {
            if (event.source.type === 'group') {
                const profile = await client.getGroupMemberProfile(event.source.groupId, userId);
                displayName = profile.displayName;
            } else if (event.source.type === 'room') {
                const profile = await client.getRoomMemberProfile(event.source.roomId, userId);
                displayName = profile.displayName;
            } else {
                const profile = await client.getProfile(userId);
                displayName = profile.displayName;
            }
        } catch (err) {
            console.log('無法取得暱稱，使用預設值');
        }

        const mentionText = `@${displayName} `; 
        const finalReplyText = `${mentionText}\n${aiAnswerObj.content}`;

        return client.replyMessage(event.replyToken, {
            type: 'text',
            text: finalReplyText,
            quoteToken: event.message.quoteToken, // 產生灰色的「引用舊訊息」框框
            mention: {
                mentionees: [{
                    index: 0, 
                    length: mentionText.trim().length, 
                    type: 'user',
                    userId: userId
                }]
            }
        });
    }
    // ==========================================

  } catch (error) { return Promise.resolve(null); }
}

app.listen(port, () => { console.log(`🚀 上流白伺服器已啟動`); });
