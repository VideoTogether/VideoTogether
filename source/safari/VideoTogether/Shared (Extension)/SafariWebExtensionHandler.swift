//
//  SafariWebExtensionHandler.swift
//  Shared (Extension)
//
//  Created by 胖孩 on 10/8/22.
//

import SafariServices
import os.log
import Objective_LevelDB
let SFExtensionMessageKey = "message"

struct MessageData:Decodable{
    // storage.set and get
    let key: String?
    let value: String?
    
    // compact
    let beginKey: String?
    let endKey: String?
    
    //
    let prefix: String?
}

struct ExtensionMessage:Decodable{
    let source:String
    let type:Int
    let id:String
    let data: MessageData?
}

func extractDBName(from string: String) -> String {
    let pattern = ".*-m3u8Id-.*?-end-"
    do {
        let regex = try NSRegularExpression(pattern: pattern, options: [])
        if let match = regex.firstMatch(in: string, options: [], range: NSRange(location: 0, length: string.count)) {
            let range = match.range(at: 0)
            let startIndex = string.index(string.startIndex, offsetBy: range.location)
            let endIndex = string.index(startIndex, offsetBy: range.length)
            return String(string[startIndex..<endIndex])
        }
    } catch {
        print("Invalid regex: \(error.localizedDescription)")
    }
    return "db"
}

public class DB  {
    /* Shared Instance */
    static let store = DB()
    
    let lock = NSLock()
    var ldb:LevelDB
    var dbName: String
    init() {
        self.ldb = LevelDB.databaseInLibrary(withName: "db") as! LevelDB
        dbName = "db"
    }
    
    func getDB(key: String)->LevelDB {
        lock.lock()
        defer { lock.unlock() }
        let newDbName = extractDBName(from: key)
        if(newDbName != dbName){
            dbName = newDbName;
            self.ldb = LevelDB.databaseInLibrary(withName: newDbName)  as! LevelDB
        }
        return self.ldb
    }
    
    func delete(key: String){
        self.getDB(key: key).removeObject(forKey: key)
    }
    
    func put(key:String, value: String){
        self.getDB(key: key).setObject(value, forKey: key)
    }
    
    func get(key:String)->String{
        let value =  self.getDB(key: key).object(forKey: key)
        if(value==nil){
            return ""
        }
        return value as! String
    }
    
    func compact(beginKey: String, endKey: String){
        self.getDB(key: beginKey).compact(beginKey, endKey)
    }

    func deleteByPrefix(prefix:String){
        let dbName = extractDBName(from: prefix)
        if(prefix==dbName){
            self.getDB(key: dbName).deleteDatabaseFromDisk()
        }else{
            self.getDB(key: prefix).removeAllObjects(withPrefix: prefix)
        }
    }
}

class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {

    func beginRequest(with context: NSExtensionContext) {
        guard let item = context.inputItems[0] as? NSExtensionItem,
              let message = item.userInfo?[SFExtensionMessageKey],
              let data = try? JSONSerialization.data(withJSONObject: message, options: []) else { return }
        os_log(.default, "Received message from browser.runtime.sendNativeMessage: %@", message as! CVarArg)

        let response = NSExtensionItem()

        let jsonDecoder = JSONDecoder()
        var respData: [String: Any] = ["source":"VideoTogether"]
        var respType: Int = -1
        if let msg = try? jsonDecoder.decode(ExtensionMessage.self, from: data) {
            if msg.source != "VideoTogether" {
                return;
            }
            respData["id"] = msg.id
            switch(msg.type){
            case 3001:
                DB.store.put(key: msg.data!.key!, value: msg.data!.value!)
                respType = 3002
                break;
            case 3003:
                let value = DB.store.get(key: msg.data!.key!)
                respData["value"] = value
                respType = 3004
                break;
            case 3005:
                DB.store.delete(key: msg.data!.key!)
                respType = 3006
                break;
            case 3007:
                func calculateDiskUsage() -> UInt64 {
                    let fileManager = FileManager.default
                    guard let libraryURL = fileManager.urls(for: .libraryDirectory, in: .userDomainMask).first else { return 0 }

                    var totalSize: UInt64 = 0
                    
                    if let enumerator = fileManager.enumerator(at: libraryURL, includingPropertiesForKeys: [.fileSizeKey], options: [], errorHandler: nil) {
                        
                        for case let fileURL as URL in enumerator {
                            do {
                                let fileAttributes = try fileURL.resourceValues(forKeys: [.fileSizeKey])
                                if let fileSize = fileAttributes.fileSize {
                                    totalSize += UInt64(fileSize)
                                }
                            } catch {
                                // Handle error
                                print("Error getting file attributes: \(error)")
                            }
                        }
                    }

                    return totalSize
                }
                let size = calculateDiskUsage()
                respType = 3008
                respData["usage"] = size
                break;
            case 3009:
                DB.store.compact(beginKey: msg.data!.beginKey!, endKey:  msg.data!.endKey! )
                break;
            case 3010:
                DB.store.deleteByPrefix(prefix: msg.data!.prefix!)
                respType = 3011
                break;
            default:
                break;
            }
        }
        
        respData["type"] = respType
        
        
        response.userInfo = [ SFExtensionMessageKey:respData]

        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

}
