/**
 * manage_tag.js - 태그 관리를 위한 통합 JavaScript 라이브러리
 * 모든 페이지에서 태그 캐시 관리 및 인증을 처리할 수 있습니다.
 */

const TagManager = {
    // 초기화 상태
    initialized: false,

    // 대기 중인 콜백들
    pendingCallbacks: {},

    /**
     * 초기화
     */
    init: function() {
        if (this.initialized) return;

        // 콜백 함수들 등록
        this.registerCallbacks();
        this.initialized = true;

        console.log('TagManager initialized');
    },

    /**
     * 특정 태그의 캐시 제거
     * @param {string} uid - 태그 UID
     * @param {function} callback - 완료 콜백 (선택사항)
     */
    removeFromCache: function(uid, callback) {
        if (!uid) {
            console.error('UID is required');
            if (callback) callback(false, 'UID is required');
            return;
        }

        // 콜백 저장
        if (callback) {
            this.pendingCallbacks[`remove_${uid}`] = callback;
        }

        if (window.Android && window.Android.removeTagFromCache) {
            window.Android.removeTagFromCache(uid);
        } else {
            console.error('removeTagFromCache interface not available');
            if (callback) callback(false, 'Interface not available');
        }
    },

    /**
     * 여러 태그의 캐시 일괄 제거
     * @param {string[]} uids - 태그 UID 배열
     * @param {function} callback - 완료 콜백 (선택사항)
     */
    removeMultipleFromCache: function(uids, callback) {
        if (!uids || !Array.isArray(uids) || uids.length === 0) {
            console.error('UIDs array is required');
            if (callback) callback(false, 'UIDs array is required');
            return;
        }

        // 콜백 저장
        if (callback) {
            this.pendingCallbacks.removeMultiple = callback;
        }

        if (window.Android && window.Android.removeMultipleTagsFromCache) {
            window.Android.removeMultipleTagsFromCache(JSON.stringify(uids));
        } else {
            console.error('removeMultipleTagsFromCache interface not available');
            if (callback) callback(false, 'Interface not available');
        }
    },

    /**
     * 태그 인증 확인
     * @param {string} uid - 태그 UID
     * @param {boolean} ignoreCache - 캐시 무시 여부 (기본값: false)
     * @param {function} callback - 결과 콜백 (선택사항)
     */
    verifyAuthenticity: function(uid, ignoreCache = false, callback) {
        if (!uid) {
            console.error('UID is required');
            if (callback) callback(false, 'UID is required');
            return;
        }

        // 콜백 저장
        if (callback) {
            this.pendingCallbacks[`verify_${uid}`] = callback;
        }

        if (window.Android && window.Android.verifyTagAuthenticityWithOptions) {
            window.Android.verifyTagAuthenticityWithOptions(uid, ignoreCache);
        } else if (window.Android && window.Android.verifyTagAuthenticity && !ignoreCache) {
            // 기존 메소드 사용 (캐시 무시 불가)
            window.Android.verifyTagAuthenticity(uid);
        } else {
            console.error('verifyTagAuthenticity interface not available');
            if (callback) callback(false, 'Interface not available');
        }
    },

    /**
     * 태그의 캐시 상태 확인
     * @param {string} uid - 태그 UID
     * @param {function} callback - 결과 콜백 (선택사항)
     */
    checkCacheStatus: function(uid, callback) {
        if (!uid) {
            console.error('UID is required');
            if (callback) callback(null, 'UID is required');
            return;
        }

        // 콜백 저장
        if (callback) {
            this.pendingCallbacks[`status_${uid}`] = callback;
        }

        if (window.Android && window.Android.checkTagCacheStatus) {
            window.Android.checkTagCacheStatus(uid);
        } else {
            console.error('checkTagCacheStatus interface not available');
            if (callback) callback(null, 'Interface not available');
        }
    },

    /**
     * 전체 캐시 동기화
     * @param {function} callback - 완료 콜백 (선택사항)
     */
    syncCache: function(callback) {
        if (callback) {
            this.pendingCallbacks.sync = callback;
        }

        if (window.Android && window.Android.syncTagCache) {
            window.Android.syncTagCache();
        } else {
            console.error('syncTagCache interface not available');
            if (callback) callback(false, 'Interface not available');
        }
    },

    /**
     * 전체 캐시 상태 확인
     * @param {function} callback - 결과 콜백 (선택사항)
     */
    getCacheStatus: function(callback) {
        if (callback) {
            this.pendingCallbacks.cacheStatus = callback;
        }

        if (window.Android && window.Android.getCacheStatus) {
            window.Android.getCacheStatus();
        } else {
            console.error('getCacheStatus interface not available');
            if (callback) callback(null, 'Interface not available');
        }
    },

    /**
     * 콜백 함수 등록
     */
    registerCallbacks: function() {
        const self = this;

        // 태그 캐시 제거 완료
        window.onTagCacheRemoved = function(uid) {
            console.log('Tag removed from cache:', uid);

            const callbackKey = `remove_${uid}`;
            if (self.pendingCallbacks[callbackKey]) {
                self.pendingCallbacks[callbackKey](true, uid);
                delete self.pendingCallbacks[callbackKey];
            }

            // 전역 이벤트 발생
            self.dispatchEvent('tagCacheRemoved', { uid: uid });
        };

        // 여러 태그 캐시 제거 완료
        window.onMultipleTagsCacheRemoved = function(count) {
            console.log('Multiple tags removed from cache:', count);

            if (self.pendingCallbacks.removeMultiple) {
                self.pendingCallbacks.removeMultiple(true, count);
                delete self.pendingCallbacks.removeMultiple;
            }

            // 전역 이벤트 발생
            self.dispatchEvent('multipleTagsCacheRemoved', { count: count });
        };

        // 태그 인증 결과
        window.onTagAuthenticationResult = function(result) {
            console.log('Tag authentication result:', result);

            const callbackKey = `verify_${result.uid}`;
            if (self.pendingCallbacks[callbackKey]) {
                self.pendingCallbacks[callbackKey](result.isAuthenticated, result.message);
                delete self.pendingCallbacks[callbackKey];
            }

            // 전역 이벤트 발생
            self.dispatchEvent('tagAuthenticationResult', result);
        };

        // 태그 캐시 상태
        window.onTagCacheStatusReceived = function(status) {
            console.log('Tag cache status:', status);

            const callbackKey = `status_${status.uid}`;
            if (self.pendingCallbacks[callbackKey]) {
                self.pendingCallbacks[callbackKey](status, null);
                delete self.pendingCallbacks[callbackKey];
            }

            // 전역 이벤트 발생
            self.dispatchEvent('tagCacheStatusReceived', status);
        };

        // 전체 캐시 상태
        window.onCacheStatusReceived = function(status) {
            console.log('Cache status:', status);

            if (self.pendingCallbacks.cacheStatus) {
                self.pendingCallbacks.cacheStatus(status, null);
                delete self.pendingCallbacks.cacheStatus;
            }

            // 전역 이벤트 발생
            self.dispatchEvent('cacheStatusReceived', status);
        };

        // 기존 콜백 함수들과의 호환성
        const originalOnTagAuthenticated = window.onTagAuthenticated;
        window.onTagAuthenticated = function(uid) {
            // 기존 함수 호출
            if (originalOnTagAuthenticated) {
                originalOnTagAuthenticated(uid);
            }

            // TagManager 이벤트
            self.dispatchEvent('tagAuthenticated', { uid: uid });
        };

        const originalOnTagNotAuthenticated = window.onTagNotAuthenticated;
        window.onTagNotAuthenticated = function(uid) {
            // 기존 함수 호출
            if (originalOnTagNotAuthenticated) {
                originalOnTagNotAuthenticated(uid);
            }

            // TagManager 이벤트
            self.dispatchEvent('tagNotAuthenticated', { uid: uid });
        };
    },

    /**
     * 커스텀 이벤트 발생
     */
    dispatchEvent: function(eventName, detail) {
        const event = new CustomEvent('tagmanager:' + eventName, {
            detail: detail,
            bubbles: true,
            cancelable: true
        });
        document.dispatchEvent(event);
    },

    /**
     * 이벤트 리스너 추가 헬퍼
     */
    addEventListener: function(eventName, callback) {
        document.addEventListener('tagmanager:' + eventName, function(e) {
            callback(e.detail);
        });
    },

    /**
     * 이벤트 리스너 제거 헬퍼
     */
    removeEventListener: function(eventName, callback) {
        document.removeEventListener('tagmanager:' + eventName, callback);
    }
};

// 유틸리티 함수들

/**
 * 태그 캐시 제거 후 재인증
 */
TagManager.refreshTag = function(uid, callback) {
    // 1. 캐시에서 제거
    this.removeFromCache(uid, (success) => {
        if (!success) {
            if (callback) callback(false, 'Failed to remove from cache');
            return;
        }

        // 2. 서버에서 재인증
        setTimeout(() => {
            this.verifyAuthenticity(uid, true, callback);
        }, 100);
    });
};

/**
 * 태그 정보 갱신 (캐시 제거 + 재조회)
 */
TagManager.refreshTagInfo = function(uid, callback) {
    // 1. 캐시에서 제거
    this.removeFromCache(uid, (success) => {
        if (!success) {
            if (callback) callback(false, 'Failed to remove from cache');
            return;
        }

        // 2. Firestore에서 직접 조회
        if (window.FirestoreDirectAccess) {
            FirestoreDirectAccess.getTagByUid(uid);
            if (callback) {
                // FirestoreDirectAccess의 콜백 대기
                const originalCallback = window.onFirestoreQueryResult;
                window.onFirestoreQueryResult = function(results) {
                    if (originalCallback) originalCallback(results);
                    if (results && results.length > 0) {
                        callback(true, results[0]);
                    } else {
                        callback(false, 'Tag not found');
                    }
                };
            }
        } else {
            // Firestore 직접 접근이 없으면 인증만 재확인
            this.verifyAuthenticity(uid, true, callback);
        }
    });
};

/**
 * 태그 상태 종합 확인
 */
TagManager.getTagFullStatus = function(uid, callback) {
    const status = {
        uid: uid,
        cacheStatus: null,
        authStatus: null,
        firestoreData: null
    };

    let pendingChecks = 3;

    function checkComplete() {
        pendingChecks--;
        if (pendingChecks === 0 && callback) {
            callback(status);
        }
    }

    // 1. 캐시 상태 확인
    this.checkCacheStatus(uid, (cacheStatus) => {
        status.cacheStatus = cacheStatus;
        checkComplete();
    });

    // 2. 인증 상태 확인 (캐시 사용)
    this.verifyAuthenticity(uid, false, (isAuth, message) => {
        status.authStatus = { isAuthenticated: isAuth, message: message };
        checkComplete();
    });

    // 3. Firestore 데이터 조회 (가능한 경우)
    if (window.FirestoreDirectAccess) {
        const originalCallback = window.onFirestoreQueryResult;
        window.onFirestoreQueryResult = function(results) {
            if (originalCallback) originalCallback(results);
            status.firestoreData = results && results.length > 0 ? results[0] : null;
            checkComplete();
        };
        FirestoreDirectAccess.getTagByUid(uid);
    } else {
        checkComplete();
    }
};

// 자동 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        TagManager.init();
    });
} else {
    TagManager.init();
}

// 전역 객체로 노출
window.TagManager = TagManager;