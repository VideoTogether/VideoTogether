//delete-this-begin
import { WrapperIframeUrl } from "./Constants";
//delete-this-end

export function checkIsWrapperFrame() {
    return window.location.href.startsWith(WrapperIframeUrl);
}
export const isWrapperFrame = checkIsWrapperFrame();
