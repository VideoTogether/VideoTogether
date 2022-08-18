from copy import deepcopy
import time
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from gevent import pywsgi
import sys
import hashlib
import json

# db切换redis开关，默认False使用内存，True切换redis
# TODO 现在 redis 的代码混到了 API 里面，need someone help 写写好点
dbSwitchToRedis = False
if dbSwitchToRedis:
    import redis

app = Flask(__name__)
CORS(app)

REDIS_DB_URL = {
    'host': '127.0.0.1',
    'port': 6379,
    'password': '',
    'db': 0
}


def getPool():
    return redis.ConnectionPool(host=REDIS_DB_URL.get('host'),
                                port=REDIS_DB_URL.get('port'),
                                password=REDIS_DB_URL.get('password'),
                                db=REDIS_DB_URL.get('db'),
                                decode_responses=True
                                )


def redisConnect(redisPool):
    return redis.Redis(connection_pool=redisPool)


class Room:
    name: str
    password: str
    lastUpdateClientTime: float
    lastUpdateServerTime: float
    playbackRate: float
    currentTime: float
    paused: bool
    url: str
    duration: float
    tempUser: str
    public: bool
    protected: bool
    videoTitle: str

    def __init__(self) -> None:
        self.tempUser = ""

    def toJsonResponse(self):
        return jsonify(self.toDict())

    def toDict(self):
        tmpDict = self.__dict__.copy()
        tmpDict["userCount"] = len(roomUserDatabase[self.name])
        tmpDict["timestamp"] = time.time()
        tmpDict.pop("password")
        tmpDict.pop("tempUser")
        return tmpDict


class TempUser:
    id: str
    created: float
    lastSeen: float

# TODO 找个 json 库


def RoomDecoder(obj):
    room = Room()
    room.name = obj['name']
    room.password = obj['password']
    room.lastUpdateClientTime = obj['lastUpdateClientTime']
    room.lastUpdateServerTime = obj['lastUpdateServerTime']
    room.playbackRate = obj['playbackRate']
    room.currentTime = obj['currentTime']
    room.paused = obj['paused']
    room.url = obj['url']
    room.duration = obj['duration']
    return room


database = dict()
roomUserDatabase = dict()
tempUserDatabase = dict()
pool = None


def generateErrorResponse(errorMessage):
    print({"errorMessage": errorMessage})
    return jsonify({"errorMessage": errorMessage})


namespace = "vt_namespace"


@app.route('/room/public', methods=["get"])
def listPublicRooms():
    rooms = []
    for name in database:
        if database[name].public and not database[name].protected:
            rooms.append(database[name].toDict())
    return jsonify(rooms)


@app.route('/room/get', methods=["get"])
def getRoom():
    name = request.args["name"]
    if "tempUser" in request.args:
        tempUserId = request.args["tempUser"]
        if tempUserId not in tempUserDatabase:
            tempUser = TempUser()
            tempUser.id = tempUserId
            tempUser.created = time.time()
            tempUser.lastSeen = time.time()
            tempUserDatabase[tempUserId] = tempUser
        else:
            tempUserDatabase[tempUserId].lastSeen = time.time()
        if name in roomUserDatabase:
            roomUserDatabase[name].add(tempUserId)

    if not dbSwitchToRedis:
        if name not in database:
            return generateErrorResponse("房间不存在")
        if "password" in request.args:
            password = hashlib.sha256(
                request.args["password"].encode('utf-8')).hexdigest()
            if database[name].protected and database[name].password != password:
                return generateErrorResponse("密码错误")
        else:
            if database[name].protected:
                return generateErrorResponse("密码错误，请更新插件")
        return database[name].toJsonResponse()
    r = redisConnect(pool)
    if r.hexists(namespace, name):
        cacheRoom = json.loads(r.hget(namespace, name),
                               object_hook=RoomDecoder)
        return cacheRoom.toJsonResponse()
    return generateErrorResponse("房间不存在")


@app.route('/timestamp', methods=["get"])
def getTimestamp():
    return jsonify({"timestamp": time.time()})


@app.route('/room/update', methods=["get"])
def updateRoom():
    room = Room()
    room.name = request.args["name"]
    room.password = hashlib.sha256(
        request.args["password"].encode('utf-8')).hexdigest()

    if dbSwitchToRedis:
        r = redisConnect(pool)
        if r.hexists(namespace, room.name):
            cacheRoom = json.loads(
                r.hget(namespace, room.name), object_hook=RoomDecoder)
            if cacheRoom.password != room.password:
                return generateErrorResponse("密码错误")
    else:
        if room.name in database:
            if database[room.name].password != room.password:
                return generateErrorResponse("密码错误")
            room = deepcopy(database[room.name])

    try:
        room.playbackRate = float(request.args["playbackRate"])
    except:
        room.playbackRate = 1
    room.currentTime = float(request.args["currentTime"])
    room.paused = request.args["paused"] != "false"
    room.url = request.args["url"]
    room.lastUpdateClientTime = request.args["lastUpdateClientTime"]
    if "duration" not in request.args:
        room.duration = 1e9
        # return generateErrorResponse("需要升级，点击帮助按钮获取更新")
    else:
        room.duration = float(request.args["duration"])
        if not (room.duration > 0):
            # fix NaN
            room.duration = 1e9
    room.lastUpdateServerTime = time.time()

    if "tempUser" in request.args:
        tempUserId = request.args["tempUser"]
        if tempUserId not in tempUserDatabase:
            tempUser = TempUser()
            tempUser.id = tempUserId
            tempUser.created = time.time()
            tempUser.lastSeen = time.time()
            tempUserDatabase[tempUserId] = tempUser
            room.tempUser = tempUserId
            print(room.tempUser)
        else:
            print(tempUserId, "123", room.tempUser)
            tempUserDatabase[tempUserId].lastSeen = time.time()
            if room.tempUser != tempUserId:
                return generateErrorResponse("其他房主正在同步")
    room.public = False
    if "public" in request.args:
        room.public = request.args["public"] == 'true'
    room.protected = False
    if "protected" in request.args:
        room.protected = request.args["protected"] == 'true'
    room.videoTitle = ""
    if "videoTitle" in request.args:
        room.videoTitle = request.args["videoTitle"]

    if not dbSwitchToRedis:
        if room.name not in roomUserDatabase:
            roomUserDatabase[room.name] = set()
        roomUserDatabase[room.name].add(room.tempUser)
        database[room.name] = room
    else:
        r = redisConnect(pool)
        r.hset(namespace, room.name, json.dumps(room.__dict__))
    sys.stdout.flush()
    sys.stderr.flush()
    return room.toJsonResponse()


@app.route('/statistics', methods=["get"])
def getStatistics():
    if not dbSwitchToRedis:
        return jsonify({"roomCount": len(database), "userCount": len(tempUserDatabase)})
    r = redisConnect(pool)
    return jsonify({"roomCount": r.hlen(namespace)})


@app.route('/vt.user.js', methods=["get"])
def getVtUserJs():
    return send_file("../../release/vt.user.js")


if __name__ == '__main__':
    app.config["JSON_AS_ASCII"] = False
    if sys.argv[1] == "debug":
        app.debug = False
        app.run(host='0.0.0.0')

    if sys.argv[1] == "prod":
        server = pywsgi.WSGIServer(
            ('0.0.0.0', 5000), app, keyfile='private.key', certfile='certificate.crt')
        server.serve_forever()
