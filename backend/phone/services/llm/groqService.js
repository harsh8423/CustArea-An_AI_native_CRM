const Groq = require('groq-sdk');

const groq = new Groq();

/**
 * Streams chat completion from Groq.
 * @param {Array} messages - Array of message objects {role, content}.
 * @param {string} model - Model name (e.g., 'llama-3.1-8b-instant').
 * @param {Function} onChunk - Callback for each chunk of content.
 * @param {Function} onComplete - Callback when stream completes.
 */
async function streamChatCompletion(messages, model, onChunk, onComplete) {
  try {
    const completion = await groq.chat.completions.create({
      messages: messages,
      model: 'openai/gpt-oss-20b',
      stream: true,
      temperature: 0.5,
      max_completion_tokens: 1024,
      top_p: 1,
      stop: null,
    });

    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        onChunk(content);
      }
    }
    if (onComplete) onComplete();
  } catch (error) {
    console.error('Groq Stream Error:', error);
    if (onChunk) onChunk(' [Error generating response] ');
    if (onComplete) onComplete();
  }
}

/**
 * Gets a complete chat completion from Groq (non-streaming).
 * @param {Array} messages - Array of message objects {role, content}.
 * @param {string} model - Model name (optional).
 * @returns {Promise<string>} - The generated response text.
 */
async function getChatCompletion(messages, model = 'llama-3.1-8b-instant') {
  try {
    const completion = await groq.chat.completions.create({
      messages: messages,
      model: model,
      stream: false,
      temperature: 0.5,
      max_completion_tokens: 1024,
      top_p: 1,
      stop: null,
    });
    return completion.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Groq Completion Error:', error);
    return 'I apologize, but I encountered an error processing your request.';
  }
}

module.exports = { streamChatCompletion, getChatCompletion };
