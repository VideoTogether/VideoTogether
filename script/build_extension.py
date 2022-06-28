import sys
from pathlib import Path
import os
import json
import pathlib


def ReadSource(path):
    with open(path) as f:
        return f.read()


def WriteSource(path, content):
    with open(path, "w") as f:
        f.write(content)

if __name__ == '__main__':
    path = Path(os.path.realpath(sys.argv[0]))
    rootPath = path.parent.parent
    sourcePath = rootPath.joinpath("source")
    releasePath = rootPath.joinpath("release")
    allSource = os.walk(sourcePath)
    for sourceSubDir, dirList, fileList in allSource:
        for sourceFile in fileList:
            sourceContent = ""
            with open(Path(sourceSubDir).joinpath(sourceFile)) as f:
                sourceContent = f.read()
            if r"{{{" not in sourceContent:
                continue
            print(Path(sourceSubDir).joinpath(sourceFile))
            resultContent = sourceContent
            resultExtension = pathlib.Path(sourceFile).suffix
            resultFilename = pathlib.Path(sourceFile).stem
            while("{{{" in resultContent):
                start = resultContent.index(r'{{{')
                end = resultContent.index("}}}") + 3
                config = json.loads(resultContent[start+3:end-3])
                for key in config:
                    resultFilename = resultFilename + "."+key
                    s = ReadSource(Path(sourceSubDir).joinpath(config[key]))
                    resultContent = resultContent[:start] + \
                        s + resultContent[end:]
            resultPath = releasePath.joinpath(resultFilename+resultExtension)
            WriteSource(resultPath,resultContent)