//
//  OLDB.h
//  LevelDBTest
//
//  Created by Hemanta Sapkota on 1/05/2015.
//  Copyright (c) 2015 Hemanta Sapkota. All rights reserved.
//

#import <Foundation/Foundation.h>

@interface Store : NSObject

-(instancetype)initWithDBName:(NSString *) dbName;

-(NSString *)get:(NSString *)key;

-(bool)put:(NSString *)key value:(NSString *)value;

-(bool)delete:(NSString *)key;

-(bool)deleteBatch:(NSArray *)keys;

-(NSArray *)iterate:(NSString *)key;

-(NSArray *)findKeys:(NSString *)key;

-(void)clean;

-(void)close;

@end
