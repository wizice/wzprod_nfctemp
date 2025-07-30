// nfc_main.js - Main page JavaScript (Fixed version)

// 전역 변수
let app = {
    isScanning: false,
    isModalOpen: false,
    currentTagUid: null,
    checkInterval: null
};

let currentTagUid = null;
let currentTagData = null;

// Page load initialization
document.addEventListener('DOMContentLoaded', function() {
    console.log('Main page loaded');

    // 모든 필요한 함수들을 전역에 등록
    window.onNfcTagDetected = onNfcTagDetected;
    window.onTagAuthenticated = onTagAuthenticated;
    window.onTagNotAuthenticated = onTagNotAuthenticated;
    window.onTemperatureDataReceived = onTemperatureDataReceived;
    window.showLoading = showLoading;
    window.hideLoading = hideLoading;

    initializeNfcStatus();

    // 로컬 저장소에서 마지막 태그 정보 복원
    const savedTag = localStorage.getItem('lastTagUid');
    if (savedTag) {
        updateLastTagInfo(savedTag);
    }

    //-- 관리자 모드이면 태그 데이터 바로 읽기
    let currentTagUid = gwzCommon.get_back_url();
    if ( currentTagUid) {
        onTagAuthenticated(currentTagUid);
    }


});

// NFC 상태 초기화
function initializeNfcStatus() {
    if (window.Android && window.Android.checkNfcEnabled) {
        window.Android.checkNfcEnabled();
    } else {
        // 브라우저 테스트
        updateNfcStatus(true);
    }
}

// NFC 상태 업데이트
function updateNfcStatus(enabled) {
    const statusElements = document.querySelectorAll('[data-nfc-status]');
    statusElements.forEach(el => {
        if (enabled) {
            el.textContent = 'NFC 활성화됨';
            el.style.color = '#4CAF50';
        } else {
            el.textContent = 'NFC 비활성화됨';
            el.style.color = '#F44336';
        }
    });
}

// 상태 업데이트
function updateStatus(title, subtitle, type = 'default') {
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');

    if (statusTitle) statusTitle.textContent = title;
    if (statusSubtitle) statusSubtitle.textContent = subtitle;

    // 상태에 따른 스타일 적용
    const statusCard = document.querySelector('.status-card');
    if (statusCard) {
        statusCard.className = `status-card ${type}`;
    }
}

// 토스트 메시지 표시
function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// 로딩 표시
function showLoading(message = '처리 중...') {
    console.log('Loading shown:', message);
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.querySelector('.loading-text');

    if (loadingOverlay) {
        if (loadingText) {
            loadingText.textContent = message;
        }
        loadingOverlay.style.display = 'flex';
    }
}

// 로딩 숨기기
function hideLoading() {
    console.log('Loading hidden');
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

// 정품 마크 표시
function showCertificationMark() {

    const certificationMarkElement = document.getElementById('certificationMark');
    if (certificationMarkElement) {
        certificationMarkElement.classList.add('show');
    }
}

// 정품 마크 숨기기
function hideCertificationMark() {
    const certificationMarkElement = document.getElementById('certificationMark');
    if (certificationMarkElement) {
        certificationMarkElement.classList.remove('show');
    }
}



// 마지막 태그 정보 업데이트
function updateLastTagInfo(uid) {
    const tagInfo = document.querySelector('.tag-info');
    if (tagInfo && uid) {
        tagInfo.innerHTML = `
            <div class="tag-info">
                <span class="tag-label">마지막 태그:</span>
                <span class="tag-value">${uid.toUpperCase()}</span>
            </div>
        `;
        tagInfo.style.display = 'block';

        // 로컬 저장소에 저장
        localStorage.setItem('lastTagUid', uid);
    }
}

// 관리자 모달 관련 함수들
function openAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.style.display = 'flex';
        app.isModalOpen = true;
    }
}

function closeAdminModal() {
    const modal = document.getElementById('adminModal');
    if (modal) {
        modal.style.display = 'none';
        app.isModalOpen = false;
    }

    // 입력 필드 초기화
    const idField = document.getElementById('adminId');
    const passwordField = document.getElementById('adminPassword');
    if (idField) idField.value = '';
    if (passwordField) passwordField.value = '';
}

function adminLogin() {
    const id = document.getElementById('adminId')?.value?.trim();
    const password = document.getElementById('adminPassword')?.value?.trim();

    if (!id || !password) {
        showToast('아이디와 비밀번호를 입력해주세요');
        return;
    }

    if (window.Android && window.Android.verifyAdminLogin) {
        window.Android.verifyAdminLogin(id, password);
    }
}

// ===== Native Callback Functions =====

// NFC 상태 업데이트 콜백
window.updateNfcStatus = updateNfcStatus;

// NFC 태그 감지 콜백 - 수정된 버전
function onNfcTagDetected(uid) {
    console.log('NFC tag detected with UID:', uid);

    if (app.isModalOpen) return;

    app.currentTagUid = uid;
    currentTagUid = uid;
    app.isScanning = true;

    updateStatus('태그 감지됨', '정품 확인 중...', 'scanning');
    updateLastTagInfo(uid);

   $("#nfcIcon").addClass("hide");
    $("#nfcReading").removeClass("hide");
    $("#nfcInvalid").addClass("hide");

    // 태그 인증 진행
    if (window.Android && window.Android.verifyTagAuthenticity) {
        window.Android.verifyTagAuthenticity(uid);
    } else {
        console.log('앱에서 실행이 필요함')
    }
}

// 태그 인증 성공 콜백 - 수정된 버전
function onTagAuthenticated(uid) {
    console.log('Tag authenticated:', uid);

    app.isScanning = false;
    showCertificationMark();
    updateStatus('정품 확인됨', '데이터를 읽는중입니다.\n잠시만 태그를 움직이지 말고 기다려 주세요.', 'success');
    $("#nfcIcon").addClass("hide");
    $("#nfcReading").removeClass("hide");
    $("#nfcInvalid").addClass("hide");


    gwzCommon.startProgressBar(2500);

    // 로딩 표시
    showLoading('온도 데이터를 읽고 있습니다...');

    // 온도 데이터 읽기 시작
    setTimeout(() => {
        if (window.Android && window.Android.readTemperatureData) {
            console.log('Calling native readTemperatureData');
            window.Android.readTemperatureData(uid);
        } else {
            //
            console.log('앱에서 실행해 주세요.');

        }
    }, 1500);
}



function fn_readTemperatureData( uid ){
    // 온도 데이터 읽기 시작
    setTimeout(() => {
        if (window.Android && window.Android.readTemperatureData) {
            console.log('Calling native readTemperatureData');
            window.Android.readTemperatureData(uid);
        } else {
            //
            console.log('앱에서 실행해 주세요.');

        }
    }, 1500);
}

// 태그 인증 실패 콜백
function onTagNotAuthenticated(uid ) {
    console.log('Tag not authenticated');

    app.isScanning = false;
    hideCertificationMark();
    //updateStatus('인증 실패', '미등록 태그입니다.' + uid   , 'error');
    updateStatus('인증 실패', '미등록 태그입니다.'  , 'error');
    $("#nfcIcon").addClass("hide");
    $("#nfcReading").addClass("hide");
    $("#nfcInvalid").removeClass("hide");

    showToast('등록되지 않은 태그가 인식되었습니다. 정품 태그를 사용해 주세요.');
}

// 온도 데이터 수신 콜백 - 새로 추가
function onTemperatureDataReceived(data) {
    console.log('Temperature data received:', data);
    $("#nfcIcon").removeClass("hide");
    $("#nfcReading").addClass("hide");
    $("#nfcInvalid").addClass("hide");

    hideLoading();

    try {
        let parsedData;
        if (typeof data === 'string') {
            parsedData = JSON.parse(data);
        } else {
            parsedData = data;
        }

        if (parsedData && parsedData.status === 'success') {
            // localStorage에 데이터 저장
            localStorage.setItem('temperatureData', JSON.stringify(parsedData));

            // temperature 페이지로 이동
            window.location.href = 'nfc_temperature_main.html';
        } else {
            gwzCommon.clearProgressBar();
            updateStatus('데이터 읽기 실패', '온도 데이터를 읽을 수 없습니다', 'error');
            showToast('온도 데이터를 읽을 수 없습니다. 다시 시도해주세요.');
        }
    } catch (e) {
        gwzCommon.clearProgressBar();
        console.error('Failed to process temperature data:', e);
        updateStatus('데이터 처리 실패', '데이터 형식이 올바르지 않습니다', 'error');
        showToast('데이터 처리 중 오류가 발생했습니다.');
    }
}

// 관리자 로그인 성공 콜백
function onAdminLoginSuccess(id, password) {
    console.log('Admin login success:', id);
    closeAdminModal();
    showToast('관리자 로그인 성공');

//    // 관리자 페이지로 이동
//    setTimeout(() => {
//        window.location.href = 'nfc_main_settings.html';
//    }, 1000);
}

// 관리자 로그인 실패 콜백
function onAdminLoginFailed(message) {
    console.log('Admin login failed:', message);
    showToast(message || '로그인에 실패했습니다');
}

// 에러 처리 콜백
function onError(message) {
    console.error('Error received:', message);
    hideLoading();
    gwzCommon.clearProgressBar();
    if ( message.indexOf("communication error") >= 0) {
            updateStatus('NFC 태그 대기중', '태그를 다시 인식시켜주세요.', '확인');
            //showToast(message || '오류가 발생했습니다');
            showToast('태그를 다시 인식시켜주세요.');
    } else {
        updateStatus('오류 발생', '태그를 다시 인식시켜주세요.', '확인');
        //updateStatus('오류 발생', message || '알 수 없는 오류가 발생했습니다', 'error');
        //showToast(message || '오류가 발생했습니다');
        showToast('태그를 다시 인식시켜주세요.');
    }

}

function goToAdminSettings() {
    if (window.Android) {
        // 관리자 모드 설정 후 페이지 이동
        Android.setAdminMode(true);
        Android.navigateToAdminSettings();
    }
}



// 전역 함수로 등록


window.onAdminLoginSuccess = onAdminLoginSuccess;
window.onAdminLoginFailed = onAdminLoginFailed;
window.onError = onError;
