let origin = Element.prototype.attachShadow;
if (/\{\s+\[native code\]/.test(Function.prototype.toString.call(origin))) {
    Element.prototype._attachShadow = origin;
    Element.prototype.attachShadow = function () {
        console.log('attachShadow');
        return this._attachShadow({ mode: "open" });
    };
}