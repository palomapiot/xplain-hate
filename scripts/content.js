Promise.all([
    fetch(chrome.runtime.getURL('styles/style.css')).then(res => res.text())
]).then(styles => {
    setTimeout(() => {
        for(let css of styles) {
            let style = document.createElement('style');
            let head = document.head || document.getElementsByTagName('head')[0];
            let isFirefox = navigator.userAgent.indexOf('Firefox') > -1;
            if(isFirefox) css = css.replaceAll('chrome-extension://', 'moz-extension://');
            style.innerHTML = css.replaceAll('__MSG_@@extension_id__', chrome.runtime.id);
            head.appendChild(style);
        }
    }, 750);
});

function analyze(text) {
    // The request is made by the background service worker (see background.js)
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({type: 'xplain-analyze', text}, (res) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (!res || !res.ok) return reject(new Error((res && res.error) || 'No response from background worker'));
            resolve(res.data);
        });
    });
}

function highlight(node, part, explanation, color) {
    const regex = new RegExp(`\\b(${part})\\b`, 'gi');
    console.log(node);
    if (node.nodeType === 3) { // Text node
      console.log("looking for " + part + " in ");
      console.log(node);

      const parent = node.parentNode;
      if (!parent) return;

      const frag = document.createDocumentFragment();
      const text = node.textContent;
      let lastIndex = 0;

      console.log("replace...");
      text.replace(regex, (match, p1, offset) => {
        console.log("replace in...");
        frag.appendChild(document.createTextNode(text.slice(lastIndex, offset)));

        const span = document.createElement("span");
        span.textContent = match;
        span.classList.add("hate-highlight")
        span.style.cursor = "pointer";
        span.classList.add("hate-explanation-popup");
        span.setAttribute("data-hate-explanation", explanation);
        frag.appendChild(span);

        lastIndex = offset + match.length;
        return match;
      });

      frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      parent.replaceChild(frag, node);
    } else if (node.nodeType === 1 && node.nodeName !== "SCRIPT" && node.nodeName !== "STYLE") {
      Array.from(node.childNodes).forEach((element) => highlight(element, part, explanation, color));
    }
}

const colors = ['blue', 'red', 'yellow', 'black', 'gray', 'green', 'purple', 'brown', 'royalblue', 'cyan', 'white']

function hookIntoTweets() {
    let tweets = document.getElementsByTagName('article');

    for (let i = 0; i < tweets.length; i++) {
        let tweet = tweets[i];
      
        if(tweet.dataset.analyzeAdded) continue;
        tweet.dataset.analyzeAdded = true;

        let textNode = tweet.querySelector('div[data-testid="tweetText"]');
        let text = textNode.innerText;

        let div = document.createElement('div');
        let button = document.createElement('button');
        button.addEventListener('click', async () => {
            if(!button.classList.contains('analyzed')) {
                button.querySelector('.yeah-image').src = chrome.runtime.getURL('images/xplain.png');
                button.classList.add('analyzed');

                // call analyze api with text
                analyze(text).then(data => {
                    console.log("Response:", data);
                    // draw result + explanations
                    if (String(data.hate_speech).toLowerCase() === "true") {
                        tweet.parentElement.classList.remove('hate-free-content');
                        tweet.parentElement.classList.add('hateful-content');
                        (data.explanations || []).forEach((explanation, i) => textNode.childNodes.forEach((element) => highlight(element, explanation.input, explanation.explanation, colors[i % 10])));
                    } else {
                        tweet.parentElement.classList.add('hate-free-content');
                        tweet.parentElement.classList.remove('hateful-content');
                    }
                    
                }).catch(error => {
                    console.error("[xplain-hate]", error);
                    button.classList.remove('analyzed');
                });
            } else {
                // already analyzed
            }
        });
        // analyze keyboard shortcut (a)
        //tweet.addEventListener("keydown", (e) => {
        //    if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        //    if(e.key === "a") button.click();
        //});
        button.addEventListener('mouseover', () => {
            button.querySelector('.yeah-image').src = chrome.runtime.getURL('images/xplain.png');
        });
        button.addEventListener('mouseout', () => {
            if(!button.classList.contains('analyzed')) button.querySelector('.yeah-image').src = chrome.runtime.getURL('images/xplain-off.png');
        });
        button.className = `yeah-button`;
        div.className = 'yeah-button-container';

        let img = document.createElement('img');
        img.src = chrome.runtime.getURL('images/xplain-off.png');
        img.className = 'yeah-image';
        img.draggable = false;
        button.appendChild(img);
        
        div.appendChild(button);

        let group = tweet.querySelector('div[role="group"]');
        if(group && group.children && group.children[3]) group.children[3].after(div);
        else {
            let interactButton = tweet.querySelector('.tweet-interact-favorite, .tweet-yeah-interact-favorite');
            if(interactButton) {
                div.classList.add('yeah-button-container-oldtwitter');
                interactButton.after(div);
            }
        }
    }
}

document.addEventListener("mouseover", (e) => {
  const el = e.target;
  if (el.classList.contains("hate-explanation-popup")) {
    const popup = document.createElement("div");
    popup.textContent = el.getAttribute("data-hate-explanation");
    popup.style.position = "absolute";
    popup.style.backgroundColor = "#333";
    popup.style.color = "#fff";
    popup.style.padding = "5px 10px";
    popup.style.borderRadius = "5px";
    popup.style.zIndex = 9999;
    popup.style.top = `${e.pageY + 10}px`;
    popup.style.left = `${e.pageX + 10}px`;
    popup.classList.add("explanation-popup");

    document.body.appendChild(popup);
    el.addEventListener("mouseout", () => popup.remove(), { once: true });
  }
});

setInterval(hookIntoTweets, 250);