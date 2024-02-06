# 开发文档

## 运行本地插件代码

### 1. 开启开发模式

修改 `source/extension.js`, 将
```
let isDevelopment = false;
```
修改为
```
let isDevelopment = true;
```

`extension.js` 负责将插件本体 `vt.js` 注入到网页中，默认使用热更新。开启 isDevelopment 可以关闭热更新，使用本地代码

### 2. 编译 

运行命令
```
python .\script\build_extension.py
```

这是一个简单的编译脚本，将 `source` 目录中一些需要编译的文件做一些简单的字符串替换后输出到 `release` 目录，然后将插件需要的代码复制到插件目录，Chrome 插件的目录是 `source/chrome`

### 3. 运行本地插件

编译完成后，在 Chrome 插件页面 [chrome://extensions/](chrome://extensions/) 加载已解压的扩展程序 `source/chrome`

### 4. 编辑代码

插件的核心代码在 `vt.js`，每次编辑完成后重复步骤 1-3 进行调试


## 本地调试后端服务

TODO