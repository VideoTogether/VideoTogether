host=https:\/\/$REPL_ID.id.repl.co
common=https:\/\/vt.panghair.com:5000\/

sed -i "s#$common#$host#g" ./source/extension/config/release_host
#取消以下注释，在自启时强制切换为win11样式(Beta)
#cp ./source/extension/html/win11Pannel.html ./source/extension/html/pannel.html
python ./script/build_extension.py
cp ./release/vt.user.js .
cp vt.user.js ./source/server
redis-server ./redis.conf &
python ./source/server/main.py debug
