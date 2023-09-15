//
//  SwiftStore.swift
//  SwiftStore
//
//  Created by Hemanta Sapkota on 4/05/2015.
//  Copyright (c) 2015 Hemanta Sapkota. All rights reserved.
//

import Foundation

open class SwiftStore {
  
  var db:Store!
  
  public init(storeName: String) {
    db = Store(dbName: storeName)
  }
  
  public subscript(key: String) -> String? {
    get {
      return db.get(key)
    }
    
    set(newValue) {
      db.put(key, value: newValue!)
    }
  }
  
  public func delete(key: String) -> Bool {
    return db.delete(key)
  }
  
  public func collect(key: String) -> [String] {
    return db.iterate(key) as! [String]
  }
    
  public func findKeys(key: String) -> [String] {
    return db.findKeys(key) as! [String]
  }
  
  public func deleteCollection(keys: [String]) -> Bool {
    return db.deleteBatch(keys)
  }
  
    public func clean(){
        db.clean()
    }
    
  public func close() {
    db.close()
  }
}
