from copy import deepcopy
import sys
from pathlib import Path
import os
import json
import pathlib
import shutil


def ReadSource(path):
    with open(path) as f:
        return f.read()


def WriteSource(path, content):
    with open(path, "w") as f:
        f.write(content)


def compile(sourceSubDir, extension, rawFilename, subNameList: list, content):
    global releasePath
    if r"{{{" not in content:
        resultFilename = rawFilename
        subNameList.sort(key=lambda x: x["order"])
        for subName in subNameList:
            if subName["name"] != "":
                resultFilename = resultFilename + "."+subName["name"]
        resultPath = releasePath.joinpath(resultFilename+extension)
        print(resultPath)
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
            if r"{{{" not in sourceContent:
                continue
            print(Path(sourceSubDir).joinpath(sourceFile))
            resultContent = sourceContent
            resultExtension = pathlib.Path(sourceFile).suffix
            resultFilename = pathlib.Path(sourceFile).stem
            compile(sourceSubDir, resultExtension,
                    resultFilename, [], sourceContent)


if __name__ == '__main__':
    build()
    shutil.copyfile("./release/vt.user.js", "./source/chrome/vt.user.js")
    shutil.copyfile("./release/extension.chrome.user.js",
                    "./source/chrome/extension.chrome.user.js")
