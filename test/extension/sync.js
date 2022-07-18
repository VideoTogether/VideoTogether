const puppeteer = require('puppeteer-core');
const findChrome = require('carlo/lib/find_chrome');

(async () => {
    let x = 1;
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    const roomName = "AutoTest";
    const password = "AutoTestPassword";

    let VideoTogetherChrome = "C:\\Users\\wjzhao\\workspace\\VideoTogether\\source\\chrome";
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

    const pageHost = await browser.newPage();
    const pageMember1 = await browser.newPage();

    async function Test(url, name, adTime) {
        await pageHost.goto(url);
        await sleep(1000);
        const HostNameInput = await pageHost.$("#videoTogetherRoomNameInput");
        await HostNameInput.type(roomName);
        const HostPasswordInput = await pageHost.$("#videoTogetherRoomPasswordInput");
        await HostPasswordInput.type(password);
        const videoTogetherCreateButton = await pageHost.$("#videoTogetherCreateButton");
        await videoTogetherCreateButton.click();
        for (let i = 0; i < 20; i++) {
            await pageHost.keyboard.press("ArrowLeft");
            await sleep(100);
        }

        await pageMember1.goto('https://www.baidu.com/');
        await sleep(1000);
        await pageMember1.$eval('#videoTogetherRoomNameInput', el => el.value = '');
        const MNameInput = await pageMember1.$("#videoTogetherRoomNameInput");
        await MNameInput.type(roomName);
        const videoTogetherJoinButton = await pageMember1.$("#videoTogetherJoinButton");
        await videoTogetherJoinButton.click();

        await sleep(adTime);
        for (let i = 0; i < 20; i++) {
            await pageHost.keyboard.press("ArrowLeft");
            await sleep(100);
        }
        for (let i = 0; i < 10; i++) {
            await pageHost.keyboard.press("ArrowRight");
            await pageHost.keyboard.press("ArrowRight");
            if (i % 4 == 0) {
                await pageHost.keyboard.press("Space");
            }
            await sleep(5000);
            await pageMember1.evaluate(() => { window.scroll(0, 0); });
            await pageHost.evaluate(() => { window.scroll(0, 0); });
            await pageMember1.screenshot({ path: name + "_" + (++x) + '_member.png', fullPage: false });
            await pageHost.screenshot({ path: name + "_" + (x) + '_host.png', fullPage: false });

            if (i % 4 == 0) {
                await pageHost.keyboard.press("Space");
            }
        }

    }
    // !!!!!!!!! we need to fix memeber sync error when room video info is undefined
    await Test("https://v.qq.com/x/cover/mzc00200syg68ky/n33304xp9i6.html", "tencent", 5 * 1000);
    await Test("https://www.bilibili.com/video/BV1nW4y1S7Fi?spm_id_from=333.851.b_7265636f6d6d656e64.7", "bilibili", 5 * 1000);

    await browser.close();
})();