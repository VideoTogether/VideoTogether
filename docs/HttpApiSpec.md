### HTTP APIs specification:


#### GET /timestamp
Get the current time of the server
##### Response
```json5
{
  "timestamp": 1.123, // float64; current timestamp (seconds) of the server
}
```

#### GET /statistics
Get current server's statistic data
##### Response
```json5
{
  "roomCount": 1,
}
```

#### GET /room/get

Get room info

##### Request

| Parameters |               | 
|------------|---------------|
| name       | room name     |
| password   | room password |

##### Response

```json5
{
  "name":                 "",    // room name
  "lastUpdateClientTime": 1.123, // float64
  "lastUpdateServerTime": 1.123, // float64
  "playbackRate":         1.0,   // float64; speed
  "currentTime":          1.123, // float64
  "paused":               false, // bool
  "url":                  "",    // 
  "duration":             1.0,   // 
  "public":               false, // bool
  "protected":            false,
  "videoTitle":           "",
  "timestamp":            1.123, // float64; current timestamp (seconds) of the server
}
```

#### PUT /room/update

Submit realtime infomation, which helps peers in the room with synchronization.

##### Request

| Parameters           |                   | 
|----------------------|-------------------|
| name                 | room name         |
| password             | room password     |
| playbackRate         |                   |
| currentTime          | peer current time |
| paused               |                   |
| url                  | video link        |
| lastUpdateClientTime |                   |
| duration             |                   |
| tempUser             |                   |
| protected            |                   |
| videoTitle           |                   |

##### Response

AS SAME AS the Response of 'GET /room/get'

#### ANY /kraken
**all methods except 'OPTIONS'.**

Act as a reverse proxy
