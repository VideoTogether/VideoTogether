const puppeteer = require('puppeteer-core');
const findChrome = require('carlo/lib/find_chrome');
const crypto = require('crypto');

async function $(page, selector) {
    return await page.evaluateHandle(`document.querySelector("#VideoTogetherWrapper").shadowRoot.querySelector("${selector}")`);
}

/**
 * 
 * @param {puppeteer.Page} page 
 * @param {string} selector
 * @returns {puppeteer.ElementHandle<Element>[]}
 */
async function selectAll(page, selector) {
    let uuid = crypto.randomUUID();
    await page.evaluateHandle(
        `
        (function selectAll(selector = "${selector}", document = window.document) {
            let elements = [...document.querySelectorAll(selector)];
            let iframes = document.querySelectorAll('iframe');
            [...iframes].forEach(i => {
                elements.push(...selectAll(selector, i.contentDocument));
            })
            window['${uuid}'] = elements;
            return elements;
        })();
        `
    );
    let elements = [];
    for (let i = 0; ; i++) {
        let element = (await page.evaluateHandle(`window['${uuid}'][${i}]`)).asElement();
        console.log(i, element);
        if (element) {
            elements.push(element);
        } else {
            break;
        }
    }
    return elements;
}

(async () => {
    let x = 1;
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const roomName = "AutoTest";
    const password = "AutoTestPassword";

    let VideoTogetherChrome = "../../source/chrome";
    const browser = await puppeteer.launch({
        executablePath: await (await findChrome({})).executablePath,
        pipe: true,
        defaultViewport: null,
        headless: false,
        userDataDir: '.profile',
        args: [
            `--disable-extensions-except=${VideoTogetherChrome}`,
            `--load-extension=${VideoTogetherChrome}`,
            '--enable-automation'
        ]
        // args,
    });



    async function Test(url, name, adTime) {
        const hostPage = await browser.newPage();
        const memberpage = await browser.newPage();
        hostPage.$()
        await hostPage.goto(url);
        await sleep(1000);
        const HostNameInput = await $(hostPage, "#videoTogetherRoomNameInput");
        await HostNameInput.type(roomName);
        const HostPasswordInput = await $(hostPage, "#videoTogetherRoomPasswordInput");
        await HostPasswordInput.type(password);
        const videoTogetherCreateButton = await $(hostPage, "#videoTogetherCreateButton");
        await videoTogetherCreateButton.click();
        for (let i = 0; i < 20; i++) {
            await hostPage.keyboard.press("ArrowLeft");
            await sleep(100);
        }

        await memberpage.goto('https://www.baidu.com/');
        await sleep(1000);

        // await pageMember1.$eval('#videoTogetherRoomNameInput', el => el.value = '');

        const MNameInput = await $(memberpage, "#videoTogetherRoomNameInput");
        await MNameInput.type(roomName);
        const videoTogetherJoinButton = await $(memberpage, "#videoTogetherJoinButton");
        await videoTogetherJoinButton.click();

        await sleep(adTime);
        for (let i = 0; i < 20; i++) {
            await hostPage.keyboard.press("ArrowLeft");
            await sleep(100);
        }
        for (let i = 0; i < 10; i++) {
            await hostPage.keyboard.press("ArrowRight");
            await hostPage.keyboard.press("ArrowRight");
            if (i % 4 == 0) {
                await hostPage.keyboard.press("Space");
            }
            await sleep(5000);
            await memberpage.evaluate(() => { window.scroll(0, 0); });
            await hostPage.evaluate(() => { window.scroll(0, 0); });
            await memberpage.screenshot({ path: name + "_" + (++x) + '_member.png', fullPage: false });
            await hostPage.screenshot({ path: name + "_" + (x) + '_host.png', fullPage: false });

            if (i % 4 == 0) {
                await hostPage.keyboard.press("Space");
            }
        }

    }
    // !!!!!!!!! we need to fix memeber sync error when room video info is undefined
    // await Test("https://v.qq.com/x/cover/mzc00200syg68ky/n33304xp9i6.html", "tencent", 5 * 1000);
    // await Test("https://www.bilibili.com/video/BV1nW4y1S7Fi?spm_id_from=333.851.b_7265636f6d6d656e64.7", "bilibili", 5 * 1000);
    // await Test("https://www.novipnoad.com/movie/138902.html", "novipnoad", 5*1000);
    const hostPage = await browser.newPage();
    await hostPage.goto('http://127.0.0.1:7000/docs/website/page3.html');
    await sleep(1000);
    let elements = await selectAll(hostPage, 'video');
    elements.forEach(async e=>{
        console.log(await (await e.getProperty('duration')).jsonValue());
    })
    await sleep(50000);
    await browser.close();
})();