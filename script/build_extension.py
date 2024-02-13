from copy import deepcopy
import sys
from pathlib import Path
import os
import json
import pathlib
import shutil
from time import time
import re

current_path = os.path.dirname(__file__)


def ReadSource(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def WriteSource(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)


languages = {
    '': './source/extension/localization/zh-cn.json',
    'zh-cn': './source/extension/localization/zh-cn.json',
    'en-us': './source/extension/localization/en-us.json',
}

timestamp_str = str(int(time()))


def isChanged(path, content: str):
    if not os.path.exists(path):
        return True
    fileContent = ""
    with open(path, encoding="utf-8") as f:
        fileContent = f.read()
    if len(fileContent) != len(content):
        return True
    strList = content.split(timestamp_str)
    idx = 0
    for s in strList:
        if fileContent[idx: idx+len(s)] != s:
            return True
        idx = idx+len(s)+len(timestamp_str)
    return False
DELETE_BEGIN = '//delete-this-begin'
DELETE_END = '//delete-this-end'

def processImportContent(content):
    while DELETE_BEGIN in content:
        start = content.index(DELETE_BEGIN)
        end = content.index(DELETE_END)+len(DELETE_END)
        content = content[0:start] + content[end:]
    content = re.sub(r'^export ', '', content, flags=re.MULTILINE)
    return content

def compileImport(sourceSubDir, extension, rawFilename, subNameList: list, content):
    importedFiles = []
    while '\nimport' in content:
        start = content.index('\nimport')+1
        end = content.index('\n', start+1)
        importLine = content[start:end]
        importFilename = importLine.split("'")[-2]
        if importFilename in importedFiles:
            continue
        importedFiles.append(importFilename)
        importContent = ReadSource(Path(sourceSubDir).joinpath(importFilename))
        importContent = processImportContent(importContent)
        content = content[0:start] + importContent + content[end:]
    return content

def compile(sourceSubDir, extension, rawFilename, subNameList: list, content):
    content = processImportContent(content)
    content = compileImport(sourceSubDir, extension, rawFilename, subNameList, content)
    global rootPath
    global releasePath
    if r"{{{" not in content:
        if '$}' in content:
            for lan in languages:
                newContent = content
                newSubNameList = deepcopy(subNameList)
                newSubNameList.append({"name": lan, "order": 99})
                with open(rootPath.joinpath(languages[lan]), encoding="utf-8") as f:
                    strings = json.load(f)
                    for key in strings:
                        newContent = newContent.replace(
                            '{$'+key+'$}', strings[key])
                compile(sourceSubDir, extension,
                        rawFilename, newSubNameList, newContent)
            return
        resultFilename = rawFilename
        subNameList.sort(key=lambda x: x["order"])
        for subName in subNameList:
            if subName["name"] != "":
                resultFilename = resultFilename + "."+subName["name"]
        resultPath = releasePath.joinpath(resultFilename+extension)
        resultPath = str(resultPath).replace(".buildme", "")
        print(resultPath)

        content = content.replace('{{timestamp}}', timestamp_str)
        if isChanged(resultPath, content):
            WriteSource(resultPath, content)
        return
    start = content.index(r'{{{')
    end = content.index("}}}") + 3
    config = json.loads(content[start+3:end-3])
    for key in config:
        if (key == "order"):
            continue
        newSubNameList = deepcopy(subNameList)
        s = ReadSource(Path(sourceSubDir).joinpath(config[key]))
        newSubNameList.append({"name": key, "order": config["order"]})
        compile(sourceSubDir, extension, rawFilename, newSubNameList, content[:start] +
                s + content[end:])


def build():
    global releasePath
    global rootPath
    sourcePath = rootPath.joinpath("source")
    releasePath = rootPath.joinpath("release")
    allSource = os.walk(sourcePath)
    for sourceSubDir, dirList, fileList in allSource:
        for sourceFile in fileList:
            sourceContent = ""
            if (not sourceFile.endswith("js")) and (not ".buildme" in sourceFile):
                continue
            with open(Path(sourceSubDir).joinpath(sourceFile), encoding="utf-8") as f:
                sourceContent = f.read()
            if r"{{{" not in sourceContent and '{$' not in sourceContent:
                continue
            print(Path(sourceSubDir).joinpath(sourceFile))
            resultContent = sourceContent
            resultExtension = pathlib.Path(sourceFile).suffix
            resultFilename = pathlib.Path(sourceFile).stem
            compile(sourceSubDir, resultExtension,
                    resultFilename, [], sourceContent)


if __name__ == '__main__':
    global rootPath
    path = Path(os.path.realpath(sys.argv[0]))
    rootPath = path.parent.parent
    os.system(
        "git clone https://github.com/VideoTogether/localvideo {}/source/local".format(rootPath))
    os.system("cd {}/source/local && git pull".format(rootPath))

    build()

    def cp(src, dst):
        shutil.copyfile(rootPath.joinpath(src),
                        rootPath.joinpath(dst))

    def mv(src, dst):
        shutil.move(rootPath.joinpath(src),
                    rootPath.joinpath(dst))
    def remove(src):
        os.remove(rootPath.joinpath(src))
    mv("release/local_video_player.en-us.html",
       'source/local/local_video_player.en-us.html')
    mv("release/local_video_player.zh-cn.html",
       'source/local/local_video_player.zh-cn.html')
    mv("release/local_videos.en-us.html", 'source/local/local_videos.en-us.html')
    mv("release/local_videos.zh-cn.html", 'source/local/local_videos.zh-cn.html')
    mv("release/local_page.en-us.js", 'source/local/local_page.en-us.js')
    mv("release/local_page.zh-cn.js", 'source/local/local_page.zh-cn.js')
    remove("release/local_video_player.html")
    remove("release/local_videos.html")
    remove("release/local_page.js")
    cp("release/load.en-us.js","source/chrome/load.en-us.js")
    cp("release/load.zh-cn.js", "source/chrome/load.zh-cn.js")
    cp("release/load.frame.en-us.js", "source/chrome/load.frame.en-us.js")
    cp("release/load.frame.zh-cn.js", "source/chrome/load.frame.zh-cn.js")
    cp("release/load.dev.en-us.js","source/chrome/load.dev.en-us.js")
    cp("release/load.dev.zh-cn.js", "source/chrome/load.dev.zh-cn.js")
    cp("release/load.dev.frame.en-us.js", "source/chrome/load.dev.frame.en-us.js")
    cp("release/load.dev.frame.zh-cn.js", "source/chrome/load.dev.frame.zh-cn.js")
    shutil.copyfile(rootPath.joinpath("release/load.en-us.js"),
                    rootPath.joinpath("source/firefox/load.en-us.js"))
    shutil.copyfile(rootPath.joinpath("release/load.zh-cn.js"),
                    rootPath.joinpath("source/firefox/load.zh-cn.js"))
    shutil.copyfile(rootPath.joinpath("release/load.en-us.js"),
                    rootPath.joinpath("source/safari/VideoTogether/Shared (Extension)/Resources/load.en-us.js"))
    shutil.copyfile(rootPath.joinpath("release/load.zh-cn.js"),
                    rootPath.joinpath("source/safari/VideoTogether/Shared (Extension)/Resources/load.zh-cn.js"))

    shutil.copyfile(rootPath.joinpath("release/vt.v2.en-us.user.js"),
                    rootPath.joinpath("source/chrome/vt.v2.en-us.user.js"))
    shutil.copyfile(rootPath.joinpath("release/vt.v2.zh-cn.user.js"),
                    rootPath.joinpath("source/chrome/vt.v2.zh-cn.user.js"))
    cp("release/vt.v2.frame.en-us.user.js", "source/chrome/vt.v2.frame.en-us.user.js")
    cp("release/vt.v2.frame.zh-cn.user.js", "source/chrome/vt.v2.frame.zh-cn.user.js")
    # shutil.copyfile(rootPath.joinpath("release/vt.v2.debug.en-us.user.js"),
    #                 rootPath.joinpath("source/chrome/vt.v2.debug.en-us.user.js"))
    # shutil.copyfile(rootPath.joinpath("release/vt.v2.debug.zh-cn.user.js"),
    #                 rootPath.joinpath("source/chrome/vt.v2.debug.zh-cn.user.js"))
    shutil.copyfile(rootPath.joinpath("release/vt.v2.en-us.user.js"),
                    rootPath.joinpath("source/firefox/vt.v2.en-us.user.js"))
    shutil.copyfile(rootPath.joinpath("release/vt.v2.zh-cn.user.js"),
                    rootPath.joinpath("source/firefox/vt.v2.zh-cn.user.js"))
    shutil.copyfile(rootPath.joinpath("release/vt.v2.en-us.user.js"),
                    rootPath.joinpath("source/safari/VideoTogether/Shared (Extension)/Resources/vt.v2.en-us.user.js"))
    shutil.copyfile(rootPath.joinpath("release/vt.v2.zh-cn.user.js"),
                    rootPath.joinpath("source/safari/VideoTogether/Shared (Extension)/Resources/vt.v2.zh-cn.user.js"))

    shutil.copyfile(rootPath.joinpath("release/extension.chrome.user.js"),
                    rootPath.joinpath("source/chrome/extension.chrome.user.js"))
    cp("release/extension.v2.chrome.user.js", "source/chrome/extension.v2.chrome.user.js")
    shutil.copyfile(rootPath.joinpath("release/extension.safari.user.js"),
                    rootPath.joinpath("source/safari/VideoTogether/Shared (Extension)/Resources/extension.safari.user.js"))
    shutil.copyfile(rootPath.joinpath("release/extension.firefox.user.js"),
                    rootPath.joinpath("source/firefox/extension.firefox.user.js"))

    shutil.copyfile(rootPath.joinpath("release/background.chrome.js"),
                    rootPath.joinpath("source/chrome/background.chrome.js"))
    shutil.copyfile(rootPath.joinpath("release/background.firefox.js"),
                    rootPath.joinpath("source/firefox/background.firefox.js"))
    shutil.copyfile(rootPath.joinpath("release/background.safari.js"),
                    rootPath.joinpath("source/safari/VideoTogether/Shared (Extension)/Resources/background.safari.js"))
