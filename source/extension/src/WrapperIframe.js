
const mouseMoveEvent = ['mousemove', 'touchmove', 'pointermove'];
const mouseUpEvent = ['mouseup', 'touchend', 'pointerup'];

const SelfWrapperState = {
    positionX: 0,
    positionY: 0,
    sizeX: 0,
    sizeY: 0,
    movingOffsetX: 0,
    movingOffsetY: 0,
}
const WrapperIframeSource = 'VT_WrapperIframe';
class WrapperIframe {
    constructor() {
        this.frame = document.createElement('iframe');
        this.frame.src = 'https://2gether.video/videotogether_wrapper.html';
        this.frame.allow = 'microphone;';
        this.frame.style = 'position: absolute; right: 0px; bottom: 0px; width: 262px; height: 212px; background: transparent; border: none; z-index: 2147483647; position:fixed;';
        (document.body || document.documentElement).appendChild(this.frame);
        window.addEventListener('message', (e) => {
            if (e.data.source == WrapperIframeSource) {
                switch (e.data.type) {
                    case 'moving':
                        this._move(e.data.data.x, e.data.data.y);
                        break;
                    case 'init':
                        this._notifyState();
                        break;
                }
            }
        })
        window.addEventListener('resize', (e) => {
            const left = window.getComputedStyle(this.frame).getPropertyValue('left').split('px')[0] * 1;
            const top = window.getComputedStyle(this.frame).getPropertyValue('top').split('px')[0] * 1;
            this._move(left, top)
        })
    }
    _notifyState() {
        const left = window.getComputedStyle(this.frame).getPropertyValue('left').split('px')[0] * 1;
        const top = window.getComputedStyle(this.frame).getPropertyValue('top').split('px')[0] * 1;
        const width = window.getComputedStyle(this.frame).getPropertyValue('width').split('px')[0] * 1;
        const height = window.getComputedStyle(this.frame).getPropertyValue('height').split('px')[0] * 1;
        PostMessage(this.frame.contentWindow, {
            source: WrapperIframeSource,
            type: 'state',
            data: {
                left: left,
                top: top,
                width: width,
                height: height
            }
        });
    }

    _move(screenX, screenY) {
        screenX = Math.max(0, Math.min(screenX, window.innerWidth - this.frame.offsetWidth));
        screenY = Math.max(0, Math.min(screenY, window.innerHeight - this.frame.offsetHeight));
        this.frame.style.left = `${screenX}px`;
        this.frame.style.top = `${screenY}px`;
        this._notifyState();
    }
    static Moving(e) {
        let targetX;
        let targetY;

        if (e.screenX) {
            targetX = SelfWrapperState.movingOffsetX + e.screenX;
            targetY = SelfWrapperState.movingOffsetY + e.screenY;
        } else {
            targetX = SelfWrapperState.movingOffsetX + e.touches[0].screenX;
            targetY = SelfWrapperState.movingOffsetY + e.touches[0].screenY;
        }
        PostMessage(window.parent, {
            source: WrapperIframeSource,
            type: 'moving',
            data: {
                x: targetX,
                y: targetY
            }
        })
    }
    static stopMoving(e) {
        mouseMoveEvent.forEach(function (event) {
            document.removeEventListener(event, WrapperIframe.Moving);
        })
    }
    static startMoving(e) {
        if (e.screenX) {
            SelfWrapperState.movingOffsetX = SelfWrapperState.positionX - e.screenX;
            SelfWrapperState.movingOffsetY = SelfWrapperState.positionY - e.screenY;
        } else {
            SelfWrapperState.movingOffsetX = SelfWrapperState.positionX - e.touches[0].screenX;
            SelfWrapperState.movingOffsetY = SelfWrapperState.positionY - e.touches[0].screenY;
        }
        mouseMoveEvent.forEach(event => {
            document.addEventListener(event, WrapperIframe.Moving);
        })
        mouseUpEvent.forEach(event => {
            document.addEventListener(event, WrapperIframe.stopMoving);
        })
    }
    static onStateChange(data) {
        SelfWrapperState.positionX = data.left;
        SelfWrapperState.positionY = data.top;
        SelfWrapperState.sizeX = data.width;
        SelfWrapperState.sizeY = data.height;
    }
    static InitState() {
        window.addEventListener('message', (e) => {
            if (e.data.source == WrapperIframeSource) {
                switch (e.data.type) {
                    case 'state':
                        WrapperIframe.onStateChange(e.data.data);
                        break;
                }
            }
        })
        PostMessage(window.parent, {
            source: WrapperIframeSource,
            type: 'init',
        })
    }
}

/*delete-this-begin*/
module.exports = { WrapperIframe };
/*delete-this-end*/