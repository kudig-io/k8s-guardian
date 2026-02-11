const axios = require('axios');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

// 对话历史
let chatHistory = [];

// 处理AI聊天
async function handleAIChat(query) {
  try {
    // 添加用户查询到对话历史
    chatHistory.push({ role: 'user', content: query });

    // 构建AI请求
    const response = await axios.post(
      process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的Kubernetes运维助手，擅长解决各种K8s集群问题。请提供详细、准确的运维建议和操作指导。'
          },
          ...chatHistory
        ],
        max_tokens: 1000,
        temperature: 0.7
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.AI_API_KEY || 'demo-key'}`
        }
      }
    );

    // 获取AI响应
    const aiResponse = response.data.choices[0].message.content;
    
    // 添加AI响应到对话历史
    chatHistory.push({ role: 'assistant', content: aiResponse });

    // 限制对话历史长度，避免过长
    if (chatHistory.length > 10) {
      chatHistory = chatHistory.slice(-10);
    }

    return aiResponse;
  } catch (error) {
    console.error('AI chat error:', error.message);
    return 'AI服务暂时不可用，请稍后重试。';
  }
}

// 重置对话历史
function resetChatHistory() {
  chatHistory = [];
}

module.exports = {
  handleAIChat,
  resetChatHistory
};