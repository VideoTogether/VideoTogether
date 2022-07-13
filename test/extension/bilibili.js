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
    await pageHost.goto('https://www.bilibili.com/video/BV19h411Q7aA?spm_id_from=333.999.0.0');
    await sleep(3000);
    const HostNameInput = await pageHost.$("#videoTogetherRoomNameInput");
    await HostNameInput.type(roomName);
    const HostPasswordInput = await pageHost.$("#videoTogetherRoomPasswordInput");
    await HostPasswordInput.type(password);
    const videoTogetherCreateButton = await pageHost.$("#videoTogetherCreateButton");
    await videoTogetherCreateButton.click();


    // const pageMember1 = await browser.newPage();
    // await pageMember1.goto('https://www.npmjs.com/package/puppeteer-core');
    // await sleep(3000);
    // const MNameInput = await pageMember1.$("#videoTogetherRoomNameInput");
    // await MNameInput.type(roomName);
    // const videoTogetherJoinButton = await pageMember1.$("#videoTogetherJoinButton");
    // await videoTogetherJoinButton.click();

    // for (let i = 0; i < 10; i++) {
    //     await pageHost.keyboard.press("ArrowRight");
    //     await pageHost.keyboard.press("ArrowRight");
    //     await sleep(5000);
    //     await pageHost.screenshot({ path: (x++) + '.png', fullPage: false });
    //     await pageMember1.screenshot({ path: (x++) + '.png', fullPage: false });
    // }


    // await browser.close();
})();