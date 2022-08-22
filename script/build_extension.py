from copy import deepcopy
import sys
from pathlib import Path
import os
import json
import pathlib
import shutil
from time import time

current_path = os.path.dirname(__file__)


def ReadSource(path):
    with open(path) as f:
        return f.read()


def WriteSource(path, content):
    with open(path, "w") as f:
        f.write(content)


languages = {
    '': './source/extension/localization/zh-cn.json',
    'zh-cn': './source/extension/localization/zh-cn.json',
    'en-us': './source/extension/localization/en-us.json',
}


def compile(sourceSubDir, extension, rawFilename, subNameList: list, content):
    global rootPath
    global releasePath
    if r"{{{" not in content:
        if '$}' in content:
            for lan in languages:
                newContent = content
                newSubNameList = deepcopy(subNameList)
                newSubNameList.append({"name": lan, "order": 99})
                with open(rootPath.joinpath(languages[lan])) as f:
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
        print(resultPath)
        content = content.replace('{{timestamp}}', str(int(time())))
        WriteSource(resultPath, content)
        return
    start = content.index(r'{{{')
    end = content.index("}}}") + 3
    config = json.loads(content[start+3:end-3])
    for key in config:
        if(key == "order"):
            continue
        newSubNameList = deepcopy(subNameList)
        s = ReadSource(Path(sourceSubDir).joinpath(config[key]))
        newSubNameList.append({"name": key, "order": config["order"]})
        compile(sourceSubDir, extension, rawFilename, newSubNameList, content[:start] +
                s + content[end:])


def build():
    global releasePath
    global rootPath
    path = Path(os.path.realpath(sys.argv[0]))
    rootPath = path.parent.parent
    sourcePath = rootPath.joinpath("source")
    releasePath = rootPath.joinpath("release")
    allSource = os.walk(sourcePath)
    for sourceSubDir, dirList, fileList in allSource:
        for sourceFile in fileList:
            sourceContent = ""
            if not sourceFile.endswith("js"):
                continue
            with open(Path(sourceSubDir).joinpath(sourceFile)) as f:
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
    build()
    global rootPath
    shutil.copyfile(rootPath.joinpath("release/load.en-us.js"),
                    rootPath.joinpath("source/chrome/load.en-us.js"))
    shutil.copyfile(rootPath.joinpath("release/load.zh-cn.js"),
                    rootPath.joinpath("source/chrome/load.zh-cn.js"))
    shutil.copyfile(rootPath.joinpath("release/extension.chrome.user.js"),
                    rootPath.joinpath("source/chrome/extension.chrome.user.js"))
