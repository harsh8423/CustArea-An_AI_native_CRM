const OpenAI = require('openai');

const openai = new OpenAI();

/**
 * Streams chat completion from OpenAI.
 * @param {Array} messages - Array of message objects {role, content}.
 * @param {string} model - Model name (e.g., 'gpt-4o-mini').
 * @param {Function} onChunk - Callback for each chunk of content.
 * @param {Function} onComplete - Callback when stream completes.
 */
async function streamChatCompletion(messages, model, onChunk, onComplete) {
  try {
    const completion = await openai.chat.completions.create({
      model: model || 'gpt-4o-mini',

      messages: messages,
      stream: true,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
    if (onComplete) onComplete();
  } catch (error) {
    console.error('OpenAI Stream Error:', error);
    if (onChunk) onChunk(' [Error generating response] ');
    if (onComplete) onComplete();
  }
}

module.exports = { streamChatCompletion };
