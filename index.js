/* =========================================================
 * 知蟹 H5 —— 番茄蛋仔蟹的休息陪伴
 * 纯原生 JS，数据保存在浏览器 localStorage，无需后端
 * ========================================================= */
(function () {
  'use strict';

  /* ---------- 常量配置 ---------- */
  var STORE_KEY = 'zhixie_exp_v1';       // 成长值（经验）本地存储
  var STORE_KEY_HIST = 'zhixie_history_v1'; // 休息历史
  var RING_LEN = 653.45;                 // 2π × 104（环形进度条周长）

  // 情绪映射（emoji + 显示标签）
  var MOOD_MAP = {
    recover: { emoji: '💤', label: '恢复中' },
    relax:   { emoji: '🪁', label: '放松感上升' },
    focus:   { emoji: '🎯', label: '专注了' },
    reset:   { emoji: '🔄', label: '重置了' }
  };

  var SCENES = [
    { id: 'class',  icon: '📚', name: '课后间隙', desc: '上完课，喘口气' },
    { id: 'study',  icon: '✏️', name: '刷题间隙', desc: '大脑需要重启' },
    { id: 'sleep',  icon: '🌙', name: '睡前放松', desc: '和今天说辛苦' },
    { id: 'emo',    icon: '🫧', name: '情绪放空', desc: '什么都不做也可以' }
  ];

  var QUOTES = [
    '休息不是偷懒，是给大脑整理碎片的时间。',
    '你不需要为休息向任何人道歉，包括你自己。',
    '喘口气吧，这一程你已经走得很努力了。',
    '允许自己慢下来，也是一种认真前进。',
    '休息是你的权利，不是需要争取的奖励。',
    '允许你停摆五分钟，世界不会因此停转。',
    '照顾好自己，也是在认真生活。',
    '番茄蛋仔蟹正式批准：这次休息，理直气壮！',
    '发会儿呆没关系，灵感都在发呆的路上。',
    '今天也辛苦了，剩下的交给休息后的你。'
  ];

  // 成长阶段（累计经验达到 min 即解锁）
  var STAGES = [
    { min: 0,   name: '蛋仔幼蟹',   desc: '刚破壳，圆滚滚地陪着你' },
    { min: 20,  name: '萌萌小蟹',   desc: '长出了小钳子，开始有模有样' },
    { min: 50,  name: '番茄蛋仔蟹', desc: '钳子和腿都长齐啦，元气满满' },
    { min: 100, name: '元气蟹黄将', desc: '戴着小皇冠，守护每一次休息' }
  ];

  /* ---------- 运行状态 ---------- */
  var state = {
    scene: SCENES[0],
    minutes: 10,
    cardOn: true,
    total: 600,          // 本次休息总秒数（含延长）
    remain: 600,
    deadline: 0,
    timer: null,
    quote: QUOTES[0],
    early: false,
    extended: false
  };

  /* =========================================================
   * 番茄蛋仔蟹 SVG 生成器
   * stage: 1~4 成长阶段；mood: idle / wave / sleep / celebrate
   * ========================================================= */
  var C = {
    red: '#E8543E', deep: '#C9422F', cream: '#FFE4CC',
    pink: '#F5A78B', green: '#6BAE5F', gold: '#F5B841', ink: '#3D2B26'
  };

  function star(x, y, s) {
    return '<path d="M' + x + ' ' + (y - s) +
      ' L' + (x + s * 0.25) + ' ' + (y - s * 0.25) +
      ' L' + (x + s) + ' ' + y +
      ' L' + (x + s * 0.25) + ' ' + (y + s * 0.25) +
      ' L' + x + ' ' + (y + s) +
      ' L' + (x - s * 0.25) + ' ' + (y + s * 0.25) +
      ' L' + (x - s) + ' ' + y +
      ' L' + (x - s * 0.25) + ' ' + (y - s * 0.25) + ' Z" fill="' + C.gold + '"/>';
  }

  function clawMarkup(angle) {
    var cp = [
      null,
      { x: 150, y: 132, r: 12 },
      { x: 158, y: 122, r: 18 },
      { x: 164, y: 110, r: 24 },
      { x: 164, y: 110, r: 26 }
    ][stageNow()];
    return '<g transform="rotate(' + angle + ' 138 128)">' +
      '<ellipse cx="140" cy="128" rx="12" ry="9" fill="' + C.red + '"/>' +
      '<circle cx="' + cp.x + '" cy="' + cp.y + '" r="' + cp.r + '" fill="' + C.red + '"/>' +
      '<path d="M' + (cp.x + cp.r * 0.35) + ' ' + (cp.y - cp.r * 0.45) +
        ' L' + (cp.x + cp.r * 0.85) + ' ' + (cp.y - 2) +
        '" stroke="' + C.deep + '" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
      '<path d="M' + (cp.x + cp.r * 0.35) + ' ' + (cp.y + cp.r * 0.45) +
        ' L' + (cp.x + cp.r * 0.85) + ' ' + (cp.y + 2) +
        '" stroke="' + C.deep + '" stroke-width="3.5" stroke-linecap="round" fill="none"/>' +
      '</g>';
  }

  // 钳大小需要随阶段变化，通过全局变量传入
  var _stage = 1;
  function stageNow() { return _stage; }

  function crabSVG(stage, mood) {
    _stage = Math.max(1, Math.min(4, stage));
    mood = mood || 'idle';

    // 蟹腿：阶段1 没有，阶段2 两侧各2条，阶段3+ 两侧各3条
    var legs = '';
    if (_stage >= 2) {
      var ys = _stage >= 3 ? [116, 134, 152] : [124, 146];
      ys.forEach(function (y) {
        legs += '<path d="M74 ' + y + ' Q56 ' + (y + 4) + ' 42 ' + (y + 2) +
          '" stroke="' + C.red + '" stroke-width="9" fill="none" stroke-linecap="round"/>';
        legs += '<path d="M126 ' + y + ' Q144 ' + (y + 4) + ' 158 ' + (y + 2) +
          '" stroke="' + C.red + '" stroke-width="9" fill="none" stroke-linecap="round"/>';
      });
    }

    // 钳子抬起角度
    var rightAng = mood === 'wave' ? -32 : (mood === 'celebrate' ? -55 : 0);
    var leftAng = mood === 'celebrate' ? -55 : 0;
    var rightClaw = clawMarkup(rightAng);
    var leftClaw = '<g transform="translate(200,0) scale(-1,1)">' + clawMarkup(leftAng) + '</g>';

    // 眼睛
    var eyes;
    if (mood === 'sleep') {
      eyes = '<path d="M80 110 Q85 116 90 110" stroke="' + C.ink + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
             '<path d="M110 110 Q115 116 120 110" stroke="' + C.ink + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    } else if (mood === 'celebrate') {
      eyes = '<path d="M80 113 Q85 106 90 113" stroke="' + C.ink + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
             '<path d="M110 113 Q115 106 120 113" stroke="' + C.ink + '" stroke-width="3" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<circle cx="85" cy="109" r="5" fill="' + C.ink + '"/><circle cx="87" cy="107" r="1.6" fill="#fff"/>' +
             '<circle cx="115" cy="109" r="5" fill="' + C.ink + '"/><circle cx="117" cy="107" r="1.6" fill="#fff"/>';
    }

    // 睡眠 Z
    var sleepZ = mood === 'sleep'
      ? '<text x="130" y="78" font-size="15" fill="' + C.deep + '" font-family="Arial">z</text>' +
        '<text x="143" y="62" font-size="23" fill="' + C.deep + '" font-family="Arial">Z</text>'
      : '';

    // 庆祝星星
    var sparkles = mood === 'celebrate'
      ? star(40, 80, 9) + star(168, 66, 11) + star(152, 38, 7) + star(46, 104, 7)
      : '';

    // 头顶番茄叶
    var leaves = '<g transform="translate(100,66)">' +
      '<ellipse cx="0" cy="-7" rx="5" ry="10" fill="' + C.green + '"/>' +
      '<ellipse cx="-8" cy="-4" rx="5" ry="9" transform="rotate(-35 -8 -4)" fill="' + C.green + '"/>' +
      '<ellipse cx="8" cy="-4" rx="5" ry="9" transform="rotate(35 8 -4)" fill="' + C.green + '"/>' +
      '</g>';

    // 阶段4 皇冠
    var crown = _stage >= 4
      ? '<path d="M78 50 L86 34 L100 45 L114 34 L122 50 Z" fill="' + C.gold + '" stroke="#E09A1F" stroke-width="1.5"/>' +
        '<circle cx="86" cy="34" r="3" fill="' + C.gold + '" stroke="#E09A1F" stroke-width="1"/>' +
        '<circle cx="114" cy="34" r="3" fill="' + C.gold + '" stroke="#E09A1F" stroke-width="1"/>'
      : '';

    return '<svg class="crab" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-label="番茄蛋仔蟹">' +
      '<ellipse cx="100" cy="186" rx="58" ry="8" fill="rgba(61,43,38,0.08)"/>' +
      legs +
      leftClaw + rightClaw +
      '<ellipse cx="100" cy="120" rx="60" ry="52" fill="' + C.red + '"/>' +
      '<ellipse cx="100" cy="133" rx="40" ry="33" fill="' + C.cream + '"/>' +
      eyes +
      '<path d="M89 124 Q100 133 111 124" stroke="' + C.deep + '" stroke-width="3" fill="none" stroke-linecap="round"/>' +
      '<ellipse cx="74" cy="121" rx="6" ry="4" fill="' + C.pink + '" opacity="0.7"/>' +
      '<ellipse cx="126" cy="121" rx="6" ry="4" fill="' + C.pink + '" opacity="0.7"/>' +
      leaves + crown + sleepZ + sparkles +
      '</svg>';
  }

  /* ---------- 本地存储：成长值 + 休息历史 ---------- */
  function getExp() {
    var v = parseInt(localStorage.getItem(STORE_KEY), 10);
    return isNaN(v) ? 0 : v;
  }
  function setExp(v) { localStorage.setItem(STORE_KEY, String(v)); }

  function getHistory() {
    try {
      var raw = localStorage.getItem(STORE_KEY_HIST);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }
  function setHistory(list) {
    localStorage.setItem(STORE_KEY_HIST, JSON.stringify(list.slice(-200)));
  }
  // YYYY-MM-DD
  function todayStr() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function dateStrOf(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function stageIndexOf(exp) {
    var idx = 0;
    for (var i = 0; i < STAGES.length; i++) {
      if (exp >= STAGES[i].min) idx = i;
    }
    return idx;
  }
  function pickQuote(exclude) {
    var q;
    do { q = QUOTES[Math.floor(Math.random() * QUOTES.length)]; }
    while (QUOTES.length > 1 && q === exclude);
    return q;
  }

  /* ---------- 页面切换 ---------- */
  var prevPage = 'guide';
  var currentPage = 'guide';

  function showPage(id) {
    if (id !== currentPage) prevPage = currentPage;
    var pages = document.querySelectorAll('.page');
    for (var i = 0; i < pages.length; i++) pages[i].classList.remove('active');
    document.getElementById('page-' + id).classList.add('active');
    currentPage = id;
    window.scrollTo(0, 0);
    if (id === 'growth') renderGrowth();
    if (id === 'review') renderReview();
  }

  document.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) showPage(go.getAttribute('data-go'));
  });
  document.getElementById('growthBack').addEventListener('click', function () {
    showPage(prevPage === 'growth' ? 'scene' : prevPage);
  });

  /* =========================================================
   * 场景选择页
   * ========================================================= */
  function renderScenes() {
    var box = document.getElementById('sceneList');
    box.innerHTML = SCENES.map(function (s) {
      return '<button class="scene-card' + (s.id === state.scene.id ? ' active' : '') + '" data-id="' + s.id + '">' +
        '<span class="scene-icon">' + s.icon + '</span>' +
        '<span class="scene-name">' + s.name + '</span>' +
        '<span class="scene-desc">' + s.desc + '</span>' +
        '</button>';
    }).join('');
  }

  document.getElementById('sceneList').addEventListener('click', function (e) {
    var card = e.target.closest('.scene-card');
    if (!card) return;
    var id = card.getAttribute('data-id');
    for (var i = 0; i < SCENES.length; i++) {
      if (SCENES[i].id === id) state.scene = SCENES[i];
    }
    renderScenes();
  });

  document.getElementById('durationRow').addEventListener('click', function (e) {
    var btn = e.target.closest('.duration-btn');
    if (!btn) return;
    state.minutes = parseInt(btn.getAttribute('data-min'), 10);
    var btns = this.querySelectorAll('.duration-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('active');
    btn.classList.add('active');
  });

  var cardSwitch = document.getElementById('cardSwitch');
  cardSwitch.addEventListener('click', function () {
    state.cardOn = !state.cardOn;
    cardSwitch.classList.toggle('on', state.cardOn);
    cardSwitch.setAttribute('aria-checked', String(state.cardOn));
  });

  /* =========================================================
   * 计时器页
   * ========================================================= */
  function fmt(sec) {
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function updateRing() {
    var ratio = state.total > 0 ? state.remain / state.total : 0;
    document.getElementById('ringFg').style.strokeDashoffset = String(RING_LEN * (1 - ratio));
    document.getElementById('timeText').textContent = fmt(state.remain);
  }

  function startRest() {
    state.total = state.minutes * 60;
    state.remain = state.total;
    state.deadline = Date.now() + state.total * 1000;
    state.extended = false;
    state.early = false;
    state.quote = pickQuote('');

    document.getElementById('timerSceneTitle').textContent = state.scene.name + ' · 安心休息';
    document.getElementById('timerCrab').innerHTML = crabSVG(stageIndexOf(getExp()) + 1, 'sleep');
    document.getElementById('ringSub').textContent = state.cardOn ? '免责卡保护中' : '安心休息';

    var pill = document.getElementById('quotePill');
    if (state.cardOn) {
      pill.classList.remove('hide');
      document.getElementById('quoteText').textContent = state.quote;
    } else {
      pill.classList.add('hide');
    }

    updateRing();
    showPage('timer');
    if (state.timer) clearInterval(state.timer);
    state.timer = setInterval(tick, 300);
  }

  function tick() {
    var left = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
    state.remain = left;
    updateRing();
    if (left <= 0) {
      clearInterval(state.timer);
      state.timer = null;
      finishRest(false);
    }
  }

  // 延长 5 分钟：文案自动更换
  document.getElementById('extendBtn').addEventListener('click', function () {
    if (!state.timer && state.remain <= 0) return;
    state.deadline += 5 * 60 * 1000;
    state.total += 5 * 60;
    state.extended = true;
    state.quote = pickQuote(state.quote);
    document.getElementById('quoteText').textContent = state.quote;
    state.remain = Math.max(0, Math.round((state.deadline - Date.now()) / 1000));
    updateRing();
    showToast('已延长 5 分钟，治愈文案已更换');
  });

  // 提前结束
  document.getElementById('earlyBtn').addEventListener('click', function () {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    finishRest(true);
  });

  document.getElementById('startBtn').addEventListener('click', startRest);

  /* =========================================================
   * 结束页 + 成长值结算
   * ========================================================= */
  function finishRest(early) {
    state.early = early;
    var elapsedSec = early ? Math.min(state.total, Math.max(0, state.total - state.remain)) : state.total;
    var restedMin = Math.max(1, Math.round(elapsedSec / 60));

    // 成长值：只有完整休息（未中途退出）才能获得
    var gained = 0, oldIdx = stageIndexOf(getExp()), newIdx = oldIdx;
    if (!early) {
      gained = restedMin;
      var exp = getExp() + gained;
      setExp(exp);
      newIdx = stageIndexOf(exp);

      // 写入休息历史（mood 先留空，等用户在结束页选择后再回填）
      var history = getHistory();
      history.push({
        date: todayStr(),
        scene: state.scene.id,
        sceneName: state.scene.name,
        minutes: restedMin,
        mood: null
      });
      setHistory(history);
    }

    var curStage = newIdx + 1;

    // 蟹蟹状态：完整=庆祝，提前退出=普通
    document.getElementById('endCrab').innerHTML = crabSVG(curStage, early ? 'idle' : 'celebrate');
    document.getElementById('endTitle').textContent = early ? '提前结束啦' : '充能完成！';
    document.getElementById('endTip').textContent = early
      ? '也辛苦啦，哪怕只休息了一小会儿。完整休息才能让蟹蟹成长哦。'
      : '番茄蛋仔蟹觉得你棒棒的，休息好了就继续出发吧！';

    var expTip = document.getElementById('expTip');
    if (!early) {
      expTip.classList.remove('hide');
      expTip.textContent = '本次完整休息获得 ' + gained + ' 点成长值';
    } else {
      expTip.classList.add('hide');
    }

    // 免责卡
    var card = document.getElementById('endCard');
    if (state.cardOn) {
      card.classList.remove('hide');
      document.getElementById('cardCrab').innerHTML = crabSVG(curStage, 'idle');
      document.getElementById('cardScene').textContent = state.scene.icon + ' ' + state.scene.name;
      document.getElementById('cardDuration').textContent =
        restedMin + ' 分钟' + (state.extended && !early ? '（含延长）' : '');
      document.getElementById('cardStatus').textContent = early ? '提前结束' : '完整休息';
      document.getElementById('cardQuote').textContent = '「' + state.quote + '」';
      var d = new Date();
      document.getElementById('cardDate').textContent =
        (d.getMonth() + 1) + '月' + d.getDate() + '日';
    } else {
      card.classList.add('hide');
    }

    showPage('end');

    if (early) return;

    // 完整休息：弹出结束提醒；若升级随后弹升级提示
    document.getElementById('modalCrab').innerHTML = crabSVG(curStage, 'celebrate');
    var timeUpModal = document.getElementById('timeUpModal');
    var levelModal = document.getElementById('levelModal');
    timeUpModal.classList.add('show');
    if (navigator.vibrate) { try { navigator.vibrate(300); } catch (err) {} }

    document.getElementById('timeUpConfirm').onclick = function () {
      timeUpModal.classList.remove('show');
      if (newIdx > oldIdx) {
        document.getElementById('levelModalCrab').innerHTML = crabSVG(newIdx + 1, 'celebrate');
        document.getElementById('levelModalText').textContent =
          '成长值达到 ' + STAGES[newIdx].min + '，解锁新形象「' + STAGES[newIdx].name + '」！';
        levelModal.classList.add('show');
      }
    };
  }

  // 免责卡点击切换治愈宣言
  document.getElementById('endCard').addEventListener('click', function () {
    state.quote = pickQuote(state.quote);
    document.getElementById('cardQuote').textContent = '「' + state.quote + '」';
  });
  document.getElementById('levelConfirm').addEventListener('click', function () {
    document.getElementById('levelModal').classList.remove('show');
  });

  /* =========================================================
   * 成长主页
   * ========================================================= */
  function renderGrowth() {
    var exp = getExp();
    var idx = stageIndexOf(exp);
    var cur = STAGES[idx], next = STAGES[idx + 1];

    document.getElementById('growthCrab').innerHTML = crabSVG(idx + 1, 'idle');
    document.getElementById('levelName').textContent = 'Lv.' + (idx + 1) + ' ' + cur.name;

    var fill;
    if (next) {
      var span = next.min - cur.min;
      fill = Math.min(100, Math.round((exp - cur.min) / span * 100));
      document.getElementById('expText').textContent =
        '成长值 ' + exp + ' / ' + next.min + '，再获得 ' + (next.min - exp) + ' 点解锁「' + next.name + '」';
    } else {
      fill = 100;
      document.getElementById('expText').textContent = '成长值 ' + exp + '，已解锁全部形象';
    }
    document.getElementById('expFill').style.width = fill + '%';

    document.getElementById('stageList').innerHTML = STAGES.map(function (st, i) {
      var unlocked = i <= idx;
      if (unlocked) {
        return '<div class="stage-item">' +
          '<div class="stage-crab">' + crabSVG(i + 1, 'idle') + '</div>' +
          '<div><div class="stage-name">Lv.' + (i + 1) + ' ' + st.name + '</div>' +
          '<div class="stage-desc">' + st.desc + '</div></div>' +
          '<span class="stage-state">已解锁</span></div>';
      }
      return '<div class="stage-item locked">' +
        '<div class="lock-mark">🔒</div>' +
        '<div><div class="stage-name">Lv.' + (i + 1) + ' ' + st.name + '</div>' +
        '<div class="stage-desc">' + st.desc + '</div></div>' +
        '<span class="stage-state">需 ' + st.min + ' 成长值</span></div>';
    }).join('');
  }

  /* =========================================================
   * 休息回顾页
   * ========================================================= */
  function renderReview() {
    var all = getHistory();
    var now = new Date();
    // 过去 7 天（含今天）的日期字符串
    var last7Days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      last7Days.push(dateStrOf(d));
    }

    // 柱状图数据：每天总分钟数
    var dayTotals = {};
    var dayCount = {};
    last7Days.forEach(function (ds) { dayTotals[ds] = 0; dayCount[ds] = 0; });
    all.forEach(function (rec) {
      if (dayTotals.hasOwnProperty(rec.date)) {
        dayTotals[rec.date] += rec.minutes;
        dayCount[rec.date] += 1;
      }
    });

    // 最大分钟数（用于柱状图高度比例）
    var maxMin = 5; // 最小值保底，避免全 0 时除 0
    last7Days.forEach(function (ds) { if (dayTotals[ds] > maxMin) maxMin = dayTotals[ds]; });

    // 渲染柱状图
    var chart = document.getElementById('barChart');
    var dayLabels = ['一', '二', '三', '四', '五', '六', '日'];
    var chartHTML = '';
    last7Days.forEach(function (ds, idx) {
      var mins = dayTotals[ds] || 0;
      var h = Math.max(4, Math.round((mins / maxMin) * 100));
      var isToday = ds === dateStrOf(now);
      chartHTML += '<div class="bar-item">' +
        '<div class="bar-fill' + (mins === 0 ? ' empty' : '') + '" style="height:' + h + '%"></div>' +
        '<div class="bar-day">' + (isToday ? '今' : dayLabels[idx]) + '</div>' +
        '</div>';
    });
    chart.innerHTML = chartHTML;

    // 本周统计
    var weekMin = 0, weekCount = 0;
    last7Days.forEach(function (ds) {
      weekMin += dayTotals[ds];
      weekCount += dayCount[ds];
    });
    var weekAvg = weekCount > 0 ? (weekMin / weekCount).toFixed(1) : '0';
    document.getElementById('statTotal').textContent = weekMin;
    document.getElementById('statAvg').textContent = weekAvg;

    // 连续天数：从今天往前数有休息的连续天数
    var streak = 0;
    for (var si = 0; si < 365; si++) {
      var sd = new Date(now);
      sd.setDate(sd.getDate() - si);
      var sds = dateStrOf(sd);
      if (dayTotals.hasOwnProperty(sds)) {
        if (dayTotals[sds] > 0) streak++;
        else break;
      } else {
        // 超出 7 天范围后也要查全量 history
        var found = false;
        for (var fi = 0; fi < all.length; fi++) {
          if (all[fi].date === sds && all[fi].minutes > 0) { found = true; break; }
        }
        if (found) streak++; else break;
      }
    }
    document.getElementById('statStreak').textContent = streak;

    // 情绪汇总（最近 10 条）
    var recentMoods = all.slice(-10);
    var moodCount = {};
    Object.keys(MOOD_MAP).forEach(function (k) { moodCount[k] = 0; });
    recentMoods.forEach(function (rec) { if (rec.mood && moodCount.hasOwnProperty(rec.mood)) moodCount[rec.mood]++; });
    var moodBox = document.getElementById('moodTags');
    var moodHTML = '';
    var hasMood = false;
    Object.keys(MOOD_MAP).forEach(function (k) {
      if (moodCount[k] > 0) {
        hasMood = true;
        moodHTML += '<span class="mood-tag"><span class="tag-emoji">' + MOOD_MAP[k].emoji + '</span>' +
          MOOD_MAP[k].label + '<span class="tag-count">' + moodCount[k] + '</span></span>';
      }
    });
    if (!hasMood) moodHTML = '<div class="mood-empty">还没有情绪记录，下次休息后选一下吧～</div>';
    moodBox.innerHTML = moodHTML;
  }

  /* ---------- 结束页情绪选择（回填最后一条 history） ---------- */
  document.getElementById('moodEmojis').addEventListener('click', function (e) {
    var btn = e.target.closest('.mood-btn');
    if (!btn) return;
    var mood = btn.getAttribute('data-mood');
    document.querySelectorAll('.mood-btn').forEach(function (b) { b.classList.remove('active'); });
    btn.classList.add('active');
    // 回填最后一条完整休息记录的 mood
    var history = getHistory();
    for (var i = history.length - 1; i >= 0; i--) {
      if (history[i].mood === null) {
        history[i].mood = mood;
        setHistory(history);
        break;
      }
    }
    showToast('已记录今日感受 ' + MOOD_MAP[mood].emoji);
  });

  /* ---------- 生成回顾卡弹窗 ---------- */
  document.getElementById('genReviewCard').addEventListener('click', function () {
    var all = getHistory();
    var now = new Date();
    var last7Days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(now);
      d.setDate(d.getDate() - i);
      last7Days.push(dateStrOf(d));
    }
    var weekMin = 0, weekCount = 0;
    last7Days.forEach(function (ds) {
      all.forEach(function (rec) {
        if (rec.date === ds) { weekMin += rec.minutes; weekCount++; }
      });
    });
    var weekAvg = weekCount > 0 ? (weekMin / weekCount).toFixed(1) : '0';

    // 连续天数
    var streak = 0;
    for (var si = 0; si < 365; si++) {
      var sd = new Date(now);
      sd.setDate(sd.getDate() - si);
      var sds = dateStrOf(sd);
      var found = false;
      for (var fi = 0; fi < all.length; fi++) {
        if (all[fi].date === sds && all[fi].minutes > 0) { found = true; break; }
      }
      if (found) streak++; else break;
    }

    var startLabel = last7Days[0].slice(5).replace('-', '/');
    var endLabel = last7Days[6].slice(5).replace('-', '/');
    document.getElementById('reviewCardPreview').innerHTML =
      '<div class="review-title">本周休息回顾 🍅</div>' +
      '<div class="review-week">' + startLabel + ' — ' + endLabel + '</div>' +
      '<div class="review-nums">' +
        '<div class="review-num-item"><div class="review-num">' + weekMin + '</div><div class="review-label">分钟</div></div>' +
        '<div class="review-num-item"><div class="review-num">' + weekAvg + '</div><div class="review-label">平均/次</div></div>' +
        '<div class="review-num-item"><div class="review-num">' + streak + '</div><div class="review-label">连续天</div></div>' +
      '</div>' +
      '<div class="review-bottom">番茄蛋仔蟹说：理直气壮地休息，就是认真生活 🌿</div>';
    document.getElementById('reviewCardModal').classList.add('show');
  });
  document.getElementById('closeReviewCard').addEventListener('click', function () {
    document.getElementById('reviewCardModal').classList.remove('show');
  });

  /* ---------- Toast ---------- */
  var toastTimer = null;
  function showToast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1800);
  }

  /* ---------- 初始化 ---------- */
  renderScenes();
  document.getElementById('guideCrab').innerHTML = crabSVG(1, 'wave');
})();
