host=$REPL_ID.id.repl.co

echo $host > ./source/extension/config/release_host
python ./script/build_extension.py
cp ./release/vt.user.js .
python ./source/server/main.py debug