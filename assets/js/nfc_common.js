let gwzCommon = {
    // back_url 설정
    set_back_url:function(currentTagUid){
         sessionStorage.setItem("back_url", "nfc_admin_settings.html");
         sessionStorage.setItem("currentTagUid", currentTagUid);
    },
    get_back_url:function(){
         const currentTagUid   = sessionStorage.getItem("currentTagUid" );
         return currentTagUid;
    },
      // back_url 삭제
    clear_back_url:function(){
        let back_url     = sessionStorage.getItem("back_url") || "nfc_main.html";
        if ( back_url && back_url > "" ) {
            sessionStorage.setItem("back_url", "");
            sessionStorage.setItem("currentTagUid", "");
        }
        return back_url
    },
    fn_move_url:function(move_url) {
        if (window.Android && window.Android.moveUrl) {
            window.Android.moveUrl(move_url);
        } else {

            setTimeout(() => {
                window.location.href = move_url;
           }, 500);
        }
    },
    logout:function() {
        if (window.Android && window.Android.logout) {
            window.Android.logout();
        }
    },
     clearProgressBar: function() {
        clearInterval(gwzCommon.timer_progressbar);
        $('#progress-container').addClass("hide");
     },
     timer_progressbar:null,
      startProgressBar: function(duration) {
          const interval = 100; // 0.1초마다 업데이트
        const steps = duration / interval;
        let currentStep = 0;

        // 초기화
        $('#progress-container').removeClass("hide");
        $('#progress-bar').css('width', '0%').text('0%');

        gwzCommon.timer_progressbar = setInterval(function () {
          currentStep++;
          const percent = Math.min(100, (currentStep / steps) * 100);
          $('#progress-bar').css('width', percent + '%').text(Math.floor(percent) + '%');

          if (percent >= 100) {
                gwzCommon.clearProgressBar();
          }
        }, interval);
    },

}

// 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', function() {
    $("#homeBtn").click(function(){
        gwzCommon.clear_back_url();
        let ts = new Date().getTime();
        let move_url ="nfc_main.html?ts="+ new Date().getTime() ;
        gwzCommon.fn_move_url( move_url );
    })
    $("#adminMainBtn").click(function(){
        gwzCommon.clear_back_url();
        let ts = new Date().getTime();
        let move_url ="nfc_admin_main.html?ts="+ new Date().getTime() ;
        gwzCommon.fn_move_url( move_url );
    })


    $("#adminMenuBtn").click(function(){
        gwzCommon.clear_back_url();
        let ts = new Date().getTime();
        let move_url ="nfc_admin_login.html?ts="+ new Date().getTime() ;
        gwzCommon.fn_move_url( move_url );
    })

    $(".btn-logout").click(function(){
        // 기존 로직
        gwzCommon.clear_back_url();
        gwzCommon.logout();
        
        // 추가: Remember Me 설정에 따른 자격 증명 처리
        try {
            const rememberMe = localStorage.getItem('admin_remember_me') === 'true';
            
            if (!rememberMe) {
                // Remember Me 체크 안됨 → 모든 저장 정보 삭제
                localStorage.removeItem('admin_remember_me');
                localStorage.removeItem('admin_saved_id');
                localStorage.removeItem('admin_saved_password');
            } else {
                // Remember Me 체크됨 → 비밀번호만 삭제, 아이디는 유지
                localStorage.removeItem('admin_saved_password');
            }
            
            // 세션 정보 정리
            localStorage.removeItem('admin_login_state');
            sessionStorage.removeItem('currentUser');
            
        } catch (error) {
            console.error('Error processing credentials during logout:', error);
        }
        
        // 기존 페이지 이동
        let ts = new Date().getTime();
        let move_url = "nfc_admin_login.html?ts=" + ts;
        gwzCommon.fn_move_url(move_url);
    });

});


