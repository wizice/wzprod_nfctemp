// admin_session_check.js
// 모든 관리자 페이지에서 포함해야 할 세션 체크 스크립트

(function() {
    'use strict';
    
    // 상수 정의
    const STORAGE_KEYS = {
        LOGIN_STATE: 'admin_login_state'
    };
    
    // 로그인 상태 확인 함수
    function checkAdminSession() {
        const savedLoginState = localStorage.getItem(STORAGE_KEYS.LOGIN_STATE);
        
        if (!savedLoginState) {
            redirectToLogin('로그인이 필요합니다.');
            return false;
        }
        
        try {
            const loginState = JSON.parse(savedLoginState);
            const currentTime = Date.now();
            const loginTime = loginState.loginTime;
            const expirationTime = 24 * 60 * 60 * 1000; // 24시간
            
            // 로그인 시간이 24시간을 초과했는지 확인
            if (currentTime - loginTime > expirationTime) {
                localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
                redirectToLogin('세션이 만료되었습니다. 다시 로그인해주세요.');
                return false;
            }
            
            // 사용자 정보 표시 (페이지에 userName 엘리먼트가 있다면)
            const userNameElement = document.getElementById('userName');
            if (userNameElement && loginState.username) {
                userNameElement.textContent = loginState.username;
            }
            
            return true;
            
        } catch (error) {
            console.error('Error parsing login state:', error);
            localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
            redirectToLogin('세션 정보가 손상되었습니다. 다시 로그인해주세요.');
            return false;
        }
    }
    
    // 로그인 페이지로 리디렉션
    function redirectToLogin(message) {
        if (message) {
            // 토스트 메시지 표시
            showSessionToast(message, 'warning');
        }
        
        setTimeout(() => {
            // 기존 방식 사용 - Android가 있으면 Android 방식으로
            if (window.Android && window.Android.redirectToLogin) {
                window.Android.redirectToLogin();
            } else {
                // Android가 없는 웹 환경에서만 직접 이동
                const loginUrl = 'nfc_admin_login.html?ts=' + new Date().getTime();
                if (typeof gwzCommon !== 'undefined' && gwzCommon.fn_move_url) {
                    gwzCommon.fn_move_url(loginUrl);
                } else {
                    window.location.href = loginUrl;
                }
            }
        }, 1500);
    }
    
    // 세션용 토스트 메시지
    function showSessionToast(message, type = 'info') {
        // 기존 토스트가 있는지 확인
        let toast = document.getElementById('sessionToast');
        
        if (!toast) {
            // 토스트 엘리먼트 생성
            toast = document.createElement('div');
            toast.id = 'sessionToast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 12px 20px;
                border-radius: 6px;
                color: white;
                font-weight: 500;
                z-index: 10000;
                opacity: 0;
                transform: translateY(-20px);
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            `;
            document.body.appendChild(toast);
        }
        
        // 타입별 색상 설정
        const colors = {
            success: '#4CAF50',
            error: '#f44336',
            warning: '#ff9800',
            info: '#2196F3'
        };
        
        toast.style.backgroundColor = colors[type] || colors.info;
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        
        // 3초 후 자동 숨김
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
        }, 3000);
    }
    
    // 로그아웃 함수
    function adminLogout() {
        localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
        sessionStorage.removeItem('currentUser');
        
        showSessionToast('로그아웃되었습니다.', 'info');
        
        setTimeout(() => {
            // 기존 방식 유지 - Android 우선
            if (window.Android && window.Android.logout) {
                window.Android.logout();
            } else {
                redirectToLogin();
            }
        }, 1000);
    }
    
    // 현재 사용자 정보 가져오기
    function getCurrentAdminUser() {
        const savedLoginState = localStorage.getItem(STORAGE_KEYS.LOGIN_STATE);
        
        if (savedLoginState) {
            try {
                return JSON.parse(savedLoginState);
            } catch (error) {
                console.error('Error parsing login state:', error);
                return null;
            }
        }
        
        return null;
    }
    
    // 페이지 로드 시 자동 실행
    document.addEventListener('DOMContentLoaded', function() {
        // 로그인 페이지가 아닌 경우에만 세션 체크
        if (!window.location.pathname.includes('login')) {
            checkAdminSession();
            
            // 주기적으로 세션 체크 (5분마다)
            setInterval(checkAdminSession, 5 * 60 * 1000);
            
            // 페이지 포커스 시 세션 체크
            window.addEventListener('focus', checkAdminSession);
            
            // 사용자 활동 감지 시 마지막 활동 시간 업데이트
            ['click', 'keypress', 'scroll', 'mousemove'].forEach(event => {
                document.addEventListener(event, updateLastActivity, { passive: true });
            });
        }
    });
    
    // 마지막 활동 시간 업데이트
    function updateLastActivity() {
        const loginState = getCurrentAdminUser();
        if (loginState) {
            loginState.lastActivity = Date.now();
            localStorage.setItem(STORAGE_KEYS.LOGIN_STATE, JSON.stringify(loginState));
        }
    }
    
    // 전역 함수로 노출
    window.adminSession = {
        check: checkAdminSession,
        logout: adminLogout,
        getCurrentUser: getCurrentAdminUser,
        isLoggedIn: function() {
            return checkAdminSession();
        }
    };
    
})();