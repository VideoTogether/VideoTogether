host=https:\/\/$REPL_ID.id.repl.co
common=https:\/\/vt.panghair.com:5000\/

sed -i "s#$common#$host#g" ./source/extension/config/release_host
python ./script/build_extension.py
cp ./release/vt.user.js .
redis-server ./redis.conf &
python ./source/server/main.py debug