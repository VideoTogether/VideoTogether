
function VTFind(o, path, depth) {
    if (depth > 10) {
        return;
    }
    if (o == undefined || o == null) {
        return;
    }
    if (o.lskdjflasdkjfkcjvkd) {
        return;
    }

    o.lskdjflasdkjfkcjvkd = true;
    for (let key in o) {
        if(key.indexOf("play") == 0 || key.indexOf("Play") == 0 || key.indexOf("pause") == 0 ){
            console.log(key, path);
        }
        try {
            VTFind(o[key], path + "." + key, depth + 1);
        } catch (e) { console.error(e); }
    }
}
VTFind(window, "", 0);