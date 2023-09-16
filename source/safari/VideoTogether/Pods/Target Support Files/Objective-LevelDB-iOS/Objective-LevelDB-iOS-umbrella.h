#ifdef __OBJC__
#import <UIKit/UIKit.h>
#else
#ifndef FOUNDATION_EXPORT
#if defined(__cplusplus)
#define FOUNDATION_EXPORT extern "C"
#else
#define FOUNDATION_EXPORT extern
#endif
#endif
#endif

#import "Common.h"
#import "LDBSnapshot.h"
#import "LDBWriteBatch.h"
#import "LevelDB.h"

FOUNDATION_EXPORT double Objective_LevelDBVersionNumber;
FOUNDATION_EXPORT const unsigned char Objective_LevelDBVersionString[];

