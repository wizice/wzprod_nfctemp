// admin_dashboard.js - 관리자 대시보드 기능 (개선된 버전)

let currentUser = null;
let dashboardStats = {
    totalTags: 0,
    activeTags: 0,
    todayMeasurements: 0,
    totalAdmins: 0,
    measuringTags: 0,
    activeSessions: 0
};

// 페이지 로드 시 초기화
$(document).ready(function() {
    initializeDashboard();

    // 로그아웃 버튼 이벤트
    $('#adminLogoutBtn').click(function() {
        logout();
    });

    //nfc_admin_users
    $('.nfc_admin_users').click(function() {
            let move_url = "nfc_admin_users.html?ts=" + new Date().getTime();
            gwzCommon.fn_move_url( move_url );
    });

    //nfc_admin_tags
    $('.nfc_admin_tags').click(function() {
            let move_url = "nfc_admin_tags.html?ts=" + new Date().getTime();
            gwzCommon.fn_move_url( move_url );
    });

    //nfc_admin_measurements
    $('.nfc_admin_measurements').click(function() {
            let move_url = "nfc_admin_measurements.html?ts=" + new Date().getTime();
            gwzCommon.fn_move_url( move_url );
    });

    //nfc_admin_logs
    $('.nfc_admin_logs').click(function() {
            let move_url = "nfc_admin_logs.html?ts=" + new Date().getTime();
            gwzCommon.fn_move_url( move_url );
    });

    //nfc_admin_system
    $('.nfc_admin_system').click(function() {
            let move_url = "nfc_admin_system.html?ts=" + new Date().getTime();
            gwzCommon.fn_move_url( move_url );
    });

    //nfc_admin_settings
    $('.nfc_admin_settings').click(function() {
            let move_url = "nfc_admin_settings.html?ts=" + new Date().getTime();
            gwzCommon.fn_move_url( move_url );
    });

    // 자동 새로고침 설정 (60초마다)
    setInterval(function() {
        loadDashboardStats();
    }, 60000);
});

// 대시보드 초기화
function initializeDashboard() {
    // 현재 사용자 정보 로드
    loadCurrentUser();

    // 통계 로드 - 개선된 V2 메서드 사용
    loadDashboardStats();

    // 권한에 따른 메뉴 표시/숨김
    updateMenuVisibility();
}

// 현재 사용자 정보 로드
function loadCurrentUser() {
    // 세션에서 사용자 정보 가져오기
    const userInfo = localStorage.getItem('currentUser');
    if (userInfo) {
        currentUser = JSON.parse(userInfo);
        updateUserDisplay();
    } else {
        // 로그인 페이지로 리다이렉트
        let move_url = "nfc_admin_login.html?ts=" + new Date().getTime();
        gwzCommon.fn_move_url(move_url);
    }
}

// 사용자 정보 표시 업데이트
function updateUserDisplay() {
    if (currentUser) {
        $('#login_userName').text( currentUser.username);
    }
}

// 역할 표시명 변환
function getRoleDisplayName(role) {
    const roleNames = {
        'super_admin': 'Super Admin',
        'admin': 'Admin',
        'viewer': 'Viewer'
    };
    return roleNames[role] || role;
}

// 대시보드 통계 로드 - 개선된 버전
function loadDashboardStats() {
    const startTime = Date.now();

    // 로딩 표시
    showLoadingStats(true);

    // getDashboardStatsV2 사용 - count 쿼리로 성능 개선
    if (window.Dashboard && window.Dashboard.getDashboardStatsV2) {
        const callbackId = 'dashboard-stats-v2-' + Date.now();
        window.Dashboard.getDashboardStatsV2(callbackId);
    } else if (window.Dashboard && window.Dashboard.getDashboardStats) {
        // V2를 사용할 수 없는 경우 기존 메서드 사용
        const callbackId = 'dashboard-stats-' + Date.now();
        window.Dashboard.getDashboardStats(callbackId);
    } else {
        console.error('app 에서 실행바랍니다.');
        showToast('앱에서만 사용 가능합니다.', 'error');
        showLoadingStats(false);
    }
}

// 통계 로드 성공 콜백
window.onDashboardStatsLoaded = function(callbackId, response) {
    try {
        const stats = JSON.parse(response);
        const loadTime = Date.now() - parseInt(callbackId.split('-').pop());

        console.log(`Dashboard stats loaded in ${loadTime}ms`);

        if (stats.success) {
            updateDashboardStats(stats);

            // 로드 시간이 길면 경고
            if (loadTime > 3000) {
                console.warn('Dashboard stats loading took too long:', loadTime + 'ms');
            }
        }
    } catch (e) {
        console.error('Failed to parse dashboard stats:', e);
        showToast('통계 데이터 파싱 오류', 'error');
    } finally {
        showLoadingStats(false);
    }
};

// 통계 로드 실패 콜백
window.onDashboardStatsError = function(callbackId, error) {
    console.error('Dashboard stats error:', error);
    showToast('통계 로드 실패: ' + error, 'error');
    showLoadingStats(false);
};

// 대시보드 통계 업데이트
function updateDashboardStats(stats) {
    // 통계 데이터 저장
    dashboardStats = stats;

    // UI 업데이트 - 애니메이션 효과 추가
    animateNumber($('#totalTags'), stats.totalTags || 0);
    animateNumber($('#activeTags'), stats.activeTags || 0);
    animateNumber($('#todayMeasurements'), stats.recentMeasurements || 0);
    animateNumber($('#totalAdmins'), stats.totalAdmins || 0);

    // 추가 통계 표시
    if (stats.inactiveTags !== undefined) {
        $('#inactiveTags').text(stats.inactiveTags);
    }

    if (stats.activeRate !== undefined) {
        $('#activeRate').text(stats.activeRate + '%');
        updateActiveRateIndicator(stats.activeRate);
    }

    if (stats.measuringTags !== undefined) {
        $('#measuringTags').text(stats.measuringTags);
    }

    if (stats.activeSessions !== undefined) {
        $('#activeSessions').text(stats.activeSessions);
    }

    // 마지막 업데이트 시간
    if (stats.lastUpdated) {
        const updateTime = new Date(stats.lastUpdated);
        $('#lastUpdated').text('마지막 업데이트: ' + formatTime(updateTime));
    }
}

// 숫자 애니메이션
function animateNumber($element, targetValue) {
    const currentValue = parseInt($element.text()) || 0;
    const increment = (targetValue - currentValue) / 20;
    let step = 0;

    const timer = setInterval(function() {
        step++;
        const newValue = Math.round(currentValue + (increment * step));
        $element.text(newValue);

        if (step >= 20) {
            $element.text(targetValue);
            clearInterval(timer);
        }
    }, 30);
}

// 활성화율 표시기 업데이트
function updateActiveRateIndicator(rate) {
    const $indicator = $('#activeRateIndicator');
    if ($indicator.length) {
        $indicator.css('width', rate + '%');

        // 색상 변경
        if (rate >= 80) {
            $indicator.removeClass('warning danger').addClass('success');
        } else if (rate >= 60) {
            $indicator.removeClass('success danger').addClass('warning');
        } else {
            $indicator.removeClass('success warning').addClass('danger');
        }
    }
}

// 통계 로딩 표시
function showLoadingStats(show) {
    if (show) {
        $('.stat-value').each(function() {
            $(this).html('<span class="spinner-border spinner-border-sm"></span>');
        });
    }
}

// 메뉴 가시성 업데이트
function updateMenuVisibility() {
    if (currentUser) {
        // Super Admin 전용 메뉴
        if (currentUser.role === 'super_admin') {
            $('#adminManagementMenu').show();
            $('#systemSettingsMenu').show();
        } else {
            $('#adminManagementMenu').hide();
            $('#systemSettingsMenu').hide();
        }

        // 권한별 메뉴 표시/숨김
        if (currentUser.permissions) {
            if (!currentUser.permissions.canViewReports) {
                $('.menu-item[href*="measurements"]').hide();
                $('.menu-item[href*="logs"]').hide();
            }
        }
    }
}

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
        // 세션 정리
        localStorage.removeItem('currentUser');
        localStorage.removeItem('authToken');

        // Android 네이티브 로그아웃 호출
        if (window.Android && window.Android.logout) {
            window.Android.logout();
        }

        // 로그인 페이지로 이동
        window.location.href = 'nfc_admin_login.html';
    }
}

// 시간 포맷
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
    const toast = $('#toast');
    toast.removeClass('show error success');

    if (type === 'error') {
        toast.addClass('error');
    } else if (type === 'success') {
        toast.addClass('success');
    }

    toast.text(message);
    toast.addClass('show');

    setTimeout(() => {
        toast.removeClass('show');
    }, 3000);
}

// 정품 마크 표시
function showCertificationMark() {
    $('#certificationMark').addClass('show');
}

// 정품 마크 숨김
function hideCertificationMark() {
    $('#certificationMark').removeClass('show');
}

// 권한 거부 콜백
window.onPermissionDenied = function(callbackId, message) {
    console.error('Permission denied:', message);
    showToast(message, 'error');

    // 로그인 페이지로 리다이렉트
    setTimeout(() => {
        window.location.href = 'nfc_admin_login.html';
    }, 2000);
};

// 뒤로 가기
function goBack() {

     let move_url     =   "nfc_admin_login.html?ts=" + new Date().getTime() ;
     gwzCommon.fn_move_url( move_url );

}
window.onBackPressed = function () {
    setTimeout(function(){
        goBack();
        }, 100);
    return false;
};
