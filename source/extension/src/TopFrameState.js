class TopFrameState {
    constructor() {
        if (!isWrapperFrame) {
            return;
        }
        this._url = undefined;
        this._title = undefined;
        this._isEasySharePage = undefined;
        this._initCallback = undefined;
        window.addEventListener('message', (e) => {
            if (e.data.source == vtMsgSrc) {
                switch (e.data.type) {
                    case 36: {
                        this._url = e.data.data.url;
                        this._title = e.data.data.title;
                        this._isEasySharePage = e.data.data.isEasySharePage;
                        if (this._initCallback != undefined) {
                            this._initCallback();
                            this._initCallback = undefined;
                        }
                        break;
                    }
                }
            }
        })
    }
    async asyncInit() {
        if (this.url != undefined) {
            return;
        }
        return new Promise((res, rej) => {
            if (this._initCallback != undefined) {
                rej("init callback is already set")
            }
            this._initCallback = res;
        })
    }
    get url() {
        if (!isWrapperFrame) {
            return window.location.href;
        }
        return this._url;
    }
    get title() {
        if (!isWrapperFrame) {
            return document.title;
        }
        return this._title;
    }
    get isEasySharePage() {
        if (!isWrapperFrame) {
            return window.VideoTogetherEasyShareMemberSite;
        }
        return this._isEasySharePage;
    }
}
/*delete-this-begin*/
module.exports = { TopFrameState };
/*delete-this-end*/
