#本文件为Docker入口点文件ENTRYPOINT
#需要在启动前构建一次vt.user.js脚本
#取消以下注释，在自启时强制切换为win11样式(Beta)
#cp ./source/extension/html/win11Pannel.html ./source/extension/html/pannel.html
python ./script/build_extension.py
cp ./release/vt.user.js .
#redis-server ./redis.conf &
python ./source/server/main.py debug
