// assets/js/nfc_admin_cache_management.js

/**
 * 태그 인증 캐시 관리 기능
 */

// 캐시 상태 확인
function checkCacheStatus() {
    if (window.Android && window.Android.getCacheStatus) {
        window.Android.getCacheStatus();
    } else {
        console.log('Cache status check not available');
    }
}

// 캐시 상태 수신 콜백
window.onCacheStatusReceived = function(status) {
    console.log('Cache status:', status);

    const lastSyncDate = status.lastSyncTime > 0 ? new Date(status.lastSyncTime) : null;
    const formattedDate = lastSyncDate ? lastSyncDate.toLocaleString('ko-KR') : '동기화 기록 없음';

    // 캐시 상태 판단
    let cacheStateHtml = '';
    if (status.cacheDuration === 0) {
        cacheStateHtml = '<span class="value disabled">비활성화</span>';
    } else if (status.isValid) {
        cacheStateHtml = '<span class="value valid">유효함</span>';
    } else {
        cacheStateHtml = '<span class="value expired">만료됨</span>';
    }

    const statusHtml = `
        <div class="cache-status-info">
            <h3>태그 인증 캐시 상태</h3>
            <div class="status-item">
                <span class="label">캐시된 태그 수:</span>
                <span class="value">${status.cachedTagCount}개</span>
            </div>
            <div class="status-item">
                <span class="label">캐시 유지 시간:</span>
                <span class="value">${status.cacheDuration === 0 ? '비활성화' : status.cacheDuration + '초'}</span>
            </div>
            <div class="status-item">
                <span class="label">캐시 상태:</span>
                ${cacheStateHtml}
            </div>
            <div class="status-item">
                <span class="label">마지막 동기화:</span>
                <span class="value">${formattedDate}</span>
            </div>
            ${status.cacheDuration === 0 ?
                '<div class="cache-warning">ℹ️ RemoteConfig에서 캐시가 비활성화되어 있습니다.</div>' :
                (!status.isValid ? '<div class="cache-warning">⚠️ 캐시가 만료되었습니다. 동기화를 실행해주세요.</div>' : '')}
        </div>
    `;

    // 상태를 표시할 요소가 있다면 업데이트
    const statusContainer = document.getElementById('cacheStatusContainer');
    if (statusContainer) {
        statusContainer.innerHTML = statusHtml;
    }

    // 토스트 메시지로도 표시
    showToast(`캐시된 태그: ${status.cachedTagCount}개`);
};

// 캐시 동기화
function syncTagCache() {
    if (window.Android && window.Android.syncTagCache) {
        showLoading('태그 캐시를 동기화하는 중...');
        window.Android.syncTagCache();
    } else {
        console.log('Cache sync not available');
    }
}

// 관리자 설정 페이지에 캐시 관리 UI 추가
function addCacheManagementUI() {
    const cacheSection = `
        <div class="settings-section cache-management">
            <h2>태그 인증 캐시 관리</h2>
            <div id="cacheStatusContainer" class="cache-status-container">
                <!-- 캐시 상태가 여기에 표시됩니다 -->
            </div>
            <div class="cache-actions">
                <button onclick="checkCacheStatus()" class="btn btn-info">
                    <i class="fas fa-info-circle"></i> 캐시 상태 확인
                </button>
                <button onclick="syncTagCache()" class="btn btn-sync">
                    <i class="fas fa-sync"></i> 캐시 동기화
                </button>
            </div>
            <div class="cache-info">
                <p><i class="fas fa-lightbulb"></i> 캐시 정보:</p>
                <ul>
                    <li>태그 인증 정보는 RemoteConfig 설정에 따라 캐시됩니다.</li>
                    <li>캐시 시간은 Firebase Console에서 'auth_tag_cache_time' 값으로 조정 가능합니다.</li>
                    <li>0으로 설정하면 캐시가 비활성화되어 항상 서버에서 확인합니다.</li>
                    <li>오프라인 상태에서도 유효한 캐시가 있다면 인증이 가능합니다.</li>
                </ul>
            </div>
        </div>
    `;

    // 설정 페이지의 적절한 위치에 삽입
    const settingsContainer = document.querySelector('.settings-container');
    if (settingsContainer) {
        settingsContainer.insertAdjacentHTML('beforeend', cacheSection);
    }
}

// 페이지 로드 시 캐시 관리 UI 추가
document.addEventListener('DOMContentLoaded', function() {
    if (window.location.pathname.includes('admin_settings')) {
        addCacheManagementUI();
        // 초기 캐시 상태 확인
        setTimeout(checkCacheStatus, 500);
    }
});
