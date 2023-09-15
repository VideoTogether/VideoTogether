//
//  OLDB.m
//  LevelDBTest
//
//  Created by Hemanta Sapkota on 1/05/2015.
//  Copyright (c) 2015 Hemanta Sapkota. All rights reserved.
//

#import "Store.h"

#include <iostream>
#include <sstream>
#include <string>

#import <leveldb/db.h>
#import <leveldb/write_batch.h>

using namespace std;

@implementation Store {
  leveldb::DB *db;
}

- (instancetype) initWithDBName:(NSString *) dbName {
  self = [super init];
  if (self) {
    [self createDB:dbName];
  }
  return self;
}

-(void)createDB:(NSString *) dbName {
  leveldb::Options options;
  options.create_if_missing = true;
  
  NSArray *paths = NSSearchPathForDirectoriesInDomains(NSDocumentDirectory, NSUserDomainMask, YES);
  
  /* Lock Folder */
  NSError *error = nil;
  NSString *dbPath = [paths[0] stringByAppendingPathComponent:dbName];
  /* Create lock file. For some reason, leveldb cannot create the LOCK directory. So we make it. */
  NSString *lockFolderPath = [dbPath stringByAppendingPathComponent:@"LOCK"];
  
  NSFileManager *mgr = [NSFileManager defaultManager];
  if (![mgr fileExistsAtPath:lockFolderPath]) {
    NSURL *url = [NSURL fileURLWithPath:dbPath];
    [mgr createDirectoryAtURL:url withIntermediateDirectories:YES attributes:nil error:&error];
    
    if (error != nil) {
        NSLog(@"%@", error);
        return;
    }
  }
  /* End lock folder */
  
  leveldb::Status status = leveldb::DB::Open(options, [dbPath UTF8String], &self->db);
  if (false == status.ok()) {
      NSLog(@"ERROR: Unable to open/create database.");
      std::cout << status.ToString();
  } else {
      NSLog(@"INFO: Database setup.");
  }
}

-(NSArray *)findKeys:(NSString *)key {
    leveldb::ReadOptions readOptions;
    leveldb::Iterator *it = db->NewIterator(readOptions);
    
    leveldb::Slice slice = leveldb::Slice(key.UTF8String);

    NSMutableArray *array = [[NSMutableArray alloc] init];
    
    for (it->Seek(slice); it->Valid() && it->key().starts_with(slice); it->Next()) {
        NSString *value = [[NSString alloc] initWithCString:it->value().ToString().c_str() encoding: NSUTF8StringEncoding];
        [array addObject:value];
    }
    delete it;
    
    return array;
}

-(NSArray *)iterate:(NSString *)key {
  leveldb::ReadOptions readOptions;
  leveldb::Iterator *it = db->NewIterator(readOptions);
  
  leveldb::Slice slice = leveldb::Slice(key.UTF8String);
  
  std::string endKey = key.UTF8String;
  endKey.append("0xFF");
  
  NSMutableArray *array = [[NSMutableArray alloc] init];
  
  for (it->Seek(slice); it->Valid() && it->key().ToString() < endKey; it->Next()) {
    NSString *value = [[NSString alloc] initWithCString:it->value().ToString().c_str() encoding:[NSString defaultCStringEncoding]];
    [array addObject:value];
  }
  delete it;
  
  return array;
}

-(bool)deleteBatch:(NSArray*)keys {
  leveldb::WriteBatch batch;
  
  for (int i=0; i <[keys count]; i++) {
    NSString *key = [keys objectAtIndex:i];
    leveldb::Slice slice = leveldb::Slice(key.UTF8String);
    batch.Delete(slice);
  }
  
  leveldb::Status s = self->db->Write(leveldb::WriteOptions(), &batch);
  return s.ok();
}

-(NSString *)get:(NSString *)key {
  ostringstream keyStream;
  keyStream << key.UTF8String;
  
  leveldb::ReadOptions readOptions;
  string value;
  leveldb::Status s = self->db->Get(readOptions, keyStream.str(), &value);
  
  NSString *nsstr = [[NSString alloc] initWithUTF8String:value.c_str()];
  
  return [nsstr stringByTrimmingCharactersInSet:[NSCharacterSet whitespaceCharacterSet]];
}

-(bool)put:(NSString *)key value:(NSString *)value {
  ostringstream keyStream;
  keyStream << key.UTF8String;
  
  ostringstream valueStream;
  valueStream << value.UTF8String;

  leveldb::WriteOptions writeOptions;
  leveldb::Status s = self->db->Put(writeOptions, keyStream.str(), valueStream.str());
  
  return s.ok();
}

-(bool)delete:(NSString *)key {
  ostringstream keySream;
  keySream << key.UTF8String;
  
  leveldb::WriteOptions writeOptions;
  leveldb::Status s = self->db->Delete(writeOptions, keySream.str());
  return s.ok();
}

-(void)clean {
    leveldb::Slice begin = leveldb::Slice("");
    leveldb::Slice end = leveldb::Slice("~");
    self->db->CompactRange(&begin, &end);
}

-(void)close {
  delete self->db;
}

@end
