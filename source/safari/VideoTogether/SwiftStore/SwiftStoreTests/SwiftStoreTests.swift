//
//  SwiftStoreTests.swift
//  SwiftStore
//
//  Created by Hemanta Sapkota on 4/05/2015.
//  Copyright (c) 2015 Hemanta Sapkota. All rights reserved.
//

import UIKit
import XCTest
import SwiftStore

var q1 = DispatchQueue(label: "q1", attributes: [])

var q2 = DispatchQueue(label: "q2", attributes: [])

class SwiftStoreTests: XCTestCase {

    var store: SwiftStore!
  
    override func setUp() {
        store = SwiftStore(storeName: "db")
        super.setUp()
    }
  
    func testWrites() {
        store["apple"] = "ball"
        for i in (0 ..< 1000) {
              store["\(i)"] = "\(i)"
        }
    }

    func testReads() {
        XCTAssert(store["apple"] == "ball", "Apple -> Ball")
        for i in (0 ..< 1000) {
            XCTAssert(store["\(i)"] == "\(i)", "Written value should be read")
        }
    }

    func testMultiThreadedReads() {

        self.store["item1"] = "10"

//        dispatch_async(q1, { () -> Void in
//            self.store["item1"] = "10"
//        })

//        dispatch_async(q2, { () -> Void in
//            self.store["item1"] = "20"
//        })

        let secs = Int64(3 * Double(NSEC_PER_SEC))
        let time = DispatchTime.now() + Double(secs) / Double(NSEC_PER_SEC)
        DispatchQueue.main.asyncAfter(deadline: time, execute: { () -> Void in
            let value = self.store["item1"]
            print(value)
        })

    }
    
    func testCollection() {
        
        var r1Keys = [String]()
        for i in (0 ..< 20) {
            let key = "r1-\(i)"
            r1Keys.append(key)
            
            store[key] = "r1-\(i)"
        }
        
        var r2Keys = [String]()
        for i in (0 ..< 30) {
            let key = "r2-\(i)"
            r1Keys.append(key)
            
            store[key] = "r2-\(i)"
        }
        
        var r1 = store.collect(key: "r1")
        XCTAssertEqual(r1.count, 20, "Length of collected range should be 20.")

        var r2 = store.collect(key: "r2")
        XCTAssertEqual(r2.count, 30, "Length of collected range should be 30.")
        
        // Delete collection of first keys
        store.deleteCollection(keys: r1Keys)
        
        r1 = store.collect(key: "r1")
        
        XCTAssertEqual(r1.count, 0, "After deleting a collection, the length should be 0.")
        
        // Delete second set of keys
        store.deleteCollection(keys: r2Keys)
        
        r2 = store.collect(key: "r2")
        
        XCTAssertEqual(r2.count, 0, "After deleting a collection, the length should be 0.")
        
        
    }
    
    func testFindKeys() {
        // test non-existent key
        XCTAssertEqual(store.findKeys(key: "r0").count, 0,  "Length of r0 should be 0.")
        for i in (0 ..< 10) {
            let key = "r1-\(i)"
            store[key] = "r1-\(i)"
        }
        for i in (0 ..< 20) {
            let key = "r2-\(i)"
            store[key] = "r2-\(i)"
        }
        XCTAssertEqual(store.findKeys(key: "r1").count, 10, "Length of r1 should be 10.")
        XCTAssertEqual(store.findKeys(key: "r2").count, 20, "Length of r2 should be 20.")
    }

    override func tearDown() {
        store.close()
        super.tearDown()
    }
  
}
