const injectedScript = document.createElement('script');
injectedScript.src = chrome.runtime.getURL('preInjected.js');
(document.head || document.documentElement).appendChild(injectedScript);