// 전역 변수
let isPasswordVisible = false;
let isLoading = false;

// 상수 정의 - 저장 키
const STORAGE_KEYS = {
    REMEMBER_ME: 'admin_remember_me',
    SAVED_ID: 'admin_saved_id',
    SAVED_PASSWORD: 'admin_saved_password',
    LOGIN_STATE: 'admin_login_state'
};

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // 자동 로그인 체크 (로그인 상태 확인)
    checkAutoLogin();
    
    // 저장된 로그인 정보 불러오기
    loadSavedCredentials();

    // 엔터키 이벤트 처리
    document.getElementById('adminId').addEventListener('keypress', handleEnterKey);
    document.getElementById('adminPassword').addEventListener('keypress', handleEnterKey);
});

// 자동 로그인 체크 - Android 방식 유지
function checkAutoLogin() {
    // localStorage에서 로그인 상태 확인 (sessionStorage 대신)
    const savedLoginState = localStorage.getItem(STORAGE_KEYS.LOGIN_STATE);
    
    if (savedLoginState) {
        try {
            const loginState = JSON.parse(savedLoginState);
            
            // 로그인 시간이 24시간 이내인지 확인 (토큰 만료 시간 체크)
            const currentTime = Date.now();
            const loginTime = loginState.loginTime;
            const expirationTime = 24 * 60 * 60 * 1000; // 24시간
            
            if (currentTime - loginTime < expirationTime) {
                // 여전히 유효한 로그인 상태
                console.log('Valid login state found, using Android navigation');
                
                // 사용자 정보 표시
                if (document.getElementById('userName')) {
                    document.getElementById('userName').textContent = loginState.username;
                }
                
                // Android 방식으로 페이지 이동 (기존과 동일)
                if (window.Android && window.Android.onAdminLoginSuccess) {
                    window.Android.onAdminLoginSuccess();
                } else {
                    // Android가 없는 웹 환경에서만 직접 이동
                    let move_url = "nfc_admin_main.html?ts=" + new Date().getTime();
                    if (typeof gwzCommon !== 'undefined' && gwzCommon.fn_move_url) {
                        gwzCommon.fn_move_url(move_url);
                    } else {
                        window.location.href = move_url;
                    }
                }
                return;
            } else {
                // 만료된 로그인 상태 제거
                localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
            }
        } catch (error) {
            console.error('Error parsing login state:', error);
            localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
        }
    }
}

// 저장된 로그인 정보 불러오기 - 웹과 Android 모두 지원
function loadSavedCredentials() {
    try {
        // 먼저 웹 localStorage에서 확인
        const rememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
        
        if (rememberMe) {
            const savedId = localStorage.getItem(STORAGE_KEYS.SAVED_ID);
            const savedPassword = localStorage.getItem(STORAGE_KEYS.SAVED_PASSWORD);
            
            if (savedId) {
                document.getElementById('adminId').value = savedId;
                document.getElementById('rememberMe').checked = true;
                
                if (savedPassword) {
                    // Base64 디코딩하여 비밀번호 복원
                    try {
                        document.getElementById('adminPassword').value = atob(savedPassword);
                    } catch (e) {
                        console.warn('Failed to decode saved password');
                    }
                }
            }
            return; // 웹에서 찾았으면 Android 체크 건너뛰기
        }
        
        // Android에서 저장된 정보 가져오기 (웹에서 없을 때만)
        if (window.Android && window.Android.getSavedCredentials) {
            const savedData = window.Android.getSavedCredentials();
            if (savedData) {
                const credentials = JSON.parse(savedData);
                if (credentials.savedId) {
                    document.getElementById('adminId').value = credentials.savedId;

                    // 비밀번호가 있는 경우에만 체크박스 활성화
                    if (credentials.savedPwd && credentials.savedPwd.length > 0) {
                        document.getElementById('rememberMe').checked = true;
                        document.getElementById('adminPassword').value = credentials.savedPwd;
                    } else {
                        // 비밀번호가 없으면 체크박스 해제
                        document.getElementById('rememberMe').checked = false;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Failed to load saved credentials:', error);
        // 오류 발생 시 저장된 정보 초기화
        clearSavedCredentials();
    }
}

// 저장된 자격 증명 삭제
function clearSavedCredentials() {
    localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
    localStorage.removeItem(STORAGE_KEYS.SAVED_ID);
    localStorage.removeItem(STORAGE_KEYS.SAVED_PASSWORD);
    
    if (window.Android && window.Android.clearSavedCredentials) {
        window.Android.clearSavedCredentials();
    }
}

// 자격 증명 저장
function saveCredentials(adminId, adminPassword, rememberMe) {
    if (rememberMe) {
        localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, 'true');
        localStorage.setItem(STORAGE_KEYS.SAVED_ID, adminId);
        // 보안을 위해 Base64 인코딩하여 저장 (실제 환경에서는 더 강력한 암호화 권장)
        localStorage.setItem(STORAGE_KEYS.SAVED_PASSWORD, btoa(adminPassword));
    } else {
        // Remember Me 체크 해제 시 저장된 정보 삭제
        clearSavedCredentials();
    }
}

// 엔터키 처리
function handleEnterKey(event) {
    if (event.key === 'Enter') {
        handleLogin();
    }
}

// 비밀번호 표시/숨기기 토글
function togglePassword() {
    const passwordInput = document.getElementById('adminPassword');
    const eyeIcon = document.querySelector('.eye-icon');
    const eyeOffIcon = document.querySelector('.eye-off-icon');

    isPasswordVisible = !isPasswordVisible;

    if (isPasswordVisible) {
        passwordInput.type = 'text';
        eyeIcon.style.display = 'none';
        eyeOffIcon.style.display = 'block';
    } else {
        passwordInput.type = 'password';
        eyeIcon.style.display = 'block';
        eyeOffIcon.style.display = 'none';
    }
}

// 로그인 처리 - 수정된 버전
function handleLogin() {
    if (isLoading) return;

    const adminId = document.getElementById('adminId').value.trim();
    const adminPassword = document.getElementById('adminPassword').value;
    const rememberMe = document.getElementById('rememberMe').checked;

    // 유효성 검사
    if (!adminId) {
        showToast('아이디를 입력해주세요.', 'error');
        document.getElementById('adminId').focus();
        return;
    }

    if (!adminPassword) {
        showToast('비밀번호를 입력해주세요.', 'error');
        document.getElementById('adminPassword').focus();
        return;
    }

    // 로딩 시작
    isLoading = true;
    showLoading(true);

    // 웹 환경에서의 자격 증명 저장 (로그인 시도 전에 저장)
    saveCredentials(adminId, adminPassword, rememberMe);

    // Android 인터페이스를 통한 Firestore 인증
    if (window.Android) {
        // verifyAdminLogin에서 rememberMe 값에 따라 저장/삭제 처리
        window.Android.verifyAdminLogin(adminId, adminPassword, rememberMe);
    } else {
        // 웹 환경에서의 테스트용 로그인 로직 (실제 환경에서는 서버 API 호출)
        setTimeout(() => {
            // 테스트용 간단한 인증 (실제로는 서버 API 호출해야 함)
            if (adminId === 'admin' && adminPassword === 'password') {
                onAdminLoginSuccess(adminId, 'admin');
            } else {
                onAdminLoginFailed('아이디 또는 비밀번호가 일치하지 않습니다.');
            }
        }, 1000);
    }
}

// 로그인 성공 콜백 - 기존 방식 유지
window.onAdminLoginSuccess = function(username, role) {
    console.log('Admin login success:', username, role);

    // 사용자 정보 저장 - localStorage 사용으로 변경하여 상태 유지
    const userInfo = {
        username: username,
        role: role || 'admin',
        loginTime: Date.now()
    };

    // sessionStorage 대신 localStorage 사용하여 탭 종료 후에도 유지
    localStorage.setItem(STORAGE_KEYS.LOGIN_STATE, JSON.stringify(userInfo));
    
    // 호환성을 위해 sessionStorage에도 저장
    sessionStorage.setItem('currentUser', JSON.stringify(userInfo));

    showLoading(false);
    showToast('로그인 성공!', 'success');

    // 사용자 이름 표시
    if (document.getElementById('userName')) {
        document.getElementById('userName').textContent = username;
    }

    // 기존 방식 그대로 유지 - Android가 페이지 이동 처리
    setTimeout(() => {
        if (window.Android && window.Android.onAdminLoginSuccess) {
            window.Android.onAdminLoginSuccess();
        } else {
            // Android가 없는 웹 환경에서만 직접 페이지 이동
            let move_url = "nfc_admin_main.html?ts=" + new Date().getTime();
            if (typeof gwzCommon !== 'undefined' && gwzCommon.fn_move_url) {
                gwzCommon.fn_move_url(move_url);
            } else {
                window.location.href = move_url;
            }
        }
    }, 500);
};

// 로그인 실패 콜백 - 수정된 버전
window.onAdminLoginFailed = function(message) {
    console.log('Admin login failed:', message);
    isLoading = false;
    showLoading(false);

    showToast(message || '아이디 또는 비밀번호가 일치하지 않습니다.', 'error');

    // 로그인 실패 시 저장된 비밀번호 삭제 (보안상 이유)
    const rememberMe = document.getElementById('rememberMe').checked;
    if (!rememberMe) {
        clearSavedCredentials();
    } else {
        // Remember Me가 체크되어 있어도 비밀번호만 삭제
        localStorage.removeItem(STORAGE_KEYS.SAVED_PASSWORD);
    }

    // 비밀번호 필드 초기화
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
};

// 로그아웃 함수 추가
function logout() {
    // 모든 저장된 로그인 상태 제거
    localStorage.removeItem(STORAGE_KEYS.LOGIN_STATE);
    sessionStorage.removeItem('currentUser');
    
    // Remember Me가 체크되지 않았다면 저장된 자격 증명도 제거
    const rememberMe = localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === 'true';
    if (!rememberMe) {
        clearSavedCredentials();
    }
    
    showToast('로그아웃되었습니다.', 'info');
    
    // 로그인 페이지로 이동
    setTimeout(() => {
        window.location.href = 'nfc_admin_login.html';
    }, 1000);
}

// 전역 함수로 노출
window.logout = logout;

// 비밀번호 변경 모달 표시
function showChangePassword() {
    document.getElementById('changePasswordModal').style.display = 'flex';
    document.getElementById('currentId').focus();
}

// 비밀번호 변경 모달 닫기
function closeChangePassword() {
    document.getElementById('changePasswordModal').style.display = 'none';

    // 입력 필드 초기화
    document.getElementById('currentId').value = '';
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
}

// 비밀번호 변경 처리
function handleChangePassword() {
    const currentId = document.getElementById('currentId').value.trim();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // 유효성 검사
    if (!currentId) {
        showToast('아이디를 입력해주세요.', 'error');
        document.getElementById('currentId').focus();
        return;
    }

    if (!currentPassword) {
        showToast('현재 비밀번호를 입력해주세요.', 'error');
        document.getElementById('currentPassword').focus();
        return;
    }

    if (!newPassword) {
        showToast('새 비밀번호를 입력해주세요.', 'error');
        document.getElementById('newPassword').focus();
        return;
    }

    if (newPassword.length < 6) {
        showToast('비밀번호는 최소 6자 이상이어야 합니다.', 'error');
        document.getElementById('newPassword').focus();
        return;
    }

    if (newPassword !== confirmPassword) {
        showToast('새 비밀번호가 일치하지 않습니다.', 'error');
        document.getElementById('confirmPassword').focus();
        return;
    }

    if (currentPassword === newPassword) {
        showToast('새 비밀번호는 현재 비밀번호와 달라야 합니다.', 'error');
        document.getElementById('newPassword').focus();
        return;
    }

    // 로딩 표시
    showLoading(true);

    // Android 인터페이스를 통한 비밀번호 변경
    if (window.Android && window.Android.updateAdminPassword) {
        window.Android.updateAdminPassword(currentId, currentPassword, newPassword);
    } else {
        // 웹 환경에서의 테스트 로직
        console.log('Password change attempt:', { currentId, newPassword });
        showLoading(false);
        
        // 테스트용 성공 처리 (실제로는 서버 API 호출해야 함)
        setTimeout(() => {
            onPasswordChangeSuccess();
        }, 1000);
    }
}

// 비밀번호 변경 성공 콜백 - 수정된 버전
window.onPasswordChangeSuccess = function() {
    showLoading(false);
    showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');

    // 중요: 비밀번호 변경 후 저장된 정보 처리
    const currentId = document.getElementById('currentId').value.trim();
    const savedId = localStorage.getItem(STORAGE_KEYS.SAVED_ID);

    // 변경한 계정이 현재 저장된 계정과 같은 경우
    if (currentId === savedId) {
        // 저장된 비밀번호 정보만 삭제 (아이디는 유지)
        localStorage.removeItem(STORAGE_KEYS.SAVED_PASSWORD);

        // Android 저장 정보도 삭제
        if (window.Android && window.Android.clearSavedCredentials) {
            window.Android.clearSavedCredentials();
        }

        // UI 업데이트
        document.getElementById('rememberMe').checked = false;
        document.getElementById('adminPassword').value = '';
        // 아이디는 유지
        document.getElementById('adminId').value = savedId;

        showToast('비밀번호가 변경되었습니다. 새 비밀번호로 다시 로그인해주세요.', 'info');
    }

    closeChangePassword();
};

// 비밀번호 변경 실패 콜백 (Android에서 호출)
window.onPasswordChangeFailed = function(error) {
    showLoading(false);
    showToast(error || '비밀번호 변경에 실패했습니다.', 'error');
};

// 로딩 표시/숨기기
function showLoading(show) {
    isLoading = show;
    document.getElementById('loadingOverlay').style.display = show ? 'flex' : 'none';

    const loginButton = document.querySelector('.login-btn');

    if (show) {
        loginButton.disabled = true;
        loginButton.innerHTML = '<span class="spinner-border spinner-border-sm mr-2"></span>로그인 중...';
    } else {
        loginButton.disabled = false;
        loginButton.innerHTML = '로그인';
    }
}

// 토스트 메시지 표시
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');

    // 기존 클래스 제거
    toast.className = 'toast';

    // 타입에 따른 클래스 추가
    if (type === 'error') {
        toast.classList.add('error');
    } else if (type === 'success') {
        toast.classList.add('success');
    } else if (type === 'warning') {
        toast.classList.add('warning');
    }

    toast.textContent = message;
    toast.classList.add('show');

    // 3초 후 자동 숨김
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// 모달 외부 클릭 시 닫기
window.addEventListener('click', function(event) {
    const modal = document.getElementById('changePasswordModal');
    if (event.target === modal) {
        closeChangePassword();
    }
});

// 뒤로 가기
function goBack() {
    let move_url = "nfc_main.html?ts=" + new Date().getTime();
    if (typeof gwzCommon !== 'undefined' && gwzCommon.fn_move_url) {
        gwzCommon.fn_move_url(move_url);
    } else {
        window.location.href = move_url;
    }
}

window.onBackPressed = function () {
    const modal = document.getElementById('changePasswordModal');
    if (modal.style.display === 'flex') {
        closeChangePassword();
    }
    setTimeout(function(){
        goBack();
    }, 100);
    return false;
};