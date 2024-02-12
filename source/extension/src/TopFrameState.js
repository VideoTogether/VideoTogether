//delete-this-begin
import { Base64 } from "./Base64";
//delete-this-end

export class TopFrameState {
    constructor() {
        if (!isWrapperFrame) {
            return;
        }
        try{
            const base64Params = window.location.hash.substring(1);
            const params = JSON.parse(Base64.decode(base64Params));
            console.log(params)
            this._url = params.url;
            this._title = params.title;
            this._isEasySharePage = params.isEasySharePage;
            this._initCallback = undefined;
        }catch{
            this._url = undefined;
            this._title = undefined;
            this._isEasySharePage = undefined;
            this._initCallback = undefined;
        }

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
    get location() {
        if (!isWrapperFrame) {
            return window.location;
        }
        return new URL(this._url)
    }

    static getSelfObj(){
        return {
            url: window.location.href,
            title: document.title,
            isEasySharePage: window.VideoTogetherEasyShareMemberSite
        }
    }
}