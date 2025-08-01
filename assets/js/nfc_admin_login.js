// 전역 변수
let isPasswordVisible = false;
let isLoading = false;

// 페이지 로드 시 실행
document.addEventListener('DOMContentLoaded', function() {
    // 저장된 로그인 정보 불러오기
    loadSavedCredentials();

    // 엔터키 이벤트 처리
    document.getElementById('adminId').addEventListener('keypress', handleEnterKey);
    document.getElementById('adminPassword').addEventListener('keypress', handleEnterKey);


});

// 자동 로그인 체크
function checkAutoLogin() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        // 이미 로그인된 상태면 대시보드로 이동

        let move_url     =   "nfc_admin_main.html?ts=" + new Date().getTime() ;
         gwzCommon.fn_move_url( move_url );

    }
}

// 저장된 로그인 정보 불러오기
function loadSavedCredentials() {
    try {
        // Android에서 저장된 정보 가져오기
        if (window.Android && window.Android.getSavedCredentials) {
            const savedData = window.Android.getSavedCredentials();
            if (savedData) {
                const credentials = JSON.parse(savedData);
                if (credentials.savedId) {
                    document.getElementById('adminId').value = credentials.savedId;
                    document.getElementById('rememberMe').checked = true;


                    if (credentials.savedPwd) {
                         document.getElementById('adminPassword').value = credentials.savedPwd;

                     }
                }
            }
        }
    } catch (error) {
        console.error('Failed to load saved credentials:', error);
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

// 로그인 처리
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
    // 로딩 표시
    showLoading(true);

    // Android 인터페이스를 통한 Firestore 인증
    if (window.Android ) {
        //
        // 인증이 되면 로그인 정보 저장 처리함. verifyAdminLogin 에서 rememberMe 값에 따라 저장 삭제함
        // Firestore 인증 요청
        window.Android.verifyAdminLogin(adminId, adminPassword, rememberMe);
    }
}

// 로그인 성공 콜백 (Android에서 호출)
window.onAdminLoginSuccess = function(username, role) {
    console.log('Admin login success:', username, role);

    // 사용자 정보 저장
    const userInfo = {
        username: username,
        role: role || 'admin',
        loginTime: Date.now()
    };

    sessionStorage.setItem('currentUser', JSON.stringify(userInfo));

    showLoading(false);
    showToast('로그인 성공!', 'success');

    // 관리자   페이지로 이동
    setTimeout(() => {
        if (window.Android && window.Android.onAdminLoginSuccess) {
            window.Android.onAdminLoginSuccess();
        }
    }, 500);
};

// 로그인 실패 콜백 (Android에서 호출)
window.onAdminLoginFailed = function(message) {
    console.log('Admin login failed:', message);
    isLoading = false;
    showLoading(false);

    showToast(message || '아이디 또는 비밀번호가 일치하지 않습니다.', 'error');

    // 비밀번호 필드 초기화
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminPassword').focus();
};

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
        // 테스트 환경
        console.log('Password change attempt:', { currentId, newPassword });
        showLoading(false);
        showToast('Android 인터페이스를 찾을 수 없습니다.', 'error');
    }
}

// 비밀번호 변경 성공 콜백 (Android에서 호출)
window.onPasswordChangeSuccess = function() {
    showLoading(false);
    showToast('비밀번호가 성공적으로 변경되었습니다.', 'success');
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

    let move_url     =   "nfc_main.html?ts=" + new Date().getTime() ;
     gwzCommon.fn_move_url( move_url );

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
