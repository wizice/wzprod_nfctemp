// Admin Settings JavaScript
let currentTagUid = null;
let currentTagData = null;
let isLoggedIn = false;
// 배터리 수명 데이터 (측정 간격별)
const batteryLifeData = {
    1: { days: 2, hours: 17 },
    5: { days: 13, hours: 12 },
    10: { days: 27, hours: 0 },
    15: { days: 40, hours: 12 },  // 추정값
    30: { days: 81, hours: 1 },
    60: { days: 161, hours: 13 }
};


// Initialize
window.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    checkLoginStatus();

    // Update NFC status
    updateNfcStatus();

    // Load saved settings if any
    loadSavedSettings();

    //
    $("#getLogging").click(function(){
         if (!currentTagUid) {
             showToast('먼저 NFC 태그를 인식시켜주세요.');
             return;
         }


        // Disable button
        const btn = event.target.closest('button');
        btn.disabled = true;
        btn.classList.add('loading');


        gwzCommon.set_back_url( currentTagUid );

        go_temparature_page();
    })
});

// 로그아웃
function logout() {
    if (confirm('로그아웃 하시겠습니까?')) {
             let move_url     =   "nfc_admin_login.html?ts=" +new Date().getTime() ;
            gwzCommon.fn_move_url( move_url );

    }
}
// 예상 종료 시점 업데이트
function updateExpectedEndTime() {
    const interval = parseInt(document.getElementById('interval').value);
    const batteryLife = batteryLifeData[interval];

    if (batteryLife) {
        let text = '약 ';
        if (batteryLife.days > 0) {
            text += batteryLife.days + '일 ';
        }
        if (batteryLife.hours > 0) {
            text += batteryLife.hours + '시간';
        }

        document.getElementById('endTimeText').textContent = text.trim();
    }
}
function showIntervalInfo() {
    $("#intervalInfoModal").modal("show");
}
// Check login status
function checkLoginStatus() {

    isLoggedIn = true;
}



// Update NFC status
function updateNfcStatus() {
    if (window.Android && window.Android.isNfcEnabled) {
        const nfcEnabled = window.Android.isNfcEnabled();

        if (!nfcEnabled) {
            updateStatus('NFC 비활성화', 'NFC를 켜주세요', 'error');
        } else {
            updateStatus('NFC 대기중', '태그를 인식시켜주세요.', 'normal');
        }
    }
}

// Update status display
function updateStatus(title, subtitle, status) {
    document.getElementById('statusTitle').textContent = title;
    document.getElementById('statusSubtitle').textContent = subtitle;

    const statusIcon = document.getElementById('nfcStatusIcon');
    statusIcon.className = 'status-icon ' + status;

    const statusCard = document.querySelector('.status-card');
    if (status === 'success') {
        statusCard.classList.add('active');
    } else {
        statusCard.classList.remove('active');
    }
}

// Load saved settings
function loadSavedSettings() {
    const savedSettings = localStorage.getItem('nfcSettings');
    if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        document.getElementById('interval').value = settings.interval || 30;
        document.getElementById('settingMinTemp').value = settings.settingMinTemp || 2;
        document.getElementById('settingMaxTemp').value = settings.settingMaxTemp || 8;
    }
}

// Save settings
function saveSettings() {
    const settings = {
        interval: document.getElementById('interval').value,
        settingMinTemp: document.getElementById('settingMinTemp').value,
        settingMaxTemp: document.getElementById('settingMaxTemp').value
    };

    localStorage.setItem('nfcSettings', JSON.stringify(settings));
}

// 토스트 메시지 표시
function showToast(message, type = 'success') {
    // 토스트 컨테이너 생성 또는 가져오기
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
        `;
        document.body.appendChild(container);
    }

    // 토스트 생성
    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
        color: white;
        padding: 12px 24px;
        border-radius: 6px;
        margin-bottom: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        display: flex;
        align-items: center;
        gap: 10px;
        animation: slideIn 0.3s ease-out;
    `;

    // 아이콘 추가
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span style="font-size: 20px;">${icon}</span> ${message}`;

    container.appendChild(toast);

    // 3초 후 제거
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ===== NFC Tag Operations =====

// Start logging
function startLogging() {
    if (!currentTagUid) {
        showToast('먼저 NFC 태그를 인식시켜주세요.');
        return;
    }

    // Save settings
    saveSettings();

    // Get values
    const interval = document.getElementById('interval').value;
    const settingMinTemp = document.getElementById('settingMinTemp').value;
    const settingMaxTemp = document.getElementById('settingMaxTemp').value;

    // Disable button
    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.classList.add('loading');

    // Call native method
    if (window.Android && window.Android.startLogging) {
        let delayMinutes = 0; // 고정값
        let loggingCount = 4864; // 측정갯수 4864 로 고정
        let intervalSeconds = interval * 60;
        let i_settingMinTemp = parseInt(settingMinTemp);
        let i_settingMaxTemp = parseInt(settingMaxTemp);

        window.Android.startLogging(currentTagUid, delayMinutes, intervalSeconds, loggingCount,
                i_settingMinTemp, i_settingMaxTemp);
    }
}

// Stop logging
function stopLogging() {
    if (!currentTagUid) {
        showToast('먼저 NFC 태그를 인식시켜주세요.');
        return;
    }

    // Disable button
    const btn = event.target.closest('button');
    btn.disabled = true;
    btn.classList.add('loading');

    // Call native method
    if (window.Android && window.Android.stopLogging) {
        window.Android.stopLogging(currentTagUid);
    } else {
        // For testing
        setTimeout(() => {
            onLoggingStopped();
            btn.disabled = false;
            btn.classList.remove('loading');
        }, 1500);
    }
}

// move to temparature
function go_temparature_page() {

    // Call native method
    let ts = new Date().getTime();
    //let move_url     =   "nfc_temperature_main.html?ts=" + ts ;
    let move_url     =   "nfc_main.html?ts=" + new Date().getTime() ;
    gwzCommon.fn_move_url( move_url );
}

// ===== Native Callbacks =====

// Called when NFC tag is detected
window.onNfcTagDetected = function(uid) {
    console.log('Admin: NFC tag detected:', uid);

    currentTagUid = uid;

    showToast('태그 정품 확인중..');

    // Update tag ID
    //document.getElementById('tagId').textContent = uid;

    // 태그 인증 진행
    if (window.Android && window.Android.verifyTagAuthenticity) {
        window.Android.verifyTagAuthenticity(uid);
    } else {
        console.log('앱에서 실행이 필요함')
    }


};
// 태그 인증 성공 콜백 - 수정된 버전
function onTagAuthenticated(uid) {
    console.log('Tag authenticated:', uid);

    showCertificationMark();
    showToast('태그 설정정보 확인중..');
       // Show tag info and settings
    document.getElementById('tagInfoCard').style.display = 'block';
    document.getElementById('tagId').textContent = uid;

    // 로딩 표시
    //showLoading('설정값을 읽고 있습니다...');

    // 온도 데이터 읽기 시작
    if (window.Android && window.Android.readCurrentSettings) {
        window.Android.readCurrentSettings(uid);
    }
}

// 태그 인증 실패 콜백
function onTagNotAuthenticated(uid ) {
    console.log('Tag not authenticated');

    hideCertificationMark();
    $("#settingsForm").addClass("hide");

    updateStatus('인증 실패', '미등록 태그:' + uid , 'error');

    showToast('등록되지 않은 태그가 인식되었습니다. 정품 태그를 사용해 주세요.');
}

function getMeasurementStatusText(status) {
    switch (status) {
        case "0": return "대기";
        case "1": return "측정 중";
        case "2": return "비정상 종료";
        case "3": return "정상 완료";
        default: return "알 수 없음";
    }
}
// Called when tag info is received
window.onSettingsRead = function(info) {
    console.log('Tag info received:', info);
    $("#settingsForm").removeClass("hide");

    currentTagData = info;

    // Update display
    let s_status     = getMeasurementStatusText( info.measurementStatus );
    document.getElementById('loggingStatus').textContent = s_status ;
    document.getElementById('currentCount').textContent = info.currentCount || '0';

    if ( info.intervalSeconds ) {
        let i_interval_min   = info.intervalSeconds / 60 || 0;
        $("#interval").val( "" + i_interval_min ) ;
        updateExpectedEndTime();
    }
    // Update current values
    $("#currentInterval").text( (info.intervalSeconds / 60  || '-') + '분'  );


    document.getElementById('currentSettingMinTemp').textContent = (info.settingMinTemp || '-') + '°C';
    if ( info.settingMinTemp) {
            $('#settingMinTemp').val( info.settingMinTemp  );
    }
     document.getElementById('currentSettingMaxTemp').textContent = (info.settingMaxTemp || '-') + '°C';
     if ( info.settingMaxTemp) {
             $('#settingMaxTemp').val( info.settingMaxTemp  );
     }

    if ( info.measurementStatus == "0") {
        updateStatus('태그 준비됨', '설정을 변경할 수 있습니다', 'success');
        showStatus("ready")
    } else if ( info.measurementStatus == "1" ) { //
        updateStatus('태그 측정중', '현재 측정중입니다. 온도기록 중지후 변경가능합니다. ', 'warning');
        showStatus("processing")
    } else if (info.measurementStatus == "3") {
        // measurementStatus가 "3"이면서 currentCount가 0 또는 1인 경우 태그 준비됨 상태로 처리
        if (info.currentCount === 0 || info.currentCount === 1 || 
            info.currentCount === "0" || info.currentCount === "1") {
            updateStatus('태그 준비됨', '설정을 변경할 수 있습니다', 'success');
            showStatus("ready");
        } else {
            updateStatus('측정완료상태', '데이터를 확인 후 설정을 변경바랍니다.', 'success');
            showStatus("done");
        }
    } else if (info.measurementStatus == "2") {
        updateStatus('태그 비정상', '비정상 종료된 상태입니다.', 'warning');
        showStatus("error")
    }else{
        updateStatus('태그 비정상', '알 수 없는 상태입니다.[' + info.measurementStatus+"]", 'error');
        showStatus("error")
    }

};

// 상태 표시 함수
function showStatus(status) {
    // 모든 상태 숨기기
    document.getElementById('statusReady').style.display = 'none';
    document.getElementById('statusDone').style.display = 'none';
    document.getElementById('statusOK').style.display = 'none';
    document.getElementById('statusNG').style.display = 'none';

    // 선택된 상태 표시
    switch(status) {
        case 'ready':
            document.getElementById('statusReady').style.display = 'flex';
            break;
        case 'done':
             document.getElementById('statusDone').style.display = 'flex';
             break;
        case 'processing':
            document.getElementById('statusOK').style.display = 'flex';
            break;
        case 'error':
            document.getElementById('statusNG').style.display = 'flex';
            break;
    }
}
// Called when logging is started
window.onLoggingStarted = function() {
    showToast('로깅이 시작되었습니다');
     showStatus('processing');
    document.getElementById('loggingStatus').textContent = '측정중';
    // Re-enable all buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('loading');
    });
};
window.onLoggingError = function(msg) {
    showToast( msg, "error");
    if (msg.startsWith("E01")) {
        showStatus('error');
    }
    document.getElementById('loggingStatus').textContent = '온도기록 시작 실패';
    showStatus("error");
    // Re-enable all buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('loading');
    });
};

// Called when logging is stopped
window.onLoggingStopped = function() {
    showToast('로깅이 중지되었습니다');
    showStatus("ready")
    document.getElementById('loggingStatus').textContent = '중지됨';
        // Re-enable all buttons
        document.querySelectorAll('.btn').forEach(btn => {
            btn.disabled = false;
            btn.classList.remove('loading');
        });
};

// Called when operation fails
window.onOperationFailed = function(message) {
    showToast(message || '작업에 실패했습니다');
    showStatus("error")
    // Re-enable all buttons
    document.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = false;
        btn.classList.remove('loading');
    });
};

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
