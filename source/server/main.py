from subprocess import call
from flask import Flask, jsonify, request
import json
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


class Room:
    name: str
    password: str
    lastUpdateTime: float
    playbackRate: float
    current: float
    paused: bool

    def toJSON(self):
        return json.dumps(self, default=lambda o: o.__dict__,
                          sort_keys=True, indent=4)


database = dict()


def generateScriptResponse(data, callback):
    return callback+'(JSON.parse(\''+json.dumps(data.__dict__)+'\'));'


def generateErrorResponse(errorMessage, callback):
    return callback+'(JSON.parse(\''+json.dumps({"errorMessage": errorMessage})+'\'));'


@app.route('/room/get', methods=["get"])
def getRoom():
    name = request.args["name"]
    callback = request.args["callback"]
    if callback == None or callback == "":
        return jsonify(database[name])
    else:
        return generateScriptResponse(database[name], callback)


@app.route('/room/update', methods=["get"])
def updateRoom():
    room = Room()
    room.name = request.args["name"]
    room.password = request.args["password"]
    room.playbackRate = request.args["playbackRate"]
    room.current = request.args["current"]
    room.paused = request.args["paused"]
    callback = request.args["callback"]
    if room.name in database:
        if database[room.name].password != room.password:
            return generateErrorResponse("密码错误", callback)
    database[room.name] = room
    return generateScriptResponse(database[room.name], callback)


if __name__ == '__main__':
    app.debug = True
    app.run()
