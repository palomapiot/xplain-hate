// Service worker: talks to the Ollama server on behalf of the content script.
// Doing the request here (instead of in the content script running on x.com)
// avoids mixed-content blocking (https page -> http server) and page CORS rules.
try {
  importScripts('config.js'); // generated from .env by scripts/generate-config.sh
} catch (e) {
  console.error('[xplain-hate] scripts/config.js is missing. Run scripts/generate-config.sh (see README).');
}

const HS_INSTRUCTION = `
You must explain why a social media message is hate or not and then tell me your decision. You must always reply with only a JSON containing one field 'hate_speech' including a Boolean value ("True" for hate speech messages, "False" for neutral ones); and a field 'explanations' containing a list with the each message phrase and its corresponding explanation. Do not include text outside the JSON.
This is the definition of hate speech: "language characterized by offensive, derogatory, humiliating, or insulting discourse that promotes violence, discrimination, or hostility towards individuals or groups based on attributes such as race, religion, ethnicity, or gender".

The input format is:
    Generate step-by-step explanation for:\n<Message><input query></Message>.
The output format is:
    {
        "hate_speech": "<Boolean>",
        "explanations": [
            {
                "input": "<input query phrase 1>",
                "explanation": "<input query 1 phrase step-by-step explanation>"
            },
            {
                "input": "<input query phrase 2>",
                "explanation": "<input query 2 phrase step-by-step explanation>"
            }
        ]
    }
Generate step-by-step explanation for:`;

function parseModelJson(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('Model did not return JSON');
    return JSON.parse(text.slice(start, end + 1));
  }
}

async function analyze(text) {
  if (typeof XPLAIN_CONFIG === 'undefined') {
    throw new Error('Missing scripts/config.js. Run scripts/generate-config.sh');
  }
  const res = await fetch(`${XPLAIN_CONFIG.OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: XPLAIN_CONFIG.OLLAMA_MODEL,
      stream: false,
      format: 'json',
      messages: [{ role: 'user', content: `${HS_INSTRUCTION}<Message>${text}</Message>` }],
      options: { temperature: 0.01, top_p: 0.1, top_k: 5, num_predict: 2048 }
    })
  });
  if (!res.ok) {
    throw new Error(`Ollama returned ${res.status} ${res.statusText}. ` +
      (res.status === 403 ? 'Start Ollama with OLLAMA_ORIGINS="chrome-extension://*". ' : '') +
      (res.status === 404 ? `Is the model "${XPLAIN_CONFIG.OLLAMA_MODEL}" created? ` : ''));
  }
  const body = await res.json();
  return parseModelJson(body.message.content);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === 'xplain-analyze') {
    analyze(msg.text)
      .then(data => sendResponse({ ok: true, data }))
      .catch(err => sendResponse({ ok: false, error: String(err.message || err) }));
    return true; // keep the channel open for the async response
  }
});
