function show(platform, enabled, useSettingsInsteadOfPreferences) {
    document.body.classList.add(`platform-${platform}`);
    if (useSettingsInsteadOfPreferences) {
        document.getElementsByClassName('platform-mac state-on')[0].innerText = "VideoTogether’s extension is currently on. You can turn it off in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac state-off')[0].innerText = "VideoTogether’s extension is currently off. You can turn it on in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac state-unknown')[0].innerText = "You can turn on VideoTogether’s extension in the Extensions section of Safari Settings.";
        document.getElementsByClassName('platform-mac open-preferences')[0].innerText = "Quit and Open Safari Settings…";
    }

    if (typeof enabled === "boolean") {
        document.body.classList.toggle(`state-on`, enabled);
        document.body.classList.toggle(`state-off`, !enabled);
    } else {
        document.body.classList.remove(`state-on`);
        document.body.classList.remove(`state-off`);
    }
    if(navigator.language.toLowerCase().startsWith('zh')){
        changeLanguage('zh-cn');
    }else{
        changeLanguage('en-us');
    }
}

function changeLanguage(language){
    
    [...document.querySelectorAll('.zh-cn')].forEach(e=>e.style.display='none');
    [...document.querySelectorAll('.en-us')].forEach(e=>e.style.display='none');
    [...document.querySelectorAll(`.${language}`)].forEach(e=>e.style.display='block');
}
try{
    if(navigator.language.toLowerCase().startsWith('zh')){
        changeLanguage('zh-cn');
    }else{
        changeLanguage('en-us');
    }
}catch{}
function openPreferences() {
    webkit.messageHandlers.controller.postMessage("open-preferences");
}

document.querySelector("button.open-preferences").addEventListener("click", openPreferences);
