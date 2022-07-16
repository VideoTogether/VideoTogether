import time
from flask import Flask, jsonify, request
from flask_cors import CORS
from gevent import pywsgi
import sys
import hashlib
import json

# db切换redis开关，默认False使用内存，True切换redis
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

    def toJsonResponse(self):
        tmpDict = self.__dict__.copy()
        tmpDict.pop("password")
        return jsonify(tmpDict)


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
pool = None


def generateErrorResponse(errorMessage):
    print({"errorMessage": errorMessage})
    return jsonify({"errorMessage": errorMessage})


namespace = "vt_namespace"


@app.route('/room/get', methods=["get"])
def getRoom():
    name = request.args["name"]
    if not dbSwitchToRedis:
        if name not in database:
            return generateErrorResponse("房间不存在")
        return database[name].toJsonResponse()
    r = redisConnect(pool)
    if r.hexists(namespace, name):
        cacheRoom = json.loads(r.hget(namespace, name), object_hook=RoomDecoder)
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
            cacheRoom = json.loads(r.hget(namespace, room.name), object_hook=RoomDecoder)
            if cacheRoom.password != room.password:
                return generateErrorResponse("密码错误")
    else:
        if room.name in database:
            if database[room.name].password != room.password:
                return generateErrorResponse("密码错误")

    room.playbackRate = request.args["playbackRate"]
    room.currentTime = float(request.args["currentTime"])
    room.paused = request.args["paused"] != "false"
    room.url = request.args["url"]
    room.lastUpdateClientTime = request.args["lastUpdateClientTime"]
    if "duration" not in request.args:
        room.duration = 1e9
        # return generateErrorResponse("需要升级，点击帮助按钮获取更新")
    else:
        room.duration = float(request.args["duration"])
    room.lastUpdateServerTime = time.time()

    if not dbSwitchToRedis:
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
        return jsonify({"roomCount": len(database)})
    r = redisConnect(pool)
    return jsonify({"roomCount": r.hlen(namespace)})


if __name__ == '__main__':
    if sys.argv[1] == "debug":
        app.debug = False
        app.run(host='0.0.0.0')

    if sys.argv[1] == "prod":
        server = pywsgi.WSGIServer(
            ('0.0.0.0', 5000), app, keyfile='private.key', certfile='certificate.crt')
        server.serve_forever()
