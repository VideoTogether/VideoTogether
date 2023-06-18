package main

type ErrorMessage struct {
	HostWrongPassword string
	WrongPassword     string
	RoomNotExist      string
	OtherHostSyncing  string
}

var emLanguages = map[string]*ErrorMessage{
	"zh-cn": {
		HostWrongPassword: "房间已存在,密码错误",
		WrongPassword:     "密码错误",
		RoomNotExist:      "房间不存在",
		OtherHostSyncing:  "其他房主正在同步",
	},
	"en-us": {
		HostWrongPassword: "Room exists, wrong password",
		WrongPassword:     "Wrong Password",
		RoomNotExist:      "Room Not Exists",
		OtherHostSyncing:  "Other Host Is Syncing",
	},
}

func GetErrorMessage(language string) *ErrorMessage {
	em, ok := emLanguages[language]
	if ok {
		return em
	} else {
		// en-us by default
		return emLanguages["en-us"]
	}
}
