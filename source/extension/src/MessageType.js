const MessageType = {
    ActivatedVideo: 1,
    ReportVideo: 2,
    SyncMemberVideo: 3,
    SyncMasterVideo: 4,
    UpdateStatusText: 5,
    JumpToNewPage: 6,
    GetRoomData: 7,
    ChangeVoiceVolume: 8,
    ChangeVideoVolume: 9,

    FetchRequest: 13,
    FetchResponse: 14,

    SetStorageValue: 15,
    SyncStorageValue: 16,

    ExtensionInitSuccess: 17,

    SetTabStorage: 18,
    SetTabStorageSuccess: 19,

    UpdateRoomRequest: 20,
    CallScheduledTask: 21,

    RoomDataNotification: 22,
    UpdateMemberStatus: 23,
    TimestampV2Resp: 24,
    // EasyShareCheckSucc: 25,
    FetchRealUrlReq: 26,
    FetchRealUrlResp: 27,
    FetchRealUrlFromIframeReq: 28,
    FetchRealUrlFromIframeResp: 29,
    SendTxtMsg: 30,
    GotTxtMsg: 31,
    StartDownload: 32,
    DownloadStatus: 33,
    ExtMessageTo: 34,
    InitMsgChan: 35,
    TopFrameState: 36,
    RequestTopFrameState: 37,

    UpdateM3u8Files: 1001,

    SaveIndexedDb: 2001,
    ReadIndexedDb: 2002,
    SaveIndexedDbResult: 2003,
    ReadIndexedDbResult: 2004,
    RegexMatchKeysDb: 2005,
    RegexMatchKeysDbResult: 2006,
    DeleteFromIndexedDb: 2007,
    DeleteFromIndexedDbResult: 2008,
    StorageEstimate: 2009,
    StorageEstimateResult: 2010,
    ReadIndexedDbSw: 2011,
    ReadIndexedDbSwResult: 2012,
    //2013 used

    IosStorageSet: 3001,
    IosStorageSetResult: 3002,
    IosStorageGet: 3003,
    IosStorageGetResult: 3004,
    IosStorageDelete: 3005,
    IosStorageDeleteResult: 3006,
    IosStorageUsage: 3007,
    IosStorageUsageResult: 3008,
    IosStorageCompact: 3009,
    IosStorageDeletePrefix: 3010,
    IosStorageDeletePrefixResult: 3011,
}

//delete-this-begin
module.exports = { MessageType };
//delete-this-end
