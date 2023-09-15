[![Carthage compatible](https://img.shields.io/badge/Carthage-compatible-4BC51D.svg?style=flat)](https://github.com/Carthage/Carthage)

### SwiftStore ###
Key/Value store for Swift backed by LevelDB.

### Usage ###

#### Create instances of store ####

```swift
import SwiftStore

// Create a store.
let store = SwiftStore(storeName: "db")

// Write value
store["username"] = "jondoe"
store["auth-token"] = "cdfsd1231sdf12321"

// Get value
let username = store["username"]!
if !username.isEmpty {
  println(username)
}

let authToken = store["auth-token"]!
if !authToken.isEmpty {
  println(authToken)
}
```

#### As Singleton ####

```swift
class DB : SwiftStore {
    /* Shared Instance */
    static let store = DB()

    init() {
        super.init(storeName: "db")
    }

    override func close() {
        super.close()
    }
}

DB.store["username"] = "jondoe"
DB.store["auth-token"] = "1231sdfjl123"
```

### Installation ###

#### Carthage ####
* Add ```github "hemantasapkota/SwiftStore"``` to your ```cartfile```
* Execute ```carthage update```

#### Manual Installation ####
* Clone this repo: ```git clone https://github.com/hemantasapkota/SwiftStore/```
* Copy ```SwiftStore.xcodeproj``` to your project.
* Add ```SwiftStore.framework``` to the **Embedded Binaries** secion on the **General** tab of your main target.

### License ###
The MIT License (MIT)

Copyright (c) 2022 Hemanta Sapkota

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

