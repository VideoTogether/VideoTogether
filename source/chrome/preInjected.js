Element.prototype._attachShadow = Element.prototype.attachShadow;
Element.prototype.attachShadow = function () {
    console.log('attachShadow');
    return this._attachShadow( { mode: "open" } );
};