let gwzCommon = {
    // back_url 설정
    set_back_url:function(currentTagUid){
         localStorage.setItem("back_url", "nfc_admin_settings.html");
         localStorage.setItem("currentTagUid", currentTagUid);
    },
    get_back_url:function(){
         const currentTagUid   = localStorage.getItem("currentTagUid" );
         return currentTagUid;
    },
      // back_url 삭제
    clear_back_url:function(){
        let back_url     = localStorage.getItem("back_url") || "nfc_main.html";
        if ( back_url && back_url > "" ) {
            localStorage.setItem("back_url", "");
            localStorage.setItem("currentTagUid", "");
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
        gwzCommon.clear_back_url();
        gwzCommon.logout();
        let ts = new Date().getTime();
        let move_url ="nfc_admin_login.html?ts="+ ts;
        gwzCommon.fn_move_url( move_url );
    })

});


