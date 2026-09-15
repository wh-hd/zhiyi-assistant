
  /* ========================================
     Global State
     ======================================== */
  let D = null;            // loaded JSON data
  let currentScreenId = 'screen-home';
  let historyStack = [];

  /* ========================================
     Shared SVG Fragments
     ======================================== */
  const SVG = {
    statusBar: '<span class="sb-icon"><svg viewBox="0 0 17 11" fill="none"><rect x=".5" y=".5" width="14" height="10" rx="2" stroke="#1A1A18" stroke-opacity=".8"/></svg></span><span class="sb-icon"><svg viewBox="0 0 17 11" fill="#1A1A18" fill-opacity=".8"><path d="M1 3.5C1 2.67 1.67 2 2.5 2h12c.83 0 1.5.67 1.5 1.5v4c0 .83-.67 1.5-1.5 1.5h-12C1.67 9 1 8.33 1 7.5v-4z"/><rect x="2" y="3" width="10" height="5" rx="1" fill="#fff"/><rect x="14" y="4.5" width="1.5" height="2" rx=".75" fill="#fff"/></svg></span>',
    back: '<svg viewBox="0 0 22 22" fill="none" stroke="#1A1A18" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6L9 12L15 18"/></svg>',
    check: '<svg viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    aiAvatar: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><path d="M12 2a3 3 0 00-3 3v1H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-2V5a3 3 0 00-3-3zM10 5a2 2 0 114 0v1h-4V5z"/></svg>',
    mic: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="2" width="6" height="10" rx="3" fill="currentColor" stroke="none"/><path d="M3 9c0 3.31 2.69 6 6 6s6-2.69 6-6"/><line x1="9" y1="15" x2="9" y2="18"/><line x1="6" y1="18" x2="12" y2="18"/></svg>',
    send: '<svg viewBox="0 0 18 18" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 2L7 11M16 2L11 16L7 11M16 2L3 7"/></svg>',
    info: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
    shieldInfo: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M7 13A6 6 0 107 1a6 6 0 000 12z"/><path d="M7 4v4M7 10h.01"/></svg>',
    alert: '<svg viewBox="0 0 14 14" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="6"/><path d="M7 4v3M7 10h.01"/></svg>',
    star: '<svg viewBox="0 0 12 12" fill="none"><path d="M6 2L7.5 5L11 5.5L8.5 8L9 11.5L6 9.5L3 11.5L3.5 8L1 5.5L4.5 5L6 2Z" fill="currentColor"/></svg>',
    archiveIcon: '<svg viewBox="0 0 24 24" stroke-width="2" stroke-linecap="round"><circle cx="9" cy="7" r="4"/><circle cx="15" cy="7" r="4"/><path d="M5 21v-2a4 4 0 014-4h6a4 4 0 014 4v2"/></svg>',
    chevron: '›'
  };

  /* ========================================
     Data Loading
     去静态化：不再依赖 data.json / window.APP_DATA / window.TEST_DATA。
     loadData() 仅返回「内置 UI 结构配置 + 空占位」(DEFAULT_CONFIG)，
     真实业务数据（家庭成员 / 用药 / 指标 / 咨询 / 自评 / 报告 / 知识库等）
     由 syncFromBackend() 通过后端 API 拉取并深度合并覆盖到 D 上。
     ======================================== */
  function deepMerge(target, source) {
    for (var key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {};
          deepMerge(target[key], source[key]);
        } else {
          target[key] = source[key];
        }
      }
    }
  }

  // 内置默认配置：仅 UI 结构（导航 / 表单选项 / 文案）+ 空占位内容。
  // 业务数据全部来自后端，加载失败或字段缺失时以空占位 / 空状态呈现，不崩溃。
  var DEFAULT_CONFIG = {
    "app": { "name": "智医助手", "subtitle": "AI 家庭健康管理", "statusBarTime": "9:41" },
    "tabs": [
      { "key": "home", "label": "首页", "icon": "<path d=\"M3 12L12 4L21 12V20C21 20.5 20.5 21 20 21H15V14H9V21H4C3.5 21 3 20.5 3 20V12Z\" stroke-linejoin=\"round\"/>" },
      { "key": "consult", "label": "咨询", "icon": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01\" stroke-linecap=\"round\"/>" },
      { "key": "archive", "label": "档案", "icon": "<path d=\"M3 7V19C3 20 4 21 5 21H19C20 21 21 20 21 19V7\" stroke-linejoin=\"round\"/><path d=\"M3 7L5 3H19L21 7\" stroke-linejoin=\"round\"/><path d=\"M9 11H15\"/>" },
      { "key": "profile", "label": "我的", "icon": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21C4 17 7.5 14 12 14C16.5 14 20 17 20 21\" stroke-linecap=\"round\"/>" }
    ],
    "tabScreenMap": {
      "home": "home", "consult": "consult", "archive": "archive", "profile": "profile",
      "assess": "home", "meds": "home", "metrics": "home", "assess-report": "home",
      "member-detail": "archive", "add-member": "archive", "add-med": "home",
      "record-metric": "home", "settings": "profile", "about": "profile",
      "auth-manage": "profile", "change-pwd": "profile"
    },
    "screenOrder": [
      "screen-login", "screen-home", "screen-assess", "screen-assess-report",
      "screen-consult", "screen-archive", "screen-member-detail", "screen-add-member",
      "screen-meds", "screen-add-med", "screen-metrics", "screen-record-metric",
      "screen-profile", "screen-settings", "screen-about", "screen-auth-manage", "screen-change-pwd"
    ],
    "assessment": { "pageTitle": "家庭健康自评", "estimatedTime": "约需 30 秒" },
    "addMember": {
      "pageTitle": "添加成员",
      "relations": ["爸爸", "妈妈", "配偶", "儿子", "女儿", "其他"],
      "genders": ["男", "女"],
      "healthConditions": ["高血压", "糖尿病", "高血脂", "心脏病", "无慢性病"]
    },
    "addMed": {
      "pageTitle": "添加用药",
      "members": [],
      "frequencies": ["每日一次", "每日两次", "每日三次", "按需服用"],
      "methods": ["饭前", "饭后", "睡前", "随时"]
    },
    "recordMetric": {
      "pageTitle": "记录指标",
      "types": [
        { "key": "bp", "label": "血压", "iconBg": "rgba(208,128,104,.1)", "iconStroke": "#D08068", "icon": "<path d=\"M3 12h4l3-8 4 16 3-8h4\"/>" },
        { "key": "weight", "label": "体重", "iconBg": "rgba(216,149,117,.1)", "iconStroke": "#D89575", "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>" },
        { "key": "glucose", "label": "血糖", "iconBg": "rgba(212,166,74,.1)", "iconStroke": "#D4A64A", "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>" },
        { "key": "hr", "label": "心率", "iconBg": "rgba(61,138,90,.1)", "iconStroke": "#3D8A5A", "icon": "<path d=\"M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z\"/>" }
      ],
      "measurers": [],
      "glucoseTypes": ["空腹", "餐后2小时"]
    },
    "settings": {
      "pageTitle": "设置",
      "notifications": [
        { "label": "用药提醒通知", "enabled": true },
        { "label": "健康任务通知", "enabled": true },
        { "label": "健康报告推送", "enabled": false }
      ],
      "privacy": [
        { "label": "健康数据授权管理", "type": "arrow", "action": "screen:auth-manage" },
        { "label": "匿名化数据分享", "type": "toggle", "enabled": false }
      ],
      "data": [
        { "label": "导出健康数据", "type": "arrow", "action": "modal:export" },
        { "label": "清除本地缓存", "type": "arrow", "value": "23.5MB", "action": "modal:clear" }
      ],
      "account": [
        { "label": "修改密码", "type": "arrow", "action": "screen:change-pwd" },
        { "label": "微信绑定", "type": "value", "value": "已绑定" },
        { "label": "退出登录", "type": "logout", "action": "modal:logout" }
      ],
      "version": "v1.0.0",
      "authManage": {
        "pageTitle": "健康数据授权管理",
        "dataTypes": [],
        "thirdParty": []
      }
    },
    "about": {
      "pageTitle": "关于我们",
      "appName": "智医助手",
      "appDesc": "AI 家庭健康管理",
      "version": "v1.0.0",
      "intro": [
        "智医助手是一款面向家庭场景的健康管理工具，帮助您记录和追踪家人的健康指标、用药情况和日常健康任务。",
        "通过 AI 健康咨询，您可以快速获取健康参考建议，及时了解家人的健康状况，做到早关注、早预防。",
        "我们致力于让家庭健康管理更简单、更温暖，让每一位家人都被妥善关怀。"
      ],
      "disclaimer": "智医助手提供的所有信息仅供参考，不构成医疗诊断建议。如有健康问题，请及时咨询专业医生。",
      "contacts": [
        { "label": "客服邮箱", "value": "support@zhiyi.health", "toast": "客服邮箱已复制" },
        { "label": "官方网站", "value": "www.zhiyi.health", "toast": "官方网站已复制" },
        { "label": "用户协议", "value": "", "toast": "用户协议" }
      ],
      "copyright": "© 2024 智医助手 保留所有权利"
    },
    "home": {
      "healthScore": { "label": "家庭健康评分", "value": "--", "badge": "评估中" },
      "statsRow": [
        { "value": "--", "label": "在管成员", "variant": "default" },
        { "value": "--", "label": "今日用药", "variant": "secondary" },
        { "value": "--", "label": "待办事项", "variant": "tertiary" }
      ],
      "quickActions": [
        { "label": "AI 咨询", "target": "consult", "bgColor": "rgba(61,138,90,.1)", "strokeColor": "#3D8A5A", "icon": "<path d=\"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z\"/>" },
        { "label": "用药提醒", "target": "meds", "bgColor": "rgba(216,149,117,.1)", "strokeColor": "#D89575", "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/><circle cx=\"8\" cy=\"12\" r=\"1.5\" fill=\"#D89575\"/><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"14\"/>" },
        { "label": "指标记录", "target": "metrics", "bgColor": "rgba(208,128,104,.1)", "strokeColor": "#D08068", "icon": "<path d=\"M3 12h4l3-8 4 16 3-8h4\"/>" },
        { "label": "健康自评", "target": "assess", "bgColor": "rgba(212,166,74,.1)", "strokeColor": "#D4A64A", "icon": "<path d=\"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4\"/>" }
      ],
      "familyMembers": [],
      "tasks": []
    },
    "consult": {
      "pageTitle": "AI 健康咨询",
      "disclaimerBadge": "免责声明",
      "aiDisclaimer": "以下为健康咨询，不构成医疗诊断",
      "inputPlaceholder": "描述健康问题...",
      "redlineAlert": {
        "title": "就医红线提醒",
        "desc": "若出现以下症状请立即就医：持续高烧不退（>39度）、胸痛呼吸困难、意识模糊、剧烈腹痛或大量出血。"
      },
      "autoReply": {
        "text": "已收到您的咨询，正在分析中...请注意：以上为健康咨询建议，不构成医疗诊断。如症状持续或加重，请及时就医。",
        "statusTag": "分析中"
      }
    },
    "archive": {
      "pageTitle": "家庭健康档案",
      "summary": { "title": "家庭健康概览", "desc": "加载中…" },
      "members": [],
      "events": []
    },
    "meds": {
      "pageTitle": "用药提醒",
      "summary": { "taken": 0, "total": 0 },
      "medications": [],
      "adherence": { "label": "用药依从度", "percent": 0, "desc": "暂无数据" }
    },
    "metrics": {
      "pageTitle": "健康指标",
      "currentLabel": "当前指标",
      "recordsLabel": "最近记录",
      "metrics": [],
      "trend": {
        "label": "近 7 天趋势",
        "systolic": { "points": "", "color": "var(--primary)", "label": "收缩压" },
        "diastolic": { "points": "", "color": "var(--tertiary)", "label": "舒张压" }
      },
      "records": []
    },
    "profile": {
      "pageTitle": "我的",
      "menuItems": [
        { "text": "家庭健康档案", "action": "screen:archive", "iconBg": "rgba(61,138,90,.1)", "iconStroke": "#3D8A5A", "icon": "<path d=\"M3 7V19a2 2 0 002 2h14a2 2 0 002-2V7M3 7L5 3h14l2 4M9 11h6\"/>" },
        { "text": "健康自评记录", "action": "screen:assess", "iconBg": "rgba(212,166,74,.1)", "iconStroke": "#D4A64A", "icon": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 8h6M9 12h6M9 16h4\"/>" },
        { "text": "用药管理", "action": "screen:meds", "iconBg": "rgba(216,149,117,.1)", "iconStroke": "#D89575", "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>" },
        { "text": "设置", "action": "screen:settings", "iconBg": "rgba(139,139,136,.1)", "iconStroke": "#8B8B88", "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.4 1a7 7 0 00-2.5-1.4L14 3h-4l-.1 2.5a7 7 0 00-2.5 1.4l-2.4-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.4-1a7 7 0 002.5 1.4L10 21h4l.1-2.5a7 7 0 002.5-1.4l2.4 1 2-3.4-2-1.5c0-.4.1-.9.1-1.3z\"/>" },
        { "text": "关于我们", "action": "screen:about", "iconBg": "rgba(61,138,90,.1)", "iconStroke": "#3D8A5A", "icon": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4M12 8h.01\"/>" }
      ]
    },
    "memberDetail": { "pageTitle": "健康档案", "members": [] },
    "assessReport": { "pageTitle": "自评报告" },
    "user": { "name": "家庭成员", "avatarText": "家", "greetingSub": "今天家人都还好吗？", "profileTag": "家庭健康管理师", "stats": [] }
  };

  async function loadData() {
    // 去静态化：仅返回内置 UI 结构与空占位；真实业务数据由 syncFromBackend() 经 API 覆盖。
    console.log('[智医助手] 加载内置默认配置（UI 结构 + 空占位）');
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  /* ========================================
     Status Bar Renderer
     ======================================== */
  function renderStatusBar(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML =
      '<span class="status-bar-time">' + currentClockStr() + '</span>' +
      '<div class="status-bar-right">' +
        '<span class="sb-battery"><span class="sb-bat-pct">--%</span>' +
          '<span class="sb-bat-icon"><span class="sb-bat-fill"></span></span></span>' +
        '<span class="sb-icon"><svg viewBox="0 0 17 11" fill="none">' +
          '<rect x="0" y="6" width="3" height="5" rx="1" fill="#1A1A18"/>' +
          '<rect x="4.5" y="4" width="3" height="7" rx="1" fill="#1A1A18"/>' +
          '<rect x="9" y="2" width="3" height="9" rx="1" fill="#1A1A18"/>' +
          '<rect x="13.5" y="0" width="3" height="11" rx="1" fill="#1A1A18"/></svg></span>' +
      '</div>';
  }

  // 实时时钟文案（HH:MM，24 小时制）
  function currentClockStr() {
    var d = new Date();
    var h = d.getHours(), m = d.getMinutes();
    return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m);
  }

  // 启动状态栏实时刷新（时钟 + 电量），全局只初始化一次
  function initStatusBar() {
    if (window.__statusBarStarted) return;
    window.__statusBarStarted = true;

    function tickClock() {
      var t = currentClockStr();
      document.querySelectorAll('.status-bar-time').forEach(function(n) { n.textContent = t; });
    }
    tickClock();
    setInterval(tickClock, 15000);

    function renderBattery(level, charging) {
      var pct = Math.round((typeof level === 'number' ? level : 1) * 100);
      document.querySelectorAll('.sb-bat-pct').forEach(function(n) { n.textContent = pct + '%'; });
      document.querySelectorAll('.sb-bat-icon').forEach(function(icon) {
        var fill = icon.querySelector('.sb-bat-fill');
        if (fill) fill.style.width = Math.max(4, pct) + '%';
        icon.classList.toggle('charging', !!charging);
        icon.classList.toggle('low', pct <= 20 && !charging);
      });
    }

    if (navigator.getBattery) {
      navigator.getBattery().then(function(battery) {
        renderBattery(battery.level, battery.charging);
        battery.addEventListener('levelchange', function() { renderBattery(battery.level, battery.charging); });
        battery.addEventListener('chargingchange', function() { renderBattery(battery.level, battery.charging); });
      }).catch(function() { renderBattery(1, false); });
    } else {
      renderBattery(1, false); // 不支持 Battery API 的浏览器给满电占位
    }
  }

  /* ========================================
     Tab Bar System
     ======================================== */
  function buildTabBar(activeKey) {
    return D.tabs.map(tab => {
      const isActive = tab.key === activeKey;
      return '<div class="tab-item ' + (isActive ? 'active' : '') + '" data-screen="' + tab.key + '" onclick="switchTab(\'' + tab.key + '\')">' +
        '<svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="' + (isActive ? '#fff' : '#8B8B88') + '" stroke-width="2">' + tab.icon + '</svg>' +
        '<span class="tab-label">' + tab.label + '</span>' +
      '</div>';
    }).join('');
  }

  function initTabBars() {
    document.querySelectorAll('[data-tabbar]').forEach(el => {
      el.innerHTML = buildTabBar(el.dataset.tabbar);
    });
  }

  /* ========================================
     Page Header Renderer
     ======================================== */
  function pageHeader(title, showBack, rightBtnHtml) {
    var left = showBack
      ? '<div class="back-btn" onclick="goBack()">' + SVG.back + '</div>'
      : '<div style="width:32px"></div>';
    var right = rightBtnHtml || '<div style="width:32px"></div>';
    return '<div class="page-header">' + left + '<span class="page-title">' + title + '</span>' + right + '</div>';
  }

  function addBtn(label, action) {
    var onclick;
    if (action.indexOf('toast:') === 0) {
      onclick = 'showToast(\'' + action.substring(6) + '\')';
    } else if (action.indexOf('screen:') === 0) {
      onclick = 'switchScreen(\'' + action.substring(7) + '\')';
    } else {
      onclick = 'switchScreen(\'' + action + '\')';
    }
    return '<button class="header-btn" onclick="' + onclick + '">' + label + '</button>';
  }

  /* ========================================
     SCREEN 1: Home Dashboard
     ======================================== */
  function renderHome() {
    var h = D.home, u = D.user;
    var html = '';

    // Greeting（根据实际时间动态计算）
    var dynGreeting = (typeof getGreeting === 'function' ? getGreeting() : '早上好') + '，' + (u.name || '用户');
    html += '<div class="home-greeting-row">' +
      '<div><div class="greeting-name">' + dynGreeting + '</div>' +
      '<div class="greeting-sub">' + (u.greetingSub || '今天家人都还好吗？') + '</div></div>' +
      '<div class="avatar-circle" onclick="switchScreen(\'profile\')">' + u.avatarText + '</div></div>';

    // Score card
    html += '<div class="score-card"><div>' +
      '<div class="score-label">' + h.healthScore.label + '</div>' +
      '<div class="score-value">' + h.healthScore.value + '</div></div>' +
      '<div class="score-badge">' + SVG.star + h.healthScore.badge + '</div></div>';

    // Stats row
    html += '<div class="stats-row">';
    h.statsRow.forEach(function(s) {
      var statId = '';
      if (s.label === '待办事项') statId = ' id="stat-tasks-val"';
      else if (s.label === '今日用药') statId = ' id="stat-meds-val"';
      html += '<div><div class="stat-val ' + (s.variant !== 'default' ? s.variant : '') + '"' + statId + '>' + s.value + '</div>' +
        '<div class="stat-lbl">' + s.label + '</div></div>';
    });
    html += '</div>';

    // Quick actions
    html += '<div class="qa-grid">';
    h.quickActions.forEach(function(a) {
      html += '<button class="qa-btn" onclick="switchScreen(\'' + a.target + '\')">' +
        '<div class="qa-icon-wrap" style="background:' + a.bgColor + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="' + a.strokeColor + '" stroke-width="2" stroke-linecap="round">' + a.icon + '</svg>' +
        '</div><span class="qa-label">' + a.label + '</span></button>';
    });
    html += '</div>';

    // Family members
    html += '<div class="fm-header"><span class="section-label">家庭成员</span>' +
      '<span class="fm-all" onclick="switchScreen(\'archive\')">全部 →</span></div>';
    html += '<div class="fm-row">';
    h.familyMembers.forEach(function(m, i) {
      html += '<div class="fm-card" onclick="openMemberDetail(' + i + ')">' +
        '<div class="fm-avatar" style="background:' + m.avatarColor + '">' + m.avatarText + '</div>' +
        '<div class="fm-name">' + m.name + '</div>' +
        '<div class="fm-status ' + m.statusType + '">' + m.status + '</div></div>';
    });
    html += '</div>';

    // Tasks
    html += '<div class="tt-header"><span class="section-label">今日健康任务</span>' +
      '<span class="tt-count" id="task-count">' + h.tasks.length + '项待办</span></div>';
    h.tasks.forEach(function(t, i) {
      html += '<div class="task-card" data-task-idx="' + i + '" onclick="toggleTask(this)">' +
        '<div class="task-check">' + SVG.check + '</div>' +
        '<div class="task-info"><div class="task-title">' + t.title + '</div>' +
        '<div class="task-detail">' + t.detail + '</div></div>' +
        '<div class="task-icon" style="background:' + t.iconBg + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="' + t.iconStroke + '" stroke-width="2">' + t.icon + '</svg>' +
        '</div></div>';
    });

    document.getElementById('content-home').innerHTML = html;
  }

  /* ========================================
     SCREEN 2: Assessment
     ======================================== */
  // ── 自评状态（全部来自后端，无静态题目）──
  var assessSelections = {}; // {questionId: [selectedOptionIndices]}

  // 后端自评会话状态（step 制：每步 1~2 题）
  var assessSessionId = null;
  var assessStep = 0;
  var assessTotalSteps = 0;
  var assessStepQuestions = [];   // 当前步骤题目数组（后端）
  var assessStepIndex = 0;        // 当前步骤内题目序号
  var assessStepAnswers = {};     // 当前步骤已收集答案 {questionId: value|value[]}
  var assessBackendMode = false;  // 自评始终走后端；true=已成功 start
  var assessGlobalAnswered = 0;   // 已完成题目累计数（进度条用）
  var assessResult = null;        // 后端返回的评分报告

  /** 重置所有自评状态 */
  function resetAssessState() {
    assessSelections = {};
    assessSessionId = null;
    assessStep = 0;
    assessTotalSteps = 0;
    assessStepQuestions = [];
    assessStepIndex = 0;
    assessStepAnswers = {};
    assessBackendMode = false;
    assessGlobalAnswered = 0;
    assessResult = null;
  }

  /** 分数 → 维度等级（对应 CSS 类 low/mid/high） */
  function scoreLevel(score) {
    if (score >= 8) return 'high';
    if (score >= 6) return 'mid';
    return 'low';
  }

  function renderAssess() {
    // 每次进入自评都重置并从后端拉取第一步题目（后端优先，失败降级静态）
    resetAssessState();

    var title = (D.assessment && D.assessment.pageTitle) || '家庭健康自评';
    var html = pageHeader(title, true);
    html += '<div class="progress-bar-wrapper">' +
      '<div class="pb-info"><span class="pb-text" id="assess-progress-text">加载中…</span>' +
      '<span class="pb-time" id="assess-progress-time"></span></div>' +
      '<div class="progress-track"><div class="progress-fill" id="assess-progress-fill" style="width:0%"></div></div></div>';
    html += '<div class="question-card">' +
      '<div class="q-main" id="assess-question">正在加载题目…</div>' +
      '<div class="q-sub" id="assess-sub"></div>' +
      '<div class="options-list" id="assess-options"></div>' +
      '<button class="continue-btn" id="assess-continue" onclick="assessNext()">继续</button></div>';

    document.getElementById('content-assess').innerHTML = html;
    loadAssessFirstQuestion();
  }

  /** 进入自评：优先调后端 start，失败则降级静态题目 */
  async function loadAssessFirstQuestion() {
    var qEl = document.getElementById('assess-question');
    if (qEl) qEl.textContent = '正在连接后端…';
    try {
      var ctx = await ensureMemberContext();
      var memberId = ctx && ctx.memberId;
      var res = await API.startAssessment({ memberId: memberId || '', type: 'initial', questionCount: 10 });
      if (res && res.sessionId && Array.isArray(res.questions) && res.questions.length) {
        assessBackendMode = true;
        assessSessionId = res.sessionId;
        assessStep = res.currentStep || 1;
        assessTotalSteps = res.totalSteps || res.questions.length || 10;
        assessStepQuestions = res.questions;
        assessStepIndex = 0;
        assessStepAnswers = {};
        renderAssessQuestion();
        return;
      }
      throw new Error('后端未返回有效题目');
    } catch (e) {
      console.error('[assess] 启动自评失败', e);
      var errEl = document.getElementById('assess-question');
      if (errEl) errEl.textContent = '无法开始自评';
      var subEl = document.getElementById('assess-sub');
      if (subEl) subEl.textContent = (e && e.message) ? e.message : '请检查网络或登录状态后重试';
      var optEl = document.getElementById('assess-options');
      if (optEl) optEl.innerHTML = '<button class="continue-btn" onclick="renderAssess()">重新加载</button>';
    }
  }

  function renderAssessQuestion() {
    var q = assessStepQuestions[assessStepIndex];
    if (!q) {
      var qEl2 = document.getElementById('assess-question');
      if (qEl2) qEl2.textContent = '题目加载失败，请返回重试';
      return;
    }

    var opts = q.options.map(function(o) { return o.label; });
    var sub = (q.type === 'multiple') ? '可多选' : '单选';
    var within = (assessStepIndex + 1) / assessStepQuestions.length;
    var progressPct = ((assessStep - 1) + within) / (assessTotalSteps || 10) * 100;
    var progressText = '第 ' + assessStep + ' 步 / 共 ' + (assessTotalSteps || 10) + ' 步';
    var isLast = assessStepIndex === assessStepQuestions.length - 1;

    document.getElementById('assess-progress-text').textContent = progressText;
    document.getElementById('assess-progress-fill').style.width = progressPct + '%';
    document.getElementById('assess-question').textContent = q.question;
    document.getElementById('assess-sub').textContent = sub || '';

    // 已选状态：以后端 questionId 为 key
    var selKey = q.id;
    var selectedIndices = assessSelections[selKey] || [];

    var isSingle = q.type === 'single';
    var optsHtml = opts.map(function(opt, i) {
      var selected = selectedIndices.indexOf(i) >= 0 ? ' selected' : '';
      return '<div class="option-item' + selected + '" onclick="toggleOption(this, ' + i + ', ' + isSingle + ')"><div class="opt-radio"></div><span class="opt-text">' + escapeHtml(opt) + '</span></div>';
    }).join('');
    document.getElementById('assess-options').innerHTML = optsHtml;

    document.getElementById('assess-continue').textContent = isLast ? '完成自评' : '继续';
  }

  function toggleOption(el, idx, isSingle) {
    // 当前题目 key：后端 questionId
    var selKey = assessStepQuestions[assessStepIndex] && assessStepQuestions[assessStepIndex].id;
    if (!assessSelections[selKey]) assessSelections[selKey] = [];
    var arr = assessSelections[selKey];

    if (isSingle) {
      // 单选：清空所有选项的视觉选中态，仅保留当前项
      var siblings = el.parentNode.querySelectorAll('.option-item');
      siblings.forEach(function(s) { s.classList.remove('selected'); });
      arr.length = 0;
      el.classList.add('selected');
      arr.push(idx);
      return;
    }

    el.classList.toggle('selected');
    var pos = arr.indexOf(idx);
    if (pos >= 0) arr.splice(pos, 1);
    else arr.push(idx);
  }

  function assessNext() {
    assessNextBackend();
  }

  /** 后端模式：收集当前步骤答案 → submitAnswer → 下一题或结果 */
  async function assessNextBackend() {
    var q = assessStepQuestions[assessStepIndex];
    var selKey = q.id;
    var selIndices = assessSelections[selKey];
    if (!selIndices || selIndices.length === 0) {
      showToast('请至少选择一个选项');
      return;
    }
    // 选项索引 → 后端需要的 option.value
    var values = selIndices.map(function(i) { return q.options[i].value; });
    assessStepAnswers[selKey] = (q.type === 'multiple') ? values : values[0];

    if (assessStepIndex < assessStepQuestions.length - 1) {
      assessStepIndex++;
      renderAssessQuestion();
      return;
    }

    // 当前步骤最后一题 → 提交后端
    var btn = document.getElementById('assess-continue');
    if (btn) { btn.disabled = true; btn.textContent = '提交中…'; }

    try {
      var res = await API.submitAnswer(assessSessionId, {
        step: assessStep,
        answers: assessStepAnswers,
      });

      if (res && Array.isArray(res.questions) && res.questions.length) {
        // 进入下一步
        assessGlobalAnswered += assessStepQuestions.length;
        assessStep = res.currentStep || (assessStep + 1);
        assessStepQuestions = res.questions;
        assessStepIndex = 0;
        assessStepAnswers = {};
        renderAssessQuestion();
        return;
      }

      // 全部完成 → 拉取权威评分报告（任务要求：调 getAssessResult）
      var result = (res && res.categoryScores) ? res : null;
      try {
        result = await API.getAssessResult(assessSessionId);
      } catch (e2) {
        console.warn('[assess] getAssessResult 失败，使用提交返回结果', e2);
        result = result || res;
      }
      assessResult = result;
      switchScreen('assess-report');
    } catch (e) {
      console.error('[assess] 提交答案失败', e);
      showToast('提交失败：' + (e && e.message ? e.message : '网络错误'));
      if (btn) { btn.disabled = false; btn.textContent = '完成自评'; }
    }
  }

  /* ========================================
     SCREEN 3: AI Consultation
     ======================================== */
  // ── 咨询历史缓存：memberId -> [{type, text, statusTag, createdAt}] ──
  window.consultCache = window.consultCache || {};

  // 从后端拉取某成员的历史咨询并写入缓存（修正字段映射 queryText/responseText/redLineTriggered）
  async function loadConsultHistory(memberId) {
    if (!memberId) return [];
    try {
      var history = await API.getConsultHistory(memberId);
      if (!history) return [];
      var items = Array.isArray(history) ? history : (history.items || []);
      var msgs = [];
      // 后端按时间倒序返回 → 转为正序（旧→新）用于聊天展示
      items.slice().reverse().forEach(function(it) {
        msgs.push({ type: 'user', avatarText: '我', text: it.queryText || '' });
        msgs.push({
          type: 'ai', avatarColor: 'var(--primary)', text: it.responseText || '',
          statusTag: it.redLineTriggered ? '已触发红线' : '暂无风险',
          createdAt: it.createdAt,
        });
      });
      window.consultCache[memberId] = msgs;
      return msgs;
    } catch (e) {
      console.warn('[consult] 历史加载失败', e);
      return [];
    }
  }

  // 切换咨询成员（仅限当前登录用户家庭内的成员，后端再做一次权限校验）
  function switchConsultMember(memberId) {
    window.activeConsultMemberId = memberId;
    renderConsult();
  }

  // 根据已登录用户家庭范围内的成员，动态渲染该成员的持久化历史
  function renderConsultMessages(memberId) {
    var chatArea = document.getElementById('chat-area');
    if (!chatArea) return;
    var msgs = window.consultCache[memberId];
    if (msgs && msgs.length) {
      chatArea.innerHTML = '';
      msgs.forEach(function(m) { chatArea.insertAdjacentHTML('beforeend', renderChatMsg(m)); });
      scrollConsultToBottom();
      return;
    }
    if (!memberId) {
      // 兜底：重新走独立解析链路
      ensureMemberContext().then(function(ctx) {
        if (ctx && ctx.memberId) {
          if (!window.activeConsultMemberId) window.activeConsultMemberId = ctx.memberId;
          renderConsultMessages(ctx.memberId);
        } else {
          var ca2 = document.getElementById('chat-area');
          if (ca2) ca2.innerHTML = '<div class="chat-loading">无法加载家庭成员，请检查网络后刷新</div>';
        }
      });
      return;
    }
    chatArea.innerHTML = '<div class="chat-loading">正在加载历史咨询…</div>';
    loadConsultHistory(memberId).then(function(list) {
      var ca = document.getElementById('chat-area');
      if (!ca) return;
      if (list && list.length) {
        ca.innerHTML = '';
        list.forEach(function(m) { ca.insertAdjacentHTML('beforeend', renderChatMsg(m)); });
      } else {
        ca.innerHTML = '<div class="chat-loading">暂无历史咨询，开始与 AI 助手对话吧</div>';
      }
      scrollConsultToBottom();
    });
  }

  function scrollConsultToBottom() {
    var cc = document.getElementById('content-consult');
    if (cc) cc.scrollTop = cc.scrollHeight;
  }

  function renderConsult() {
    var c = D.consult;
    var html = pageHeader(c.pageTitle, true);

    var loginName = (D.user && (D.user.name || (D.user.greeting || '').split('，')[1])) || '微信用户';
    // 先渲染骨架（输入框等始终可用），chat-area 后续由 ensureMemberContext 填充
    html += '<div class="consult-scope">当前登录：' + escapeHtml(loginName) + '</div>';
    html += '<div style="margin-bottom:4px;"></div>';

    // Disclaimer badge
    html += '<div class="disclaimer-badge">' + SVG.info + c.disclaimerBadge + '</div>';

    // Chat area（由 resolveAndRenderConsult 动态填充）
    html += '<div class="chat-area" id="chat-area"><div class="chat-loading">正在连接家庭成员…</div></div>';

    // Red line alert
    html += '<div class="redline-alert">' +
      '<div class="rl-icon">' + SVG.alert + '</div>' +
      '<div><div class="rl-title">' + c.redlineAlert.title + '</div>' +
      '<div class="rl-desc">' + c.redlineAlert.desc + '</div></div></div>';

    // AI disclaimer
    html += '<div class="ai-disclaimer">' + SVG.shieldInfo + c.aiDisclaimer + '</div>';

    // Input bar
    html += '<div class="chat-input-bar" style="margin-top:var(--lg);">' +
      '<input type="text" class="chat-input" id="chat-input" placeholder="' + c.inputPlaceholder + '" onkeydown="if(event.key===\'Enter\')sendChat()" oninput="updateChatButton()">' +
      '<button class="send-btn" id="send-btn" onclick="handleSendOrVoice()">' + SVG.mic + '</button></div>';

    document.getElementById('content-consult').innerHTML = html;

    // 独立解析成员并渲染（不依赖 syncFromBackend 全局变量）
    resolveAndRenderConsult();
  }

  // 独立完成 登录→家庭→成员→历史 解析链路并渲染（renderConsult 的核心驱动）
  async function resolveAndRenderConsult() {
    var ctx = await ensureMemberContext();
    var ca = document.getElementById('chat-area');
    if (!ca) return;

    if (!ctx || !ctx.memberId) {
      ca.innerHTML = '<div class="chat-loading">无法加载家庭成员，请检查网络连接后刷新页面</div>';
      return;
    }

    // 默认选中当前成员（若未指定则用解析结果）
    if (!window.activeConsultMemberId) window.activeConsultMemberId = ctx.memberId;

    var members = window.activeMembers || [];
    var memberId = window.activeConsultMemberId || ctx.memberId;

    // 成员切换条插入到 chat-area 之前
    if (members.length > 1) {
      var switchHtml = '<div class="consult-member-switch">';
      members.forEach(function(m) {
        var active = (m.id === memberId) ? ' active' : '';
        switchHtml += '<button class="member-chip' + active + '" onclick="switchConsultMember(\'' +
          m.id + '\')">' + escapeHtml(m.nickname || '成员') + '</button>';
      });
      switchHtml += '</div>';
      ca.insertAdjacentHTML('beforebegin', switchHtml);
    }

    // 更新 scope 行显示成员数
    var scopeEl = ca.parentElement.querySelector('.consult-scope');
    if (scopeEl && members.length) {
      scopeEl.innerHTML = '当前登录：' + escapeHtml(
        (D.user && (D.user.name || (D.user.greeting || '').split('，')[1])) || '微信用户'
      ) + ' · 可查看 ' + members.length + ' 位家庭成员的咨询';
    }

    // 加载该成员的历史
    renderConsultMessages(memberId);
  }

  function renderChatMsg(msg) {
    var avatar;
    if (msg.avatarIcon) {
      avatar = '<div class="chat-avatar" style="background:' + msg.avatarColor + '">' + SVG.aiAvatar + '</div>';
    } else {
      avatar = '<div class="chat-avatar" style="background:' + msg.avatarColor + '">' + msg.avatarText + '</div>';
    }
    var statusTag = msg.statusTag
      ? '<div class="msg-status-tag"><span class="msg-status-dot"></span>' + msg.statusTag + '</div>'
      : '';
    return '<div class="chat-msg ' + (msg.type === 'user' ? 'self' : '') + '">' +
      avatar + '<div class="chat-bubble">' + escapeHtml(msg.text) + statusTag + '</div></div>';
  }

  /* ========================================
     SCREEN 4: Family Archive
     ======================================== */
  function renderArchive() {
    var a = D.archive;
    var html = pageHeader(a.pageTitle, true, addBtn('添加', 'screen:add-member'));

    // Summary
    html += '<div class="archive-summary">' +
      '<div class="as-icon">' + SVG.archiveIcon + '</div>' +
      '<div class="as-info"><div class="as-title">' + a.summary.title + '</div>' +
      '<div class="as-desc">' + a.summary.desc + '</div></div></div>';

    // Members
    html += '<div class="member-list">';
    a.members.forEach(function(m) {
      var onclick;
      if (m.action.indexOf('toast:') === 0) {
        onclick = 'showToast(\'' + m.action.substring(6) + '\')';
      } else if (m.action.indexOf('screen:member-detail') === 0 && m.memberIdx !== undefined) {
        onclick = 'openMemberDetail(' + m.memberIdx + ')';
      } else if (m.action.indexOf('screen:') === 0) {
        onclick = 'switchScreen(\'' + m.action.substring(7) + '\')';
      } else {
        onclick = 'switchScreen(\'' + m.action + '\')';
      }
      html += '<div class="member-card" onclick="' + onclick + '">' +
        '<div class="mc-avatar" style="background:' + m.avatarColor + '">' + m.avatarText + '</div>' +
        '<div class="mc-info"><div class="mc-name">' + m.name + '</div>' +
        '<div class="mc-detail">' + m.detail + '</div></div>' +
        '<div class="mc-dot" style="background:' + m.dotColor + '"></div></div>';
    });
    html += '</div>';

    // Events
    html += '<div class="section-label">近期健康事件</div>';
    html += '<div class="events-card">';
    a.events.forEach(function(e) {
      html += '<div class="event-item"><span class="event-txt">' + e.text + '</span>' +
        '<span class="event-time">' + e.time + '</span></div>';
    });
    html += '</div>';

    document.getElementById('content-archive').innerHTML = html;
  }

  /* ========================================
     SCREEN 5: Medication Reminders
     ======================================== */
  function renderMeds() {
    var m = D.meds;
    var html = pageHeader(m.pageTitle, true, addBtn('添加', 'screen:add-med'));

    // Summary
    var taken = m.summary.taken, total = m.summary.total;
    var pct = Math.round((taken / total) * 100);
    html += '<div class="med-summary">' +
      '<div class="ms-header"><span class="score-label" style="color:var(--text-primary);font-weight:700;">' + m.summary.title + '</span></div>' +
      '<div class="ms-header"><span class="ms-pct" id="med-progress-text">' + taken + '/' + total + '</span></div>' +
      '<div class="ms-desc" id="med-progress-desc">已服用 ' + taken + ' 项，待服用 ' + (total - taken) + ' 项</div>' +
      '<div class="ms-bar-track"><div class="ms-bar-fill" id="med-progress-bar" style="width:' + pct + '%"></div></div></div>';

    // Medication list
    html += '<div class="med-list" id="med-list">';
    m.medications.forEach(function(med, i) {
      html += renderMedCard(med, i);
    });
    html += '</div>';

    // Adherence
    html += '<div class="section-label">' + m.adherence.label + '</div>';
    html += '<div class="adherence-card"><div class="adherence-row">' +
      '<span class="adherence-pct">' + m.adherence.percent + '</span>' +
      '<div class="adherence-desc">' + m.adherence.desc + '</div></div></div>';

    document.getElementById('content-meds').innerHTML = html;
  }

  function renderMedCard(med, idx) {
    var statusIcon;
    if (med.taken) {
      statusIcon = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="var(--primary)"/><path d="M8 12l3 3 5-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
    } else {
      statusIcon = '<svg width="24" height="24" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" stroke="var(--tertiary)" stroke-width="2" fill="none"/><circle cx="12" cy="12" r="4" fill="var(--tertiary)"/></svg>';
    }
    return '<div class="med-card' + (med.taken ? ' taken' : '') + '" data-med-idx="' + Number(idx) + '">' +
      '<div class="med-time">' + escapeHtml(String(med.time || '')) + '</div>' +
      '<div class="med-info"><div class="med-name">' + escapeHtml(String(med.name || '')) + '</div>' +
      '<div class="med-detail">' + escapeHtml(String(med.detail || '')) + '</div></div>' +
      '<div class="med-status" data-handler="toggleMed(this, event)">' + statusIcon + '</div></div>';
  }

  /* ========================================
     SCREEN 6: Health Metrics
     ======================================== */
  function renderMetrics() {
    var m = D.metrics;
    var html = pageHeader(m.pageTitle, true, addBtn('记录', 'screen:record-metric'));

    // Current metrics
    html += '<div class="section-label">' + m.currentLabel + '</div>';
    html += '<div class="metrics-grid">';
    m.metrics.forEach(function(mc) {
      html += '<div class="metric-card"><div class="mc-label">' + mc.label + '</div>' +
        '<div class="mc-row"><span class="mc-val">' + mc.value + '</span>' +
        '<span class="mc-unit ' + (mc.unitType !== 'default' ? mc.unitType : '') + '">' + mc.unit + '</span></div></div>';
    });
    html += '</div>';

    // Trend chart
    var t = m.trend;
    html += '<div class="section-label">' + t.label + '</div>';
    html += '<div class="trend-chart-card"><div class="chart-area">' +
      '<svg class="chart-svg" viewBox="0 0 330 100" preserveAspectRatio="none">' +
      '<line x1="0" y1="20" x2="330" y2="20" stroke="#f0efe9" stroke-width="1"/>' +
      '<line x1="0" y1="50" x2="330" y2="50" stroke="#f0efe9" stroke-width="1"/>' +
      '<line x1="0" y1="80" x2="330" y2="80" stroke="#f0efe9" stroke-width="1"/>' +
      '<polyline points="' + t.systolic.points + '" fill="none" stroke="' + t.systolic.color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<polyline points="' + t.diastolic.points + '" fill="none" stroke="' + t.diastolic.color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      buildTrendDots(t.systolic) +
      buildTrendDots(t.diastolic) +
      '</svg></div>';
    html += '<div class="chart-legend">' +
      '<div class="legend-item"><div class="legend-dot" style="background:' + t.systolic.color + '"></div><span class="legend-text">' + t.systolic.label + '</span></div>' +
      '<div class="legend-item"><div class="legend-dot" style="background:' + t.diastolic.color + '"></div><span class="legend-text">' + t.diastolic.label + '</span></div>' +
      '</div></div>';

    // Records
    html += '<div class="section-label">' + m.recordsLabel + '</div>';
    html += '<div class="records-card">';
    m.records.forEach(function(r) {
      html += '<div class="record-item"><span class="record-text">' + r.text + '</span>' +
        '<span class="record-time">' + r.time + '</span></div>';
    });
    html += '</div>';

    document.getElementById('content-metrics').innerHTML = html;
  }

  function buildTrendDots(series) {
    if (!series || !series.points) return '';
    var pts = series.points.split(' ');
    return pts.map(function(p) {
      var xy = p.split(',');
      return '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" fill="' + series.color + '"/>';
    }).join('');
  }

  /* ========================================
     SCREEN 7: Profile
     ======================================== */
  function renderProfile() {
    var p = D.profile, u = D.user;
    var html = pageHeader(p.pageTitle, false);

    // Header
    html += '<div class="profile-header">' +
      '<div class="profile-avatar">' + u.avatarText + '</div>' +
      '<div class="profile-name">' + u.name + '</div>' +
      '<div class="profile-tag">' + u.profileTag + '</div></div>';

    // Stats
    html += '<div class="profile-stats">';
    u.stats.forEach(function(s) {
      html += '<div class="ps-item"><div class="ps-val">' + s.value + '</div><div class="ps-lbl">' + s.label + '</div></div>';
    });
    html += '</div>';

    // Menu
    html += '<div class="menu-list">';
    p.menuItems.forEach(function(item) {
      var onclick;
      if (item.action.indexOf('toast:') === 0) {
        onclick = 'showToast(\'' + item.action.substring(6) + '\')';
      } else if (item.action.indexOf('screen:') === 0) {
        onclick = 'switchScreen(\'' + item.action.substring(7) + '\')';
      } else {
        onclick = 'switchScreen(\'' + item.action + '\')';
      }
      html += '<div class="menu-item" onclick="' + onclick + '">' +
        '<div class="menu-icon" style="background:' + item.iconBg + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="' + item.iconStroke + '" stroke-width="2">' + item.icon + '</svg></div>' +
        '<span class="menu-text">' + item.text + '</span>' +
        '<span class="menu-arrow">' + SVG.chevron + '</span></div>';
    });
    html += '</div>';

    document.getElementById('content-profile').innerHTML = html;
  }

  /* ========================================
     SCREEN 8: Member Detail
     ======================================== */
  function openMemberDetail(idx) {
    window.currentMemberIdx = idx;
    switchScreen('member-detail');
  }

  function renderMemberDetail() {
    var members = (D.memberDetail && Array.isArray(D.memberDetail.members)) ? D.memberDetail.members : [];
    if (!members.length) {
      document.getElementById('content-member-detail').innerHTML =
        pageHeader((D.memberDetail && D.memberDetail.pageTitle) || '健康档案', true) +
        '<div class="md-empty">暂无成员档案，请先在「家庭健康档案」中添加成员。</div>';
      return;
    }
    var idx = window.currentMemberIdx || 0;
    if (idx >= members.length) idx = 0;
    var m = members[idx];
    var html = pageHeader(D.memberDetail.pageTitle, true);

    // Member info card
    html += '<div class="md-header-card">' +
      '<div class="md-avatar" style="background:' + m.avatarColor + '">' + m.avatarText + '</div>' +
      '<div class="md-info">' +
      '<div class="md-name">' + m.name + '</div>' +
      '<div class="md-detail">' + m.info + '</div>' +
      '<div class="md-status-tag ' + m.statusType + '">' + m.statusLabel + '</div>' +
      '</div></div>';

    // Recent metrics (2-col grid)
    html += '<div class="section-label">最近指标</div>';
    html += '<div class="md-metrics-grid">';
    m.metrics.forEach(function(mc) {
      html += '<div class="metric-card"><div class="mc-label">' + mc.label + '</div>' +
        '<div class="mc-row"><span class="mc-val">' + mc.value + '</span>' +
        '<span class="mc-unit ' + (mc.unitType !== 'default' ? mc.unitType : '') + '">' + mc.unit + '</span></div></div>';
    });
    html += '</div>';

    // Current medications
    html += '<div class="section-label">当前用药</div>';
    if (m.medications.length > 0) {
      m.medications.forEach(function(med) {
        html += '<div class="md-med-item">' +
          '<div class="md-med-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#D89575" stroke-width="2"><rect x="3" y="8" width="18" height="8" rx="4"/></svg></div>' +
          '<div class="md-med-info"><div class="md-med-name">' + med.name + '</div>' +
          '<div class="md-med-detail">' + med.detail + '</div></div></div>';
      });
    } else {
      html += '<div class="md-empty">暂无用药记录</div>';
    }
    html += '<div style="margin-bottom:var(--space-xl);"></div>';

    // Health event timeline
    html += '<div class="section-label">健康事件时间线</div>';
    html += '<div class="timeline-container"><div class="timeline-list">';
    m.timeline.forEach(function(t) {
      var dotClass = t.type === 'warn' ? ' warn' : (t.type === 'error' ? ' error' : '');
      html += '<div class="timeline-item">' +
        '<div class="timeline-dot' + dotClass + '"></div>' +
        '<div class="timeline-content">' +
        '<div class="timeline-time">' + t.time + '</div>' +
        '<div class="timeline-title">' + t.title + '</div>' +
        '<div class="timeline-desc">' + t.desc + '</div>' +
        '</div></div>';
    });
    html += '</div></div>';

    document.getElementById('content-member-detail').innerHTML = html;
  }

  /* ========================================
     SCREEN 9: Assess Report
     ======================================== */
  /** 构造报告渲染数据：后端结果优先，否则静态降级 */
  function buildAssessReport() {
    if (assessBackendMode && assessResult) {
      var res = assessResult;
      var score = Number(res.totalScore) || 0;
      var level = score >= 8 ? '良好' : score >= 6 ? '一般' : '需要关注';

      // 维度（雷达图 / 分类得分）
      var dims = Array.isArray(res.radarChart) ? res.radarChart
        : (res.categoryScores ? Object.keys(res.categoryScores).map(function(k) {
            return { category: k, score: res.categoryScores[k] };
          }) : []);
      var dimensions = dims.map(function(d) {
        return { label: d.category, score: Number(d.score) || 0, level: scoreLevel(Number(d.score) || 0) };
      });

      // 风险提示 & 建议（来自 topConcerns）
      var concerns = Array.isArray(res.topConcerns) ? res.topConcerns : [];
      var risks = concerns.map(function(c) { return c.category + '：' + c.suggestion; });
      var suggestions = concerns.map(function(c) {
        return { title: c.category, desc: c.suggestion };
      });

      // 总结（从 fullAnalysis 取首行纯文本）
      var summary = '';
      if (res.fullAnalysis) {
        var lines = res.fullAnalysis.split('\n')
          .map(function(l) { return l.replace(/[#>*`]/g, '').trim(); })
          .filter(Boolean);
        summary = lines.slice(0, 2).join(' ');
      }
      if (!summary) summary = '整体健康自评得分 ' + score.toFixed(1) + ' 分（' + level + '）。';

      return {
        pageTitle: '自评报告',
        score: score.toFixed(1),
        grade: level,
        summary: summary,
        dimensions: dimensions,
        risks: risks.length ? risks : ['暂无显著风险，继续保持健康习惯。'],
        suggestions: suggestions.length ? suggestions : [{ title: '健康建议', desc: '保持规律作息与均衡饮食，适度运动。' }],
        recommendations: [
          { target: 'assess', iconBg: 'rgba(61,138,90,.1)', iconStroke: '#3D8A5A', icon: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', title: '30 天后复评', desc: '跟踪健康状态变化' },
          { target: 'consult', iconBg: 'rgba(208,128,104,.1)', iconStroke: '#D08068', icon: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>', title: '在线健康咨询', desc: '有疑问随时问 AI' },
        ],
      };
    }

    // 静态降级：D.assessReport 仅含 pageTitle，补充离线提示
    var sr = D.assessReport || {};
    return {
      pageTitle: sr.pageTitle || '自评报告',
      score: sr.score || '—',
      grade: sr.grade || '离线模式',
      summary: sr.summary || '本次自评已完成（离线模式，详细评分需联网后查看）。',
      dimensions: sr.dimensions || [],
      risks: sr.risks || ['当前为离线模式，未生成风险分析。'],
      suggestions: sr.suggestions || [{ title: '健康建议', desc: '联网后重新自评以获取个性化建议。' }],
      recommendations: sr.recommendations || [
        { target: 'assess', iconBg: 'rgba(61,138,90,.1)', iconStroke: '#3D8A5A', icon: '<path d="M3 12h4l3-8 4 16 3-8h4"/>', title: '重新自评', desc: '联网后获取评分报告' },
      ],
    };
  }

  function renderAssessReport() {
    var r = buildAssessReport();
    var html = pageHeader(r.pageTitle, true);

    // Score overview card
    html += '<div class="ar-score-card">' +
      '<div class="ar-score-circle">' +
      '<div class="ar-score-val">' + r.score + '</div>' +
      '<div class="ar-score-unit">分</div></div>' +
      '<div class="ar-grade-badge">' + r.grade + '</div>' +
      '<div class="ar-summary">' + r.summary + '</div></div>';

    // Health dimensions
    html += '<div class="section-label">健康维度</div>';
    html += '<div class="card" style="margin-bottom:var(--space-xl);">';
    r.dimensions.forEach(function(d) {
      html += '<div class="dimension-bar">' +
        '<div class="dim-header"><span class="dim-label">' + d.label + '</span>' +
        '<span class="dim-score ' + d.level + '">' + d.score + '</span></div>' +
        '<div class="dim-track"><div class="dim-fill ' + d.level + '" style="width:' + d.score + '%"></div></div></div>';
    });
    html += '</div>';

    // Risk alerts
    html += '<div class="section-label">风险提示</div>';
    html += '<div class="ar-risk-card">' +
      '<div class="ar-risk-title">' + SVG.alert + '温馨提示</div>';
    r.risks.forEach(function(risk) {
      html += '<div class="ar-risk-item">' + risk + '</div>';
    });
    html += '</div>';

    // Health suggestions
    html += '<div class="section-label">健康建议</div>';
    html += '<div class="card" style="margin-bottom:var(--space-xl);">';
    r.suggestions.forEach(function(s, i) {
      html += '<div class="ar-suggestion-item">' +
        '<div class="ar-suggestion-num">' + (i + 1) + '</div>' +
        '<div class="ar-suggestion-content">' +
        '<div class="ar-suggestion-title">' + s.title + '</div>' +
        '<div class="ar-suggestion-desc">' + s.desc + '</div>' +
        '</div></div>';
    });
    html += '</div>';

    // Recommended services
    html += '<div class="section-label">推荐服务</div>';
    r.recommendations.forEach(function(rec) {
      html += '<div class="ar-rec-card" onclick="switchScreen(\'' + rec.target + '\')">' +
        '<div class="ar-rec-icon" style="background:' + rec.iconBg + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="' + rec.iconStroke + '" stroke-width="2">' + rec.icon + '</svg></div>' +
        '<div class="ar-rec-info"><div class="ar-rec-title">' + rec.title + '</div>' +
        '<div class="ar-rec-desc">' + rec.desc + '</div></div>' +
        '<span class="menu-arrow">' + SVG.chevron + '</span></div>';
    });

    // Bottom actions
    html += '<div class="btn-row" style="margin-top:var(--space-xl);">' +
      '<button class="btn-secondary" onclick="switchScreen(\'assess\')">重新自评</button>' +
      '<button class="continue-btn" onclick="completeAssessReport()">完成查看</button></div>';

    document.getElementById('content-assess-report').innerHTML = html;
  }

  function completeAssessReport() {
    showToast('报告已保存');
    setTimeout(function() { switchScreen('home', false); }, 1500);
  }

  /* ========================================
     SCREEN 10: Add Member
     ======================================== */
  function renderAddMember() {
    var a = D.addMember;
    var html = pageHeader(a.pageTitle, true);

    html += '<div class="form-field">' +
      '<label class="form-label">姓名<span class="form-required">*</span></label>' +
      '<input class="form-input" type="text" id="am-name" placeholder="请输入成员姓名" /></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">关系<span class="form-required">*</span></label>' +
      '<div class="tag-group">' +
      a.relations.map(function(r, i) {
        return '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + r + '</span>';
      }).join('') + '</div></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">性别<span class="form-required">*</span></label>' +
      '<div class="tag-group">' +
      a.genders.map(function(g, i) {
        return '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + g + '</span>';
      }).join('') + '</div></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">出生日期</label>' +
      '<input class="form-input" type="date" id="am-birthday" /></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">健康状况</label>' +
      '<div class="tag-group" data-multi="true">' +
      a.healthConditions.map(function(c) {
        return '<span class="tag-pill" onclick="selectTag(this)">' + c + '</span>';
      }).join('') + '</div></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">紧急联系人（选填）</label>' +
      '<input class="form-input" type="text" id="am-emergency" placeholder="请输入联系人姓名和电话" /></div>';

    html += '<button class="continue-btn" onclick="saveAddMember()">保存成员</button>';

    document.getElementById('content-add-member').innerHTML = html;
  }

  function saveAddMember() {
    if (API_MODE !== 'nest') { showToast('未连接到服务器，无法保存'); return; }
    var root = document.getElementById('content-add-member');
    if (!root) return;
    var name = (root.querySelector('#am-name') || {}).value;
    if (!name || !name.trim()) { showToast('请输入成员姓名'); return; }
    var birthday = (root.querySelector('#am-birthday') || {}).value || null;
    var emergency = (root.querySelector('#am-emergency') || {}).value || '';
    function selText(groupIdx) {
      var g = root.querySelectorAll('.tag-group')[groupIdx];
      var el = g && g.querySelector('.tag-pill.selected');
      return el ? el.textContent.trim() : '';
    }
    var relationMap = { '本人': 'self', '配偶': 'spouse', '子女': 'child', '父母': 'parent', '其他': 'other' };
    var relation = relationMap[selText(0)] || 'other';
    var genderMap = { '男': 1, '女': 2, '未知': 0 };
    var gender = genderMap[selText(1)] != null ? genderMap[selText(1)] : 0;
    var conditions = Array.prototype.slice.call(root.querySelectorAll('.tag-group[data-multi="true"] .tag-pill.selected')).map(function(el) { return el.textContent.trim(); });
    if (!activeFamilyId) { showToast('请先创建家庭'); return; }
    showToast('保存中…');
    API.createMember(activeFamilyId, {
      nickname: name.trim(),
      relation: relation,
      gender: gender,
      birthday: birthday,
      emergencyContact: emergency,
      healthConditions: conditions
    }).then(function() {
      showToast('成员添加成功');
      return syncFromBackend();
    }).then(function() {
      renderArchive(); renderHome(); renderMemberDetail();
      setTimeout(function() { goBack(); }, 800);
    }).catch(function(e) {
      showToast('保存失败：' + (e && e.message ? e.message : '请重试'));
    });
  }

  /* ========================================
     SCREEN 11: Add Medication
     ======================================== */
  function renderAddMed() {
    var a = D.addMed;
    var memberNames = (activeMembers && activeMembers.length) ? activeMembers.map(function(m) { return m.nickname || m.relation || '成员'; }) : [];
    var html = pageHeader(a.pageTitle, true);

    html += '<div class="form-field">' +
      '<label class="form-label">用药人<span class="form-required">*</span></label>' +
      '<div class="tag-group">' +
      memberNames.map(function(m, i) {
        return '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + m + '</span>';
      }).join('') + '</div></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">药品名称<span class="form-required">*</span></label>' +
      '<input class="form-input" type="text" id="am-med-name" placeholder="请输入药品名称" /></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">剂量<span class="form-required">*</span></label>' +
      '<input class="form-input" type="text" id="am-dose" placeholder="如：80mg / 1片" /></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">用药频次<span class="form-required">*</span></label>' +
      '<div class="tag-group">' +
      a.frequencies.map(function(f, i) {
        return '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + f + '</span>';
      }).join('') + '</div></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">用药时间</label>' +
      '<input class="form-input" type="time" id="am-time" value="08:00" /></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">服用方式</label>' +
      '<div class="tag-group">' +
      a.methods.map(function(m, i) {
        return '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + m + '</span>';
      }).join('') + '</div></div>';

    html += '<div class="form-field">' +
      '<label class="form-label">备注</label>' +
      '<textarea class="form-textarea" id="am-notes" placeholder="如：饭后半小时服用，避免与牛奶同服"></textarea></div>';

    html += '<div class="settings-item" style="margin-bottom:var(--space-xl);">' +
      '<span class="settings-label">用药提醒</span>' +
      '<div class="toggle-switch active" onclick="this.classList.toggle(\'active\')"></div></div>';

    html += '<button class="continue-btn" onclick="saveAddMed()">保存用药提醒</button>';

    document.getElementById('content-add-med').innerHTML = html;
  }

  function saveAddMed() {
    if (API_MODE !== 'nest') { showToast('未连接到服务器，无法保存'); return; }
    var root = document.getElementById('content-add-med');
    if (!root) return;
    var medicineName = (root.querySelector('#am-med-name') || {}).value;
    if (!medicineName || !medicineName.trim()) { showToast('请输入药品名称'); return; }
    var dose = (root.querySelector('#am-dose') || {}).value || '';
    var time = (root.querySelector('#am-time') || {}).value || '08:00';
    var notes = (root.querySelector('#am-notes') || {}).value || '';
    function selText(groupIdx) {
      var g = root.querySelectorAll('.tag-group')[groupIdx];
      var el = g && g.querySelector('.tag-pill.selected');
      return el ? el.textContent.trim() : '';
    }
    // 用药人：第一个 tag-group（来自 activeMembers）
    var memberTag = root.querySelectorAll('.tag-group')[0];
    var memberName = memberTag && memberTag.querySelector('.tag-pill.selected') ? memberTag.querySelector('.tag-pill.selected').textContent.trim() : '';
    var memberId = null;
    if (activeMembers && activeMembers.length) {
      for (var i = 0; i < activeMembers.length; i++) {
        if ((activeMembers[i].nickname || '') === memberName) { memberId = activeMembers[i].id; break; }
      }
      if (!memberId) memberId = activeMembers[0].id;
    }
    if (!memberId) { showToast('请先添加家庭成员'); return; }
    var freqMap = { '每日一次': 'daily', '每日两次': 'twice_daily', '每日三次': 'three_times', '按需服用': 'custom' };
    var frequency = freqMap[selText(1)] || 'daily';
    var method = selText(2) || '';
    var noteAll = (notes ? notes + '；' : '') + (method ? '服用方式：' + method : '');
    showToast('保存中…');
    API.addMedication({
      memberId: memberId,
      medicineName: medicineName.trim(),
      dosage: dose,
      frequency: frequency,
      startDate: new Date().toISOString().slice(0, 10),
      customSchedule: (frequency === 'custom') ? [{ time: time, dosage: dose, note: noteAll }] : undefined,
      notes: noteAll,
      source: 'manual'
    }).then(function() {
      showToast('用药提醒已添加');
      return syncFromBackend();
    }).then(function() {
      renderHome(); renderMemberDetail();
      setTimeout(function() { goBack(); }, 800);
    }).catch(function(e) {
      showToast('保存失败：' + (e && e.message ? e.message : '请重试'));
    });
  }

  /* ========================================
     SCREEN 12: Record Metric
     ======================================== */
  function renderRecordMetric() {
    var r = D.recordMetric;
    var html = pageHeader(r.pageTitle, true);

    // Metric type selector (2x2 grid)
    html += '<div class="section-label">选择指标类型</div>';
    html += '<div class="rm-type-grid">';
    r.types.forEach(function(t, i) {
      html += '<div class="rm-type-card' + (i === 0 ? ' selected' : '') + '" data-type="' + t.key + '" onclick="selectMetricType(\'' + t.key + '\')">' +
        '<div class="rm-type-icon" style="background:' + t.iconBg + '">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="' + t.iconStroke + '" stroke-width="2" stroke-linecap="round">' + t.icon + '</svg></div>' +
        '<span class="rm-type-label">' + t.label + '</span></div>';
    });
    html += '</div>';

    // Dynamic form area
    html += '<div class="section-label">测量数据</div>';
    html += '<div id="rm-dynamic-form"></div>';

    // Measurer
    html += '<div class="section-label" style="margin-top:var(--space-xl);">测量人</div>';
    html += '<div class="tag-group" style="margin-bottom:var(--space-lg);">';
    r.measurers.forEach(function(m, i) {
      html += '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + m + '</span>';
    });
    html += '</div>';

    // Measurement time
    html += '<div class="form-field">' +
      '<label class="form-label">测量时间</label>' +
      '<input class="form-input" type="datetime-local" /></div>';

    // Notes
    html += '<div class="form-field">' +
      '<label class="form-label">备注（选填）</label>' +
      '<input class="form-input" type="text" placeholder="如：运动后测量" /></div>';

    html += '<button class="continue-btn" onclick="saveRecordMetric()">保存记录</button>';

    document.getElementById('content-record-metric').innerHTML = html;

    // Initialize dynamic form with first type
    window.currentMetricType = r.types[0].key;
    renderMetricForm(r.types[0].key);
  }

  function selectMetricType(key) {
    window.currentMetricType = key;
    document.querySelectorAll('.rm-type-card').forEach(function(el) {
      el.classList.toggle('selected', el.dataset.type === key);
    });
    renderMetricForm(key);
  }

  function renderMetricForm(key) {
    var r = D.recordMetric;
    var html = '';

    if (key === 'bp') {
      // Blood pressure: dual input
      html += '<div class="rm-bp-row">' +
        '<div class="rm-bp-input"><label class="form-label">收缩压</label>' +
        '<div class="rm-input-with-unit"><input class="form-input" type="number" placeholder="120"><span class="rm-unit-suffix">mmHg</span></div></div>' +
        '<span class="rm-bp-sep">/</span>' +
        '<div class="rm-bp-input"><label class="form-label">舒张压</label>' +
        '<div class="rm-input-with-unit"><input class="form-input" type="number" placeholder="80"><span class="rm-unit-suffix">mmHg</span></div></div>' +
        '</div>';
    } else if (key === 'weight') {
      html += '<div class="form-field">' +
        '<label class="form-label">体重</label>' +
        '<div class="rm-input-with-unit"><input class="form-input" type="number" placeholder="65.0"><span class="rm-unit-suffix">kg</span></div></div>';
    } else if (key === 'glucose') {
      html += '<div class="form-field">' +
        '<label class="form-label">血糖值</label>' +
        '<div class="rm-input-with-unit"><input class="form-input" type="number" placeholder="5.6"><span class="rm-unit-suffix">mmol/L</span></div></div>';
      html += '<div class="form-field">' +
        '<label class="form-label">测量类型</label>' +
        '<div class="tag-group">' +
        r.glucoseTypes.map(function(g, i) {
          return '<span class="tag-pill' + (i === 0 ? ' selected' : '') + '" onclick="selectTag(this)">' + g + '</span>';
        }).join('') + '</div></div>';
    } else if (key === 'hr') {
      html += '<div class="form-field">' +
        '<label class="form-label">心率</label>' +
        '<div class="rm-input-with-unit"><input class="form-input" type="number" placeholder="72"><span class="rm-unit-suffix">bpm</span></div></div>';
    }

    var formEl = document.getElementById('rm-dynamic-form');
    if (formEl) formEl.innerHTML = html;
  }

  function saveRecordMetric() {
    if (API_MODE !== 'nest') { showToast('未连接到服务器，无法保存'); return; }
    var memberId = window.primaryMemberId || (activeMembers && activeMembers[0] && activeMembers[0].id);
    if (!memberId) { showToast('请先添加家庭成员'); return; }
    var key = window.currentMetricType || 'bp';
    var formEl = document.getElementById('rm-dynamic-form');
    var calls = [];
    function numVal(sel) { var el = formEl && formEl.querySelector(sel); return el ? parseFloat(el.value) : NaN; }
    if (key === 'bp') {
      var inputs = formEl ? formEl.querySelectorAll('input[type="number"]') : [];
      var s = inputs[0] ? parseFloat(inputs[0].value) : NaN;
      var d = inputs[1] ? parseFloat(inputs[1].value) : NaN;
      if (isNaN(s) || isNaN(d)) { showToast('请输入收缩压和舒张压'); return; }
      calls.push({ memberId: memberId, metricType: 'blood_pressure_systolic', value: s, unit: 'mmHg', inputMethod: 'manual' });
      calls.push({ memberId: memberId, metricType: 'blood_pressure_diastolic', value: d, unit: 'mmHg', inputMethod: 'manual' });
    } else if (key === 'weight') {
      var w = numVal('input');
      if (isNaN(w)) { showToast('请输入体重'); return; }
      calls.push({ memberId: memberId, metricType: 'weight', value: w, unit: 'kg', inputMethod: 'manual' });
    } else if (key === 'glucose') {
      var g = numVal('input');
      if (isNaN(g)) { showToast('请输入血糖值'); return; }
      var gt = formEl ? formEl.querySelector('.tag-group .tag-pill.selected') : null;
      var type = (gt && gt.textContent.indexOf('餐后') >= 0) ? 'blood_glucose_postprandial' : 'blood_glucose_fasting';
      calls.push({ memberId: memberId, metricType: type, value: g, unit: 'mmol/L', inputMethod: 'manual' });
    } else if (key === 'hr') {
      var h = numVal('input');
      if (isNaN(h)) { showToast('请输入心率'); return; }
      calls.push({ memberId: memberId, metricType: 'heart_rate', value: h, unit: 'bpm', inputMethod: 'manual' });
    } else {
      showToast('未知指标类型'); return;
    }
    var notes = (document.getElementById('rm-notes') || {}).value || '';
    var timeVal = (document.getElementById('rm-time') || {}).value || '';
    var recordedAt = timeVal ? new Date(timeVal.replace('T', ' ')).toISOString() : new Date().toISOString();
    showToast('保存中…');
    var chain = Promise.resolve();
    calls.forEach(function(c) {
      c.notes = notes;
      c.recordedAt = recordedAt;
      chain = chain.then(function() { return API.addMetric(c); });
    });
    chain.then(function() {
      showToast('指标记录已保存');
      return syncFromBackend();
    }).then(function() {
      renderHome(); renderMemberDetail();
      setTimeout(function() { goBack(); }, 800);
    }).catch(function(e) {
      showToast('保存失败：' + (e && e.message ? e.message : '请重试'));
    });
  }

  /* ========================================
     SCREEN 13: Settings
     ======================================== */
  function renderSettings() {
    var s = D.settings;
    var html = pageHeader(s.pageTitle, true);

    // Notifications
    html += '<div class="section-label">通知设置</div>';
    html += '<div class="settings-group">';
    s.notifications.forEach(function(n) {
      html += '<div class="settings-item">' +
        '<span class="settings-label">' + n.label + '</span>' +
        '<div class="toggle-switch' + (n.enabled ? ' active' : '') + '" onclick="this.classList.toggle(\'active\')"></div>' +
        '</div>';
    });
    html += '</div>';

    // Privacy
    html += '<div class="section-label">隐私设置</div>';
    html += '<div class="settings-group">';
    s.privacy.forEach(function(p) {
      if (p.type === 'toggle') {
        html += '<div class="settings-item">' +
          '<span class="settings-label">' + p.label + '</span>' +
          '<div class="toggle-switch' + (p.enabled ? ' active' : '') + '" onclick="this.classList.toggle(\'active\')"></div>' +
          '</div>';
      } else {
        html += '<div class="settings-item" onclick="showToast(\'' + p.toast + '\')">' +
          '<span class="settings-label">' + p.label + '</span>' +
          '<span class="menu-arrow">' + SVG.chevron + '</span></div>';
      }
    });
    html += '</div>';

    // Data management
    html += '<div class="section-label">数据管理</div>';
    html += '<div class="settings-group">';
    s.data.forEach(function(d) {
      html += '<div class="settings-item" onclick="showToast(\'' + d.toast + '\')">' +
        '<span class="settings-label">' + d.label + '</span>' +
        (d.value ? '<span class="settings-value">' + d.value + '</span>' : '') +
        '<span class="menu-arrow">' + SVG.chevron + '</span></div>';
    });
    html += '</div>';

    // Account
    html += '<div class="section-label">账号</div>';
    html += '<div class="settings-group">';
    s.account.forEach(function(a) {
      if (a.type === 'logout') {
        // handled separately below
      } else if (a.type === 'value') {
        html += '<div class="settings-item">' +
          '<span class="settings-label">' + a.label + '</span>' +
          '<span class="settings-value">' + a.value + '</span></div>';
      } else {
        html += '<div class="settings-item" onclick="showToast(\'' + a.toast + '\')">' +
          '<span class="settings-label">' + a.label + '</span>' +
          '<span class="menu-arrow">' + SVG.chevron + '</span></div>';
      }
    });
    // Logout button
    s.account.forEach(function(a) {
      if (a.type === 'logout') {
        html += '<button class="btn-secondary danger" data-handler="logout()">' + escapeHtml(a.label) + '</button>';
      }
    });
    html += '</div>';

    // Version
    html += '<div class="settings-version">智医助手 ' + s.version + '</div>';

    document.getElementById('content-settings').innerHTML = html;
  }

  /* ========================================
     SCREEN 14: About
     ======================================== */
  function renderAbout() {
    var a = D.about;
    var html = pageHeader(a.pageTitle, true);

    // Brand header
    html += '<div class="about-brand">' +
      '<div class="about-logo">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M12 2L4 5v6c0 5.5 3.8 10.5 8 12 4.2-1.5 8-6.5 8-12V5l-8-3z"/>' +
      '<path d="M12 8v4M12 16h.01"/>' +
      '</svg></div>' +
      '<div class="about-name">' + a.appName + '</div>' +
      '<div class="about-desc">' + a.appDesc + '</div>' +
      '<div class="about-version">' + a.version + '</div></div>';

    // Product intro
    html += '<div class="section-label">产品介绍</div>';
    html += '<div class="about-intro-card">';
    a.intro.forEach(function(p) {
      html += '<div class="about-intro-text">' + p + '</div>';
    });
    html += '</div>';

    // Disclaimer
    html += '<div class="section-label">免责声明</div>';
    html += '<div class="about-disclaimer-card">' +
      '<div class="about-disclaimer-icon">' + SVG.alert + '</div>' +
      '<div class="about-disclaimer-text">' + a.disclaimer + '</div></div>';

    // Contact
    html += '<div class="section-label">联系我们</div>';
    a.contacts.forEach(function(c) {
      html += '<div class="menu-item" onclick="showToast(\'' + c.toast + '\')">' +
        '<div class="menu-icon" style="background:rgba(61,138,90,.1)">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="#3D8A5A" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg></div>' +
        '<span class="menu-text">' + c.label + '</span>' +
        (c.value ? '<span class="settings-value">' + c.value + '</span>' : '') +
        '<span class="menu-arrow">' + SVG.chevron + '</span></div>';
    });

    // Copyright
    html += '<div class="about-copyright">' + a.copyright + '</div>';

    document.getElementById('content-about').innerHTML = html;
  }

  /* ========================================
     Shared Form Helpers
     ======================================== */
  function selectTag(el) {
    var group = el.parentNode;
    var isMulti = group.dataset.multi === 'true';
    if (isMulti) {
      el.classList.toggle('selected');
    } else {
      if (el.classList.contains('selected')) return;
      group.querySelectorAll('.tag-pill.selected').forEach(function(s) {
        s.classList.remove('selected');
      });
      el.classList.add('selected');
    }
  }

  /* ========================================
     Navigation
     ======================================== */
  function switchScreen(screenKey, pushHistory) {
    if (pushHistory === undefined) pushHistory = true;
    var targetId = 'screen-' + screenKey;
    var targetEl = document.getElementById(targetId);
    if (!targetEl || targetId === currentScreenId) return;

    if (pushHistory) historyStack.push(currentScreenId);

    var currentEl = document.getElementById(currentScreenId);
    var isForward = getScreenOrder(targetId) > getScreenOrder(currentScreenId);

    currentEl.classList.remove('active');
    currentEl.style.transform = isForward ? 'translateX(-30px) scale(.98)' : 'translateX(30px) scale(.98)';

    // Force reflow to ensure transition works correctly
    void targetEl.offsetHeight;
    targetEl.style.transform = isForward ? 'translateX(30px) scale(.98)' : 'translateX(-30px) scale(.98)';
    requestAnimationFrame(function() {
      targetEl.classList.add('active');
      targetEl.style.transform = '';
    });

    currentScreenId = targetId;
    var content = targetEl.querySelector('.content');
    if (content) content.scrollTop = 0;

    // Screen-specific onEnter handlers
    if (targetId === 'screen-assess') {
      // 进入自评：重置状态并从后端拉取第一步题目（含静态降级）
      renderAssess();
    } else if (targetId === 'screen-assess-report') {
      // 进入报告页前用最新数据重渲染（后端结果或静态降级）
      renderAssessReport();
    } else if (targetId === 'screen-consult') {
      // Scroll chat to bottom on entry
      var chatContent = targetEl.querySelector('.content');
      if (chatContent) chatContent.scrollTop = chatContent.scrollHeight;
    } else if (targetId === 'screen-member-detail') {
      renderMemberDetail();
    }
  }

  function switchTab(tabKey) { switchScreen(tabKey); }

  function goBack() {
    if (historyStack.length > 0) {
      var prevId = historyStack.pop();
      switchScreen(prevId.replace('screen-', ''), false);
    } else if (currentScreenId !== 'screen-home') {
      switchScreen('home', false);
    } else {
      showToast('已经是首页了');
    }
  }

  function getScreenOrder(id) {
    return D.screenOrder.indexOf(id) >= 0 ? D.screenOrder.indexOf(id) : 99;
  }

  /* ========================================
     Toast
     ======================================== */
  var toastTimer = null;
  function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2000);
  }

  /* ========================================
     Task Toggle
     ======================================== */
  function toggleTask(el) {
    var check = el.querySelector('.task-check');
    var title = el.querySelector('.task-title');
    var isDone = check.classList.toggle('done');
    title.classList.toggle('done', isDone);
    el.classList.toggle('done', isDone);

    var remaining = document.querySelectorAll('.task-card:not(.done)').length;
    var countEl = document.getElementById('task-count');
    if (countEl) countEl.textContent = remaining + '项待办';
    var statVal = document.getElementById('stat-tasks-val');
    if (statVal) statVal.textContent = remaining + '件';
    if (isDone) showToast('任务已完成');

    // 持久化到后端
    try {
      var tidx = el.getAttribute('data-task-idx');
      if (tidx != null && D.home && Array.isArray(D.home.tasks)) {
        var t = D.home.tasks[Number(tidx)];
        if (t && t.id && window.API && API.updateTask) {
          API.updateTask(t.id, { done: isDone }).catch(function(err) { console.warn('[task] 更新失败', err); });
        }
      }
    } catch (err) { console.warn('[task] 更新失败', err); }
  }

  /* ========================================
     Medication Toggle
     ======================================== */
  function toggleMed(statusEl, event) {
    event.stopPropagation();
    var card = statusEl.closest('.med-card');
    var idx = parseInt(card.dataset.medIdx, 10);
    var med = D.meds.medications[idx];
    med.taken = !med.taken;

    // Re-render just this card
    var newCard = document.createElement('div');
    newCard.innerHTML = renderMedCard(med, idx);
    var rendered = newCard.querySelector('.med-card');
    if (rendered) card.parentNode.replaceChild(rendered, card);

    updateMedProgress();
    showToast(med.taken ? '已标记为已服用' : '已取消标记');

    // 同步到后端（用药依从记录）
    try {
      if (med.planId && window.API && window.API.markMedicationTaken) {
        window.API.markMedicationTaken(
          med.planId,
          med.taken ? 'taken' : 'missed',
          med.scheduledAt,
        ).catch(function() {});
      }
    } catch (e) {}
  }

  function updateMedProgress() {
    var meds = D.meds.medications;
    var total = meds.length;
    var taken = meds.filter(function(m) { return m.taken; }).length;
    var pct = Math.round((taken / total) * 100);
    var medText = document.getElementById('med-progress-text');
    if (medText) medText.textContent = taken + '/' + total;
    var medDesc = document.getElementById('med-progress-desc');
    if (medDesc) medDesc.textContent = '已服用 ' + taken + ' 项，待服用 ' + (total - taken) + ' 项';
    var medBar = document.getElementById('med-progress-bar');
    if (medBar) medBar.style.width = pct + '%';
    // Sync home stats row
    var homeStatVal = document.getElementById('stat-meds-val');
    if (homeStatVal) homeStatVal.textContent = taken + '/' + total;
  }

  /* ========================================
     Chat
     ======================================== */
  var isRecording = false;
  var voiceTimer = null;

  function toggleVoice() {
    var btn = document.getElementById('send-btn');
    isRecording = !isRecording;
    clearTimeout(voiceTimer);
    if (isRecording) {
      btn.classList.add('recording');
      showToast('正在录音...');
      voiceTimer = setTimeout(function() {
        if (isRecording) {
          btn.classList.remove('recording');
          isRecording = false;
          showToast('语音识别完成');
        }
      }, 2500);
    } else {
      btn.classList.remove('recording');
    }
  }

  function handleSendOrVoice() {
    var input = document.getElementById('chat-input');
    if (input && input.value.trim()) {
      sendChat();
    } else {
      toggleVoice();
    }
  }

  function updateChatButton() {
    var input = document.getElementById('chat-input');
    var btn = document.getElementById('send-btn');
    if (!input || !btn) return;
    if (input.value.trim().length > 0) {
      btn.classList.remove('recording');
      isRecording = false;
      btn.innerHTML = SVG.send;
    } else {
      btn.innerHTML = SVG.mic;
    }
  }

  // 解析当前 AI 咨询所需的成员上下文（familyId + memberId）
  // 完全独立：不依赖 syncFromBackend 全局变量。自行完成 token 检查→登录→家庭→成员 解析链路。
  async function ensureMemberContext() {
    // 1）优先使用已同步的全局（最快路径）
    var mid = window.activeConsultMemberId || window.primaryMemberId;
    if (mid && window.activeFamilyId) {
      console.log('[consult] 使用已缓存成员:', mid, '家庭:', window.activeFamilyId);
      return { memberId: mid, familyId: window.activeFamilyId };
    }

    // 2）无缓存 → 独立走完整解析链路
    try {
      // 2a) 确保已登录（账号密码方案：无 token 则弹出登录浮层，不再走微信登录）
      if (!authToken) {
        var ok = await ensureAuthenticated();
        if (!ok) { console.warn('[consult] 未登录，无法初始化咨询'); return null; }
      }

      // 2b) 取家庭列表
      var fams = await API.getFamilies();
      if (!fams) { console.warn('[consult] getFamilies 返回空'); return null; }
      if (!Array.isArray(fams)) {
        if (farms && fams.id) fams = [fams];
        else { console.warn('[consult] 无法识别 families 格式'); return null; }
      }
      if (!fams.length) { console.warn('[consult] 无家庭数据'); return null; }
      var fid = fams[0].id;

      // 2c) 取家庭成员
      var mems = await API.getFamilyMembers(fid);
      if (!mems) { console.warn('[consult] getFamilyMembers 返回空'); return null; }
      if (!Array.isArray(mems)) mems = Array.isArray(mems.members) ? mems.members : [];
      if (!mems.length) { console.warn('[consult] 无成员数据'); return null; }

      // 2d) 匹配登录用户本人节点
      var pm = mems.find(function(m) { return m.userId === authUserId; });
      pm = pm ? pm.id : (mems[0] && mems[0].id);

      // 2e) 回写全局（使后续调用命中缓存路径）
      window.activeFamilyId = fid;
      window.activeMembers = mems;
      window.primaryMemberId = pm;
      console.log('[consult] 独立解析成功:', pm, '| 家庭:', fid, '| 成员数:', mems.length);
      return { memberId: pm, familyId: fid };
    } catch (e) {
      console.warn('[consult] 解析家庭成员上下文失败（后端不可用）', e);
      return null;
    }

  }

  function sendChat() {
    var input = document.getElementById('chat-input');
    var text = input ? input.value.trim() : '';
    if (!text) return;

    var chatArea = document.getElementById('chat-area');
    var content = document.getElementById('content-consult');

    // 用户气泡
    var userMsg = document.createElement('div');
    userMsg.className = 'chat-msg self';
    userMsg.innerHTML = '<div class="chat-avatar" style="background:var(--secondary)">' + (D.user.avatarText || '我') + '</div>' +
      '<div class="chat-bubble">' + escapeHtml(text) + '</div>';
    chatArea.appendChild(userMsg);

    // AI 气泡（流式填充）
    var aiMsg = document.createElement('div');
    aiMsg.className = 'chat-msg';
    aiMsg.innerHTML = '<div class="chat-avatar" style="background:var(--primary)">' + SVG.aiAvatar + '</div>' +
      '<div class="chat-bubble"><span class="streaming-text"></span><span class="stream-cursor">▍</span></div>';
    chatArea.appendChild(aiMsg);
    var aiBubble = aiMsg.querySelector('.chat-bubble');
    var streamText = aiMsg.querySelector('.streaming-text');

    input.value = '';
    if (content) content.scrollTop = content.scrollHeight;
    updateChatButton();

    // 解析咨询成员上下文（优先用已同步的全局；缺失时按需从后端拉取）
    ensureMemberContext().then(function(ctx) {
      if (!ctx || !ctx.memberId || !ctx.familyId) {
        streamText.textContent = '（缺少家庭成员信息，无法发起咨询）';
        var c1 = aiBubble.querySelector('.stream-cursor'); if (c1) c1.remove();
        return;
      }

      // 调用真实后端（SSE 流式）
      var full = '';
      var redLineHit = false;
      API.consultStream(
        { query: text, familyId: ctx.familyId, memberId: ctx.memberId, inputType: 'text' },
        function(event, payload) {
          if (event === 'red_line' && payload.triggered) {
            redLineHit = true;
            var rl = document.createElement('div');
            rl.className = 'chat-msg';
            rl.innerHTML = '<div class="chat-avatar" style="background:#e5484d">' + SVG.alert + '</div>' +
              '<div class="chat-bubble" style="border-left:3px solid #e5484d">' +
              escapeHtml(payload.recommendation || '检测到需要就医的情况，请尽快就医。') + '</div>';
            chatArea.appendChild(rl);
            if (content) content.scrollTop = content.scrollHeight;
          } else if (event === 'chunk') {
            full += (payload.text || '');
            streamText.textContent = full;
            if (content) content.scrollTop = content.scrollHeight;
          } else if (event === 'done') {
            var cur = aiBubble.querySelector('.stream-cursor'); if (cur) cur.remove();
            var tag = document.createElement('div');
            tag.className = 'msg-status-tag';
            tag.innerHTML = '<span class="msg-status-dot"></span> AI · ' + (payload.model || 'nexus-medical');
            aiBubble.appendChild(tag);
            if (content) content.scrollTop = content.scrollHeight;

            // 写回本地缓存，使立即重渲染（如切走再切回）保持一致；后端已持久化
            window.consultCache[ctx.memberId] = window.consultCache[ctx.memberId] || [];
            window.consultCache[ctx.memberId].push({ type: 'user', avatarText: '我', text: text });
            window.consultCache[ctx.memberId].push({
              type: 'ai', avatarColor: 'var(--primary)', text: full,
              statusTag: redLineHit ? '已触发红线' : '暂无风险',
            });
          }
        },
        function() {
          var cur = aiBubble.querySelector('.stream-cursor'); if (cur) cur.remove();
          if (!full) streamText.textContent = '（未收到回复）';
        },
        function() {
          var cur = aiBubble.querySelector('.stream-cursor'); if (cur) cur.remove();
          streamText.textContent = '抱歉，AI 助手暂时不可用，请稍后重试。';
        }
      );
    });
  }

  async function logout() {
    try {
      if (window.API && window.API.logout) await window.API.logout();
      showToast('已退出登录');
    } catch (error) {
      showToast('退出登录失败，请重试');
    }
  }

  /* ========================================
     Utils
     ======================================== */
  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /* ========================================
     Responsive Scaling
     ======================================== */
  function applyScaling() {
    var frame = document.getElementById('phoneFrame');
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var scale = Math.min(vw / 390, vh / 844);
    if (vw <= 450 || vh <= 900) {
      frame.style.transform = 'scale(' + Math.max(scale, .45) + ')';
      frame.style.borderRadius = scale > .7 ? '40px' : '0';
      frame.style.boxShadow = scale > .7 ? '0 0 0 10px #1A1A18, 0 0 0 11px #333, 0 24px 60px rgba(0,0,0,.25)' : 'none';
    } else {
      frame.style.transform = '';
      frame.style.borderRadius = '40px';
      frame.style.boxShadow = '0 0 0 10px #1A1A18, 0 0 0 11px #333, 0 24px 60px rgba(0,0,0,.25)';
    }
  }

  /* ========================================
     Init
     ======================================== */
  async function init() {
    try {
      D = await loadData();

      // Render all status bars
      ['home', 'assess', 'consult', 'archive', 'meds', 'metrics', 'profile', 'assess-report', 'member-detail', 'add-member', 'add-med', 'record-metric', 'settings', 'about'].forEach(function(s) {
        renderStatusBar('sb-' + s);
      });

      // Init tab bars
      initTabBars();

      // Render all screens
      renderHome();
      renderAssess();
      renderConsult();
      renderArchive();
      renderMeds();
      renderMetrics();
      renderProfile();
      renderAssessReport();
      renderMemberDetail();
      renderAddMember();
      renderAddMed();
      renderRecordMetric();
      renderSettings();
      renderAbout();

      // Show home screen
      document.getElementById('screen-home').classList.add('active');

      // 注意：loading 由启动包装器（bootApp）在后端数据同步完成后统一隐藏

      // Scaling
      applyScaling();
      window.addEventListener('resize', applyScaling);

      // Keyboard navigation
      document.addEventListener('keydown', function(e) {
        var tabKeys = D.tabs.map(function(t) { return t.key; });
        var currentKey = currentScreenId.replace('screen-', '');
        var mappedKey = D.tabScreenMap[currentKey] || currentKey;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          var idx = tabKeys.indexOf(mappedKey);
          if (idx >= 0 && idx < tabKeys.length - 1) switchTab(tabKeys[idx + 1]);
          else if (idx === tabKeys.length - 1) switchTab(tabKeys[0]);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          var idx2 = tabKeys.indexOf(mappedKey);
          if (idx2 > 0) switchTab(tabKeys[idx2 - 1]);
          else if (idx2 === 0) switchTab(tabKeys[tabKeys.length - 1]);
        }
      });
    } catch (err) {
      // Error already handled in loadData
      console.error('Init failed:', err);
    }
  }

  /* ========================================
     API Service — 对接 NestJS 真实后端
     ========================================
     默认: NestJS Backend (localhost:3000)
     离线: 无后端时显示「需要连接智医后端」提示，不依赖任何本地静态数据
     ======================================== */
  (function() {
    var runtimeConfig = window.ZHIYI_CONFIG || {};
    var API_BASE = String(runtimeConfig.apiBaseUrl || 'http://127.0.0.1:3000/v1').replace(/\/$/, '');
    var HEALTH_URL = API_BASE.replace(/\/v1$/, '') + '/health';
    var API_MODE = 'auto'; // 'auto' | 'nest' | 'local'

    // ── 认证状态 ──
    var authToken = null;
    var refreshToken = null;
    var refreshPromise = null;
    var authUserId = null;
    var activeFamilyId = null;
    var activeMembers = [];

    // ── API 数据缓存 ──
    var apiCache = {};

    /**
     * 通用 API 请求（自动附加 JWT）
     */
    function applyTokens(payload) {
      authToken = payload && (payload.accessToken || payload.access_token) || null;
      refreshToken = payload && (payload.refreshToken || payload.refresh_token) || refreshToken;
      persistTokens();
    }

    // ── Token 本地持久化（登录态跨刷新保留）──
    function persistTokens() {
      try {
        if (authToken && refreshToken) {
          localStorage.setItem('zhiyi_tokens', JSON.stringify({ accessToken: authToken, refreshToken: refreshToken }));
        }
      } catch (e) { /* localStorage 不可用则仅内存 */ }
    }
    function restoreTokens() {
      try {
        var raw = localStorage.getItem('zhiyi_tokens');
        if (raw) {
          var t = JSON.parse(raw);
          authToken = t.accessToken || null;
          refreshToken = t.refreshToken || null;
        }
      } catch (e) { /* 忽略损坏数据 */ }
    }
    function clearTokens() {
      authToken = null;
      refreshToken = null;
      try { localStorage.removeItem('zhiyi_tokens'); } catch (e) {}
    }

    async function refreshAccessToken() {
      if (!refreshToken) throw new Error('登录状态已失效');
      if (!refreshPromise) {
        refreshPromise = fetch(API_BASE + '/auth/refresh-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: refreshToken }),
        }).then(async function(resp) {
          if (!resp.ok) throw new Error('刷新登录状态失败');
          var payload = await resp.json();
          var data = payload.data || payload;
          applyTokens(data);
          return authToken;
        }).finally(function() { refreshPromise = null; });
      }
      return refreshPromise;
    }

    async function apiFetch(path, options, replayed) {
      options = options || {};
      var headers = { 'Content-Type': 'application/json', 'X-Request-Id': 'proto_' + Date.now() };
      if (authToken) headers.Authorization = 'Bearer ' + authToken;
      Object.assign(headers, options.headers || {});
      var resp;
      try {
        resp = await fetch(API_BASE + path, Object.assign({}, options, { headers: headers }));
      } catch (error) {
        throw new Error('网络请求失败: ' + error.message);
      }
      if (resp.status === 401 && !replayed && path !== '/auth/refresh-token' && refreshToken) {
        await refreshAccessToken();
        return apiFetch(path, options, true);
      }
      if (!resp.ok) {
        var errBody = null;
        try { errBody = await resp.json(); } catch (error) {}
        var message = errBody && (errBody.message || errBody.error) || 'HTTP ' + resp.status;
        var apiError = new Error(String(message));
        apiError.status = resp.status;
        apiError.body = errBody;
        throw apiError;
      }
      if (resp.status === 204) return null;
      var payload = await resp.json();
      return payload.data || payload;
    }

    // ── 数据转换器：NestJS → D 对象格式 ──

    /** 用户信息转换 */
    function transformUser(nestjsUser) {
      var name = nestjsUser.nickname || '晓琳';
      return {
        name: name,
        avatarText: name.charAt(0),
        greeting: getGreeting() + '，' + name,
        greetingSub: '今天家人都还好吗？',
        profileTag: '家庭健康管理师',
        stats: [
          { value: String(activeMembers.length), label: '家庭成员' },
          { value: '28', label: '健康记录' },
          { value: '12', label: '咨询次数' },
        ],
      };
    }

    function getGreeting() {
      var h = new Date().getHours();
      if (h < 9) return '早上好';
      if (h < 12) return '上午好';
      if (h < 14) return '中午好';
      if (h < 18) return '下午好';
      return '晚上好';
    }

    /** 首页数据转换 */
    function transformHome(members) {
      var avatarColors = ['var(--primary)', 'var(--tertiary)', 'var(--secondary)', 'var(--primary)'];
      var familyMembers = members.map(function(m, i) {
        return {
          avatarText: (m.nickname || '?').charAt(0),
          name: m.nickname || m.relation || '成员',
          status: m.relation === 'parent' ? '需关注' : '健康良好',
          statusType: m.relation === 'parent' ? 'warn' : 'ok',
          avatarColor: avatarColors[i % avatarColors.length],
        };
      });
      return {
        healthScore: { label: '家庭健康评分', value: 82, badge: '良好' },
        statsRow: [
          { value: members.length + '人', label: '在管成员', variant: 'default' },
          { value: '0/0', label: '今日用药', variant: 'secondary' },
          { value: '0件', label: '待办事项', variant: 'tertiary' },
        ],
        familyMembers: familyMembers,
        tasks: [
          { title: '开启家庭健康管理之旅', detail: '完成首次健康自评', iconBg: 'rgba(61,138,90,.1)', iconStroke: '#3D8A5A' },
          { title: '完善家庭成员档案', detail: '为每位成员补充健康信息', iconBg: 'rgba(216,149,117,.1)', iconStroke: '#D89575' },
        ],
      };
    }

    /** 档案列表转换 */
    function transformArchive(members) {
      var avatarColors = ['var(--primary)', 'var(--tertiary)', 'var(--secondary)', 'var(--primary)'];
      return {
        members: members.map(function(m, i) {
          return {
            id: m.id,
            avatarText: (m.nickname || '?').charAt(0),
            avatarColor: avatarColors[i % avatarColors.length],
            name: m.nickname + ' · ' + (m.relation || '成员'),
            detail: (m.age ? m.age + '岁' : '') + ' · ' + (m.gender || ''),
            dotColor: avatarColors[i % avatarColors.length],
            memberIdx: i,
          };
        }),
        events: [
          { text: '家庭健康档案已同步', time: '刚刚' },
        ],
      };
    }

    /** 成员详情转换 */
    function transformMemberDetail(member, healthRecord, idx) {
      var statusMap = { parent: '需关注', child: '成长关注', self: '健康良好' };
      var statusTypeMap = { parent: 'warn', child: 'ok', self: 'ok' };
      var relationMap = { parent: '爸爸', mother: '妈妈', spouse: '配偶', child: '孩子', self: '本人' };
      var genderMap = { 1: '男', 2: '女' };
      
      var relationLabel = relationMap[member.relation] || member.relation || '';
      var genderLabel = genderMap[member.gender] || '';
      var avatarColors = ['var(--primary)', 'var(--tertiary)', 'var(--secondary)', 'var(--primary)'];

      var chronicStr = '';
      try { var cd = JSON.parse(healthRecord && healthRecord.chronicDiseases || '[]'); chronicStr = cd.join(' · '); } catch(e) {}

      var metrics = [];
      if (member.age && member.age > 18) {
        metrics.push({ label: '血压', value: '--/--', unit: 'mmHg · 待记录', unitType: 'default' });
      }
      metrics.push({ label: member.age && member.age < 14 ? '身高' : '体重', value: '--', unit: member.age && member.age < 14 ? 'cm · 待记录' : 'kg · 待记录', unitType: 'default' });
      metrics.push({ label: '空腹血糖', value: '--', unit: 'mmol/L · 待记录', unitType: 'default' });

      return {
        name: member.nickname || relationLabel,
        avatarText: (member.nickname || '?').charAt(0),
        avatarColor: avatarColors[Math.min(idx, avatarColors.length - 1)] || 'var(--primary)',
        info: (member.age ? member.age + '岁' : '') + (genderLabel ? ' · ' + genderLabel : '') + (relationLabel ? ' · ' + relationLabel : ''),
        statusLabel: statusMap[member.relation] || '健康',
        statusType: statusTypeMap[member.relation] || 'ok',
        metrics: metrics,
        medications: [],
        timeline: [{ time: new Date().toISOString().slice(0, 10) + ' 09:00', title: '档案建立', desc: '健康档案已创建，请补充更多健康信息', type: 'default' }],
      };
    }

    // ── 指标类型中文标签 ──
    var METRIC_LABELS = {
      blood_pressure_systolic: '收缩压', blood_pressure_diastolic: '舒张压',
      blood_glucose_fasting: '空腹血糖', blood_glucose: '血糖',
      heart_rate: '心率', weight: '体重', height: '身高',
      temperature: '体温', spo2: '血氧', blood_oxygen: '血氧',
      steps: '步数', sleep: '睡眠时长', bmi: 'BMI',
    };
    var FREQ_LABELS = {
      daily: '每日', twice_daily: '每日两次', three_times: '每日三次',
      every_8h: '每8小时', custom: '自定义',
    };

    /** 将 HH:mm 转为今日 ISO 时间 */
    function todayAt(hhmm) {
      try {
        var parts = String(hhmm).split(':');
        var d = new Date();
        d.setHours(Number(parts[0]), Number(parts[1] || 0), 0, 0);
        return d.toISOString();
      } catch (e) { return new Date().toISOString(); }
    }

    /** 由后端趋势序列构建 SVG 折线点 */
    function buildTrend(sys, dia) {
      if (!sys || !sys.series || !sys.series.length) return null;
      var diaSeries = (dia && dia.series) || [];
      function toPoints(series, allMin, allMax) {
        var n = series.length;
        return series.map(function(p, i) {
          var x = n === 1 ? 165 : (i / (n - 1)) * 320 + 5;
          var y = 85 - ((p.value - allMin) / (allMax - allMin || 1)) * 70;
          return Math.round(x) + ',' + Math.round(y);
        }).join(' ');
      }
      var allVals = sys.series.map(function(p) { return p.value; })
        .concat(diaSeries.map(function(p) { return p.value; }));
      var allMin = Math.min.apply(null, allVals);
      var allMax = Math.max.apply(null, allVals);
      return {
        label: '近 7 天趋势',
        systolic: { points: toPoints(sys.series, allMin, allMax), color: 'var(--primary)', label: '收缩压' },
        diastolic: { points: toPoints(diaSeries, allMin, allMax), color: 'var(--tertiary)', label: '舒张压' },
      };
    }

    // ── 离线模式本地模拟：无后端时提供可用的流式咨询回复 ──
    function buildLocalReply(query) {
      var q = (query || '').trim();
      if (!q) return '您好，请问有什么健康方面的疑问？我会尽力提供参考建议。';
      if (/发烧|发热|体温|退烧/.test(q)) {
        return '体温超过 38.5℃ 建议先物理降温、多饮水；若持续高热不退或伴精神萎靡、抽搐，请尽快线下就医。注意补充电解质，避免盲目捂汗。';
      }
      if (/咳嗽|咳痰|嗓子|喉咙|咽痛/.test(q)) {
        return '咳嗽多为呼吸道不适，建议多休息、保持室内湿润、多喝温水。若咳嗽超过两周、痰中带血或伴呼吸困难，请到呼吸科就诊。';
      }
      if (/头痛|头晕|偏头痛/.test(q)) {
        return '短暂头痛可先休息、规律作息、避免强光噪音。若头痛剧烈或伴随视物模糊、肢体无力、言语不清，需警惕脑血管问题，应立即就医。';
      }
      if (/血压|高血压|降压/.test(q)) {
        return '建议每日固定时间测量血压并记录。若收缩压持续 ≥140 或舒张压 ≥90，请遵医嘱调整用药与生活方式，切勿自行停药。';
      }
      if (/吃药|用药|药物|剂量|副作用/.test(q)) {
        return '用药请严格遵医嘱，注意剂量与服药时间。如出现皮疹、恶心、心慌等不适，及时联系医生，切勿自行加量或停药。';
      }
      if (/睡眠|失眠|睡不着|多梦/.test(q)) {
        return '规律作息、睡前减少屏幕使用、避免咖啡因有助改善睡眠。若长期失眠并影响白天状态，建议到睡眠或心理门诊评估。';
      }
      if (/血糖|糖尿病|饮食/.test(q)) {
        return '建议规律进餐、控制精制糖摄入、适度运动并定期监测血糖。如频繁出现心慌、出汗、手抖等低血糖表现，请立即进食并就医。';
      }
      return '根据您描述的情况，建议先观察症状变化、保持休息与饮水、记录症状变化。若症状加重，或出现高危信号（剧烈疼痛、呼吸困难、意识改变、出血不止），请尽快线下就医。本回复为离线演示内容，仅供参考，不构成诊断意见。';
    }

    // 离线模式下模拟 SSE 流式推送，逐块吐字，并保留就医红线检测
    function streamLocalMock(data, onEvent, onDone, onError) {
      var query = (data && data.query) || '';
      // 离线模式同样做就医红线检测，保证急症安全提示可用
      if (/胸痛|胸闷|呼吸困难|窒息|昏迷|抽搐|大出血|出血不止|卒中|中风|心梗/.test(query)) {
        if (onEvent) onEvent('red_line', {
          triggered: true,
          recommendation: '您描述的症状可能属于急症，请立即拨打 120 或前往最近的急诊，切勿延误。',
        });
      }
      var reply = buildLocalReply(query);
      // 按句切分，模拟逐块流式输出
      var chunks = reply.match(/[^。！？]*[。！？]?/g) || [reply];
      var i = 0;
      var timer = setInterval(function() {
        if (i >= chunks.length) {
          clearInterval(timer);
          if (onDone) onDone();
          return;
        }
        var piece = chunks[i++];
        if (piece) {
          if (onEvent) onEvent('chunk', { text: piece });
        }
      }, 260);
      return {
        cancel: function() {
          clearInterval(timer);
          if (onError) onError(new Error('client cancelled'));
        },
      };
    }

    // ── 核心 API 映射（对接 NestJS 后端）──
    var API = {
      healthCheck: async function() {
        try {
          var resp = await fetch(HEALTH_URL);
          return resp.ok;
        } catch(e) { return false; }
      },

      login: async function(code) {
        if (!code) throw new Error('微信登录 code 不能为空');
        var result = await apiFetch('/auth/wechat-login', {
          method: 'POST', body: JSON.stringify({ code: code }),
        });
        applyTokens(result);
        return result;
      },

      smartLogin: function() {
        return new Promise(function(resolve, reject) {
          if (window.__wxjs_environment !== 'miniprogram' || typeof wx === 'undefined' || !wx.login) {
            reject(new Error('当前环境不支持微信登录，生产环境禁止开发身份回退'));
            return;
          }
          wx.login({
            success: function(res) {
              if (!res.code) { reject(new Error('wx.login 未返回 code')); return; }
              API.login(res.code).then(resolve).catch(reject);
            },
            fail: function() { reject(new Error('wx.login 失败')); },
          });
        });
      },

      // Web 账号密码登录（邮箱或手机号 + 密码）
      loginWithPassword: async function(dto) {
        var result = await apiFetch('/auth/login', {
          method: 'POST', body: JSON.stringify({ identifier: dto.identifier, password: dto.password }),
        });
        applyTokens(result);
        return result;
      },

      // Web 账号密码注册
      register: async function(dto) {
        var result = await apiFetch('/auth/register', {
          method: 'POST', body: JSON.stringify({ email: dto.email, password: dto.password, nickname: dto.nickname }),
        });
        applyTokens(result);
        return result;
      },

      logout: async function() {
        try {
          if (refreshToken) {
            await apiFetch('/auth/logout', {
              method: 'POST', body: JSON.stringify({ refreshToken: refreshToken }),
            });
          }
        } finally {
          clearTokens();
          authToken = null;
          refreshToken = null;
          authUserId = null;
          activeFamilyId = null;
          activeMembers = [];
        }
      },

      // 用户
      getMe: function() { return apiFetch('/users/me'); },

      // 家庭
      getFamilies: function() { return apiFetch('/families'); },
      getFamilyMembers: function(familyId) { return apiFetch('/families/' + (familyId || activeFamilyId) + '/members'); },

      // 成员详情
      getMemberDetail: function(memberId) { return apiFetch('/families/' + activeFamilyId + '/members/' + memberId); },
      getHealthRecord: function(memberId) { return apiFetch('/health-records/' + memberId); },

      // 咨询
      getConsultHistory: function(memberId) {
        return apiFetch('/consultations/history?memberId=' + memberId + '&page=1&pageSize=20');
      },
      startConsult: function(data) { return apiFetch('/consultations', { method: 'POST', body: JSON.stringify(data) }); },
      consultStream: function(data, onEvent, onDone, onError) {
        // 离线/本地数据模式：无后端时直接走本地模拟流式回复，避免静默失败
        if (API_MODE === 'local') {
          return streamLocalMock(data, onEvent, onDone, onError);
        }
        var controller = new AbortController();
        var reader = null;
        var stopped = false;
        fetch(API_BASE + '/consultations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + authToken },
          body: JSON.stringify(data),
          signal: controller.signal,
        }).then(async function(resp) {
          if (!resp.ok || !resp.body) throw new Error('Stream HTTP ' + resp.status);
          reader = resp.body.getReader();
          var decoder = new TextDecoder();
          var buffer = '';
          while (!stopped) {
            var result = await reader.read();
            if (result.done) break;
            buffer += decoder.decode(result.value, { stream: true }).replace(/\r\n/g, '\n');
            var blocks = buffer.split('\n\n');
            buffer = blocks.pop() || '';
            blocks.forEach(function(block) {
              var eventName = 'message';
              var dataLines = [];
              block.split('\n').forEach(function(line) {
                if (line.indexOf('event:') === 0) eventName = line.slice(6).trim();
                if (line.indexOf('data:') === 0) dataLines.push(line.slice(5).trimStart());
              });
              if (!dataLines.length) return;
              try {
                var payload = JSON.parse(dataLines.join('\n'));
                if (onEvent) onEvent(eventName, payload);
              } catch (error) {
                if (onError) onError(new Error('SSE JSON 解析失败'));
              }
            });
          }
          if (!stopped && onDone) onDone();
        }).catch(function(error) {
          if (!stopped && error.name !== 'AbortError' && onError) onError(error);
        }).finally(function() {
          if (reader) reader.releaseLock();
        });
        return {
          cancel: function() {
            stopped = true;
            controller.abort();
            if (reader) reader.cancel('client cancelled').catch(function() {});
          },
        };
      },

      // ── 用药管理（真实后端）──
      getMedications: function(memberId, isActive) {
        return apiFetch('/medications?memberId=' + memberId + (isActive !== undefined ? '&isActive=' + isActive : ''));
      },
      getMedicationToday: function(memberId) {
        return apiFetch('/medications/today?memberId=' + memberId);
      },
      markMedicationTaken: function(planId, status, scheduledAt) {
        return apiFetch('/medications/' + planId + '/adherence', {
          method: 'POST',
          body: JSON.stringify({ status: status, scheduledAt: scheduledAt }),
        });
      },

      // ── 健康指标（真实后端）──
      getMetrics: function(memberId, type) {
        var qs = 'memberId=' + memberId;
        if (type) qs += '&type=' + type;
        return apiFetch('/metrics?' + qs);
      },
      getMetricTrend: function(memberId, type, days) {
        return apiFetch('/metrics/trend?memberId=' + memberId + '&type=' + type + '&days=' + (days || 30));
      },

      // ── 通知消息（真实后端）──
      getNotifications: function() { return apiFetch('/notifications?pageSize=50'); },
      getUnreadCount: function() { return apiFetch('/notifications/unread-count'); },
      markNotificationRead: function(id) {
        return apiFetch('/notifications/' + id + '/read', { method: 'POST' });
      },

      // ── 健康知识库（真实后端）──
      getKnowledge: function(category, keyword) {
        var qs = [];
        if (category) qs.push('category=' + category);
        if (keyword) qs.push('keyword=' + encodeURIComponent(keyword));
        return apiFetch('/knowledge' + (qs.length ? '?' + qs.join('&') : ''));
      },
      getKnowledgeCategories: function() { return apiFetch('/knowledge/categories'); },

      // ── 健康报告（真实后端）──
      generateReport: function(memberId) {
        return apiFetch('/reports/generate', { method: 'POST', body: JSON.stringify({ memberId: memberId }) });
      },
      listReports: function(memberId) { return apiFetch('/reports?memberId=' + memberId); },

      // ── 文件上传（真实后端）──
      uploadAvatar: function(file) {
        return new Promise(function(resolve) {
          try {
            var form = new FormData();
            form.append('file', file);
            fetch(API_BASE + '/upload/avatar', {
              method: 'POST',
              headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {},
              body: form,
            }).then(function(r) { return r.json(); }).then(function(j) {
              resolve(j.data || j);
            }).catch(function() { resolve(null); });
          } catch (e) { resolve(null); }
        });
      },

      // 自评 — 题目与结果均来自后端（随机抽题、落库由后端负责）
      startAssessment: function(data) { return apiFetch('/assessments/start', { method: 'POST', body: JSON.stringify(data || {}) }); },
      submitAnswer: function(sessionId, payload) { return apiFetch('/assessments/' + sessionId + '/answer', { method: 'POST', body: JSON.stringify(payload || {}) }); },
      getAssessResult: function(id) { return apiFetch('/assessments/' + id + '/result'); },
      getAssessHistory: function(memberId) { return apiFetch('/assessments/history?memberId=' + memberId); },

      // ── 写操作：全部落到真实后端数据库（不再本地假写）──
      getTasks: function(familyId) { return apiFetch('/tasks?familyId=' + (familyId || activeFamilyId || '')); },
      createTask: function(data) { return apiFetch('/tasks', { method: 'POST', body: JSON.stringify(data) }); },
      createMember: function(familyId, data) { return apiFetch('/families/' + (familyId || activeFamilyId) + '/members', { method: 'POST', body: JSON.stringify(data) }); },
      updateMember: function(memberId, data) { return apiFetch('/families/' + activeFamilyId + '/members/' + memberId, { method: 'PATCH', body: JSON.stringify(data) }); },
      deleteMember: function(memberId) { return apiFetch('/families/' + activeFamilyId + '/members/' + memberId, { method: 'DELETE' }); },
      addMedication: function(data) { return apiFetch('/medications', { method: 'POST', body: JSON.stringify(data) }); },
      addMetric: function(data) { return apiFetch('/metrics', { method: 'POST', body: JSON.stringify(data) }); },
      updateTask: function(taskId, data) { return apiFetch('/tasks/' + taskId, { method: 'PATCH', body: JSON.stringify(data) }); },
      deleteTask: function(taskId) { return apiFetch('/tasks/' + taskId, { method: 'DELETE' }); },
      updateProfile: function(data) { return apiFetch('/users/me', { method: 'PATCH', body: JSON.stringify(data) }); },
      updateHealthRecord: function(memberId, data) { return apiFetch('/health-records/' + memberId, { method: 'PATCH', body: JSON.stringify(data) }); },
    };

    // ── 数据同步：从 NestJS 后端拉取并转换数据 ──
    async function syncFromBackend() {
      console.log('[API] 从 NestJS 后端同步数据...');
      var primaryMemberId = null;

      // Step 1: 认证校验（登录已在启动前置 ensureAuthenticated 完成）
      console.log('[API] Step 1: 校验登录态...');
      if (!authToken) {
        console.warn('[API] 未登录，停止同步');
        return false;
      }
      if (!authUserId) {
        try {
          var authUser = await API.getMe();
          authUserId = authUser.id;
          console.log('[API] 已登录用户: ' + (authUser.nickname || authUser.email) + ' (' + authUserId + ')');
        } catch (e) {
          console.warn('[API] 获取用户信息失败，token 可能已失效', e);
          clearTokens();
          return false;
        }
      } else {
        console.log('[API] 已登录 user=' + authUserId);
      }

      // Step 2: 获取家庭列表
      console.log('[API] Step 2: 获取家庭列表...');
      var families = await API.getFamilies();
      if (!families || !Array.isArray(families) || families.length === 0) {
        // 可能是单个对象（unwrap 后）
        if (families && families.id) families = [families];
        else {
          console.warn('[API] 无家庭数据，创建默认家庭...');
          var created = await apiFetch('/families', { method: 'POST', body: JSON.stringify({ name: '我的家' }) });
          if (created) families = [created];
          else return false;
        }
      }
      activeFamilyId = families[0].id;
      console.log('[API] 家庭: ' + families[0].name + ' (' + activeFamilyId + ')');

      // Step 3: 获取家庭成员
      console.log('[API] Step 3: 获取成员列表...');
      var members = await API.getFamilyMembers(activeFamilyId);
      if (!members) {
        console.warn('[API] 无成员数据');
        return false;
      }
      if (!Array.isArray(members)) members = Array.isArray(members.members) ? members.members : [];
      activeMembers = members;
      console.log('[API] 成员: ' + members.length + ' 人');

      // Step 4: 转换并写入 D
      // 用户
      deepMerge(D, { user: transformUser(authUser) });

      // 首页
      deepMerge(D, { home: transformHome(members) });

      // 档案列表
      deepMerge(D, { archive: transformArchive(members) });

      // 确定主成员（本人）= userId 匹配登录用户，否则取第一个
      primaryMemberId = members.find(function(m) { return m.userId === authUserId; });
      primaryMemberId = primaryMemberId ? primaryMemberId.id : (members[0] && members[0].id);
      window.primaryMemberId = primaryMemberId; // 供 AI 咨询发送使用
      window.activeFamilyId = activeFamilyId;    // 供 AI 咨询发送使用（根因修复：此前未挂全局）
      window.activeMembers = members;            // 供 AI 咨询发送兜底

      // Step 4b: 今日用药提醒 → D.meds
      if (primaryMemberId) {
        try {
          var reminders = await API.getMedicationToday(primaryMemberId);
          if (Array.isArray(reminders) && reminders.length) {
            var takenCount = reminders.filter(function(r) { return r.status === 'taken'; }).length;
            var pct = Math.round((takenCount / reminders.length) * 100);
            D.meds = Object.assign({}, D.meds, {
              summary: { title: '今日用药', taken: takenCount, total: reminders.length },
              medications: reminders.map(function(r) {
                return {
                  planId: r.planId,
                  name: r.medicineName,
                  detail: (r.dosage ? r.dosage + (r.dosageUnit || '') : '') || '按医嘱服用',
                  time: r.time,
                  taken: r.status === 'taken',
                  timeColor: r.status === 'taken' ? 'var(--primary)' : 'var(--tertiary)',
                  scheduledAt: todayAt(r.time),
                };
              }),
              adherence: { label: '用药依从度', percent: pct, desc: pct + '% 已完成' },
            });
          }
        } catch (e) { console.warn('[API] 今日用药加载失败', e); }

        // Step 4c: 健康指标（当前值 + 血压趋势）→ D.metrics
        try {
          var metricRows = await API.getMetrics(primaryMemberId);
          if (Array.isArray(metricRows) && metricRows.length) {
            var byType = {};
            metricRows.forEach(function(m) { byType[m.metricType] = m; });
            var metricList = Object.keys(byType).map(function(t) {
              var m = byType[t];
              return { label: METRIC_LABELS[t] || t, value: m.value, unit: m.unit + ' · 最新', unitType: 'default' };
            });
            if (metricList.length) D.metrics.metrics = metricList;
          }
          var sysTrend = await API.getMetricTrend(primaryMemberId, 'blood_pressure_systolic', 7);
          var diaTrend = await API.getMetricTrend(primaryMemberId, 'blood_pressure_diastolic', 7);
          var trend = buildTrend(sysTrend, diaTrend);
          if (trend) D.metrics.trend = trend;
        } catch (e) { console.warn('[API] 指标加载失败', e); }
      }

      // Step 5: 加载每个成员的详情（异步并行）
      console.log('[API] Step 5: 加载成员详情...');
      var memberDetails = [];
      for (var i = 0; i < members.length; i++) {
        try {
          var detail = await API.getMemberDetail(members[i].id);
          var healthRec = await API.getHealthRecord(members[i].id);
          if (detail) {
            memberDetails.push(transformMemberDetail(detail, healthRec, i));
          }
        } catch(e) {
          console.warn('[API] 成员 ' + members[i].id + ' 详情加载失败');
        }
      }

      // 补充：如果 memberDetails 为空，用简单映射
      if (memberDetails.length === 0) {
        for (var j = 0; j < members.length; j++) {
          memberDetails.push(transformMemberDetail(members[j], null, j));
        }
      }

      deepMerge(D, { memberDetail: { members: memberDetails } });

      // Step 5b: 为每个成员注入真实指标 & 用药（覆盖占位 -- 值）
      try {
        for (var mi = 0; mi < memberDetails.length; mi++) {
          var mem = members[mi];
          if (!mem) continue;
          var mRows = await API.getMetrics(mem.id);
          if (Array.isArray(mRows) && mRows.length) {
            var mt = {};
            mRows.forEach(function(m) { mt[m.metricType] = m; });
            var mlist = Object.keys(mt).map(function(t) {
              var m = mt[t];
              return { label: METRIC_LABELS[t] || t, value: m.value, unit: m.unit, unitType: 'default' };
            });
            if (mlist.length) memberDetails[mi].metrics = mlist;
          }
          var plans = await API.getMedications(mem.id, true);
          if (Array.isArray(plans) && plans.length) {
            memberDetails[mi].medications = plans.map(function(p) {
              return {
                name: p.medicineName,
                detail: [p.dosage ? p.dosage + (p.dosageUnit || '') : '', FREQ_LABELS[p.frequency] || p.frequency, p.notes]
                  .filter(Boolean).join(' · '),
              };
            });
          }
        }
      } catch (e) { console.warn('[API] 成员指标/用药加载失败', e); }

      // Step 6: 预热当前主成员的咨询历史缓存（renderConsult 会动态读取，后端按家庭归属做权限校验）
      if (members.length > 0) {
        var pmId = window.primaryMemberId || members[0].id;
        console.log('[API] Step 6: 预热咨询历史缓存 (' + pmId + ')...');
        await loadConsultHistory(pmId);
      }

      // Step 7: 通知 / 知识库 / 报告
      try {
        var unread = await API.getUnreadCount();
        if (unread && typeof unread.unreadCount === 'number') D.notificationsUnread = unread.unreadCount;
        var notifs = await API.getNotifications();
        if (notifs && Array.isArray(notifs.items)) D.notifications = notifs.items;
      } catch (e) { console.warn('[API] 通知加载失败', e); }

      try {
        var kb = await API.getKnowledge();
        if (kb && Array.isArray(kb.items)) D.knowledge = kb.items;
        var kbc = await API.getKnowledgeCategories();
        if (Array.isArray(kbc)) D.knowledgeCategories = kbc;
      } catch (e) { console.warn('[API] 知识库加载失败', e); }

      try {
        if (primaryMemberId) {
          var reps = await API.listReports(primaryMemberId);
          if (reps && Array.isArray(reps.items)) D.reports = reps.items;
        }
      } catch (e) { console.warn('[API] 报告加载失败', e); }

      // Step 7b: 任务 → D.home.tasks（真实后端数据）
      try {
        var tasks = await API.getTasks();
        if (Array.isArray(tasks)) {
          D.home.tasks = tasks.map(function(t) {
            return { id: t.id, title: t.title || t.content || '任务', done: !!t.done, due: t.dueDate || '' };
          });
        }
      } catch (e) { console.warn('[API] 任务加载失败', e); }

      API_MODE = 'nest';
      return true;
    }

    // ── 连接检测 ──
    async function checkConnection() {
      try {
        var ok = await API.healthCheck();
        if (ok) {
          console.log('[API] NestJS 后端连接成功 ✅ (localhost:3000)');
          return true;
        }
      } catch (e) {}
      console.log('[API] NestJS 后端未启动，使用本地数据模式');
      return false;
    }

    // ── 暴露到全局 ──
    window.API_BASE = API_BASE;
    window.API_MODE = API_MODE;
    window.API = API;
    window.authToken = authToken;
    window.authUserId = authUserId;
    window.activeFamilyId = activeFamilyId;
    window.activeMembers = activeMembers;
    window.syncFromBackend = syncFromBackend;
    window.checkApiConnection = checkConnection;

    // ── Web 账号密码登录/注册门禁 ──
    var AUTH_INPUT_STYLE = 'width:100%;box-sizing:border-box;height:46px;border:1px solid #E3E1DC;border-radius:12px;padding:0 14px;font-size:15px;color:#1A1A18;background:#fff;outline:none;font-family:inherit;';
    var AUTH_BTN_STYLE = 'width:100%;box-sizing:border-box;height:48px;border:none;border-radius:12px;background:#3D8A5A;color:#fff;font-size:16px;font-weight:700;cursor:pointer;font-family:inherit;';
    var AUTH_OVERLAY_HTML =
      '<div style="width:100%;max-width:360px;background:#fff;border-radius:20px;box-shadow:0 10px 40px rgba(0,0,0,.12);padding:28px 22px;box-sizing:border-box;">' +
        '<div style="text-align:center;margin-bottom:18px;">' +
          '<div style="font-size:34px;line-height:1">🩺</div>' +
          '<div style="font-size:20px;font-weight:700;color:#1A1A18;margin-top:8px;">智医助手</div>' +
          '<div style="font-size:12px;color:#8B8B88;margin-top:2px;">AI 家庭健康管理 · 请登录或注册</div>' +
        '</div>' +
        '<div style="display:flex;background:#F5F4F1;border-radius:12px;padding:4px;margin-bottom:18px;">' +
          '<button id="auth-tab-login" type="button" style="flex:1;border:none;background:#3D8A5A;color:#fff;font-weight:600;padding:10px;border-radius:9px;font-size:14px;cursor:pointer;">登录</button>' +
          '<button id="auth-tab-register" type="button" style="flex:1;border:none;background:transparent;color:#5A5A56;font-weight:600;padding:10px;border-radius:9px;font-size:14px;cursor:pointer;">注册</button>' +
        '</div>' +
        '<form id="auth-form-login">' +
          '<input id="login-identifier" type="text" inputmode="email" autocomplete="username" placeholder="邮箱或手机号" style="' + AUTH_INPUT_STYLE + '">' +
          '<input id="login-password" type="password" autocomplete="current-password" placeholder="密码" style="' + AUTH_INPUT_STYLE + 'margin-top:12px;">' +
          '<button type="submit" style="' + AUTH_BTN_STYLE + 'margin-top:16px;">登 录</button>' +
        '</form>' +
        '<form id="auth-form-register" style="display:none">' +
          '<input id="reg-email" type="email" autocomplete="email" placeholder="邮箱（登录账号）" style="' + AUTH_INPUT_STYLE + '">' +
          '<input id="reg-nickname" type="text" placeholder="昵称（可选）" style="' + AUTH_INPUT_STYLE + 'margin-top:12px;">' +
          '<input id="reg-password" type="password" autocomplete="new-password" placeholder="密码（至少 8 位）" style="' + AUTH_INPUT_STYLE + 'margin-top:12px;">' +
          '<input id="reg-confirm" type="password" autocomplete="new-password" placeholder="确认密码" style="' + AUTH_INPUT_STYLE + 'margin-top:12px;">' +
          '<button type="submit" style="' + AUTH_BTN_STYLE + 'margin-top:16px;">注 册</button>' +
        '</form>' +
        '<div id="auth-error" style="color:#C0563F;font-size:12.5px;margin-top:12px;min-height:16px;text-align:center;"></div>' +
      '</div>';

    /** 确保已登录：恢复 localStorage token（并校验），否则弹出登录/注册界面。返回 Promise<boolean>。 */
    function ensureAuthenticated() {
      restoreTokens();
      if (authToken) {
        return API.getMe().then(function(me) {
          authUserId = me.id;
          return true;
        }).catch(function() {
          clearTokens();
          return showAuthOverlay();
        });
      }
      return showAuthOverlay();
    }

    /** 弹出登录/注册浮层；登录或注册成功后 resolve(true)，并隐藏浮层。 */
    function showAuthOverlay() {
      return new Promise(function(resolve) {
        var overlay = document.getElementById('auth-overlay');
        if (!overlay) {
          overlay = document.createElement('div');
          overlay.id = 'auth-overlay';
          overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:#F5F4F1;padding:20px;box-sizing:border-box;font-family:Outfit,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;';
          document.body.appendChild(overlay);
        }
        overlay.style.display = 'flex';
        overlay.innerHTML = AUTH_OVERLAY_HTML;

        var tabLogin = overlay.querySelector('#auth-tab-login');
        var tabReg = overlay.querySelector('#auth-tab-register');
        var formLogin = overlay.querySelector('#auth-form-login');
        var formReg = overlay.querySelector('#auth-form-register');
        var errEl = overlay.querySelector('#auth-error');

        function switchTo(mode) {
          if (mode === 'login') {
            tabLogin.style.background = '#3D8A5A'; tabLogin.style.color = '#fff';
            tabReg.style.background = 'transparent'; tabReg.style.color = '#5A5A56';
            formLogin.style.display = ''; formReg.style.display = 'none';
          } else {
            tabReg.style.background = '#3D8A5A'; tabReg.style.color = '#fff';
            tabLogin.style.background = 'transparent'; tabLogin.style.color = '#5A5A56';
            formLogin.style.display = 'none'; formReg.style.display = '';
          }
          errEl.textContent = '';
        }
        tabLogin.onclick = function() { switchTo('login'); };
        tabReg.onclick = function() { switchTo('register'); };

        formLogin.addEventListener('submit', async function(e) {
          e.preventDefault();
          errEl.textContent = '';
          var identifier = formLogin.querySelector('#login-identifier').value.trim();
          var password = formLogin.querySelector('#login-password').value;
          if (!identifier || !password) { errEl.textContent = '请输入账号和密码'; return; }
          try {
            var r = await API.loginWithPassword({ identifier: identifier, password: password });
            authUserId = r.user.id;
            overlay.style.display = 'none';
            resolve(true);
          } catch (err) {
            errEl.textContent = (err && err.message) ? err.message : '登录失败，请重试';
          }
        });

        formReg.addEventListener('submit', async function(e) {
          e.preventDefault();
          errEl.textContent = '';
          var email = formReg.querySelector('#reg-email').value.trim();
          var pwd = formReg.querySelector('#reg-password').value;
          var pwd2 = formReg.querySelector('#reg-confirm').value;
          var nickname = formReg.querySelector('#reg-nickname').value.trim();
          if (!email || !pwd) { errEl.textContent = '请输入邮箱和密码'; return; }
          if (pwd.length < 8) { errEl.textContent = '密码至少 8 位'; return; }
          if (pwd !== pwd2) { errEl.textContent = '两次输入的密码不一致'; return; }
          try {
            var r = await API.register({ email: email, password: pwd, nickname: nickname || undefined });
            authUserId = r.user.id;
            overlay.style.display = 'none';
            resolve(true);
          } catch (err) {
            errEl.textContent = (err && err.message) ? err.message : '注册失败，请重试';
          }
        });
      });
    }

    // ── 注入到 init 流程 ──
    var _originalInit = init;
    init = async function() {
      var hasApi = false;
      try {
        // Step 1: 加载内置 UI 默认配置（不再依赖本地静态数据文件）
        await _originalInit();

        // Step 2: 尝试对接 NestJS 后端，用真实数据覆盖 D
        hasApi = await checkConnection();

        if (hasApi) {
          console.log('[API] 模式: NestJS Backend (localhost:3000)');
          // 前置鉴权：恢复 localStorage token 或弹出登录/注册界面
          var authed = await ensureAuthenticated();
          if (authed) {
            var synced = await syncFromBackend();
            if (synced) {
              // 用真实数据重渲染动态页面
              renderHome();
              renderConsult();
              renderArchive();
              renderProfile();
              renderMemberDetail();
              renderMeds();
              renderMetrics();
            } else {
              API_MODE = 'local';
            }
          } else {
            API_MODE = 'local';
          }
        } else {
          console.log('[API] 模式: 离线（无后端，提示连接）');
          API_MODE = 'local';
        }

        // 连接状态指示器
        var indicator = document.getElementById('api-indicator');
        if (!indicator) {
          indicator = document.createElement('div');
          indicator.id = 'api-indicator';
          indicator.style.cssText = 'position:fixed;bottom:8px;left:50%;transform:translateX(-50%);' +
            'background:' + (hasApi && API_MODE === 'nest' ? '#3D8A5A' : '#D08068') + ';color:#fff;font-size:11px;' +
            'padding:4px 12px;border-radius:20px;z-index:9999;opacity:0.85;' +
            'font-family:Outfit,-apple-system,sans-serif;letter-spacing:.5px;';
          document.body.appendChild(indicator);
        }
        var indicatorText = (hasApi && API_MODE === 'nest') ? 'API: NestJS ✓' : 'API: Local Data';
        if (hasApi && API_MODE === 'nest' && D.notificationsUnread > 0) {
          indicatorText += ' · ' + D.notificationsUnread + ' 条未读';
        }
        indicator.textContent = indicatorText;

        // 启动状态栏实时刷新（时钟 + 电量）
        initStatusBar();
        indicator.style.background = (hasApi && API_MODE === 'nest') ? '#3D8A5A' : '#D08068';
      } catch (err) {
        console.error('[API] 初始化流程异常，降级为离线模式', err);
        hasApi = false;
        API_MODE = 'local';
      } finally {
        // 无论成功/失败，都不再卡在“正在加载数据…”
        hideLoadingScreen();
        // 后端不可用时显示离线提示（数据全部来自后端，无后端则无法使用）
        if (!hasApi || API_MODE !== 'nest') {
          showOfflineNotice();
        }
      }
    };

    // ── 加载屏 / 离线提示控制 ──
    function hideLoadingScreen() {
      var ls = document.getElementById('loadingScreen');
      if (ls) ls.style.display = 'none';
    }
    function showOfflineNotice() {
      if (document.getElementById('offline-notice')) return;
      var notice = document.createElement('div');
      notice.id = 'offline-notice';
      notice.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;z-index:5000;padding:24px;text-align:center;';
      notice.innerHTML =
        '<div style="max-width:280px">' +
        '<div style="font-size:40px;margin-bottom:12px">🩺</div>' +
        '<div style="font-size:17px;font-weight:600;color:#1A1A18;margin-bottom:8px">需要连接智医后端</div>' +
        '<div style="font-size:13px;color:#8B8B88;line-height:1.6;margin-bottom:20px">本应用的所有数据均通过 NestJS 后端（localhost:3000）读写。请先启动后端服务，再点击下方按钮重试。</div>' +
        '<button onclick="window.__retryBackend && window.__retryBackend()" style="background:#3D8A5A;color:#fff;border:none;border-radius:24px;padding:10px 28px;font-size:14px;font-weight:600">重新连接</button>' +
        '</div>';
      document.body.appendChild(notice);
    }
    window.__retryBackend = async function() {
      var n = document.getElementById('offline-notice');
      if (n) n.remove();
      var ls = document.getElementById('loadingScreen');
      if (ls) {
        ls.style.display = 'flex';
        var lt = ls.querySelector('.loading-text');
        if (lt) lt.textContent = '正在重新连接…';
      }
      await init();
    };
  })();

  init();

  document.addEventListener('click', function(event) {
    var target = event.target.closest('[data-handler]');
    if (!target) return;
    var handler = target.getAttribute('data-handler') || '';
    var match = handler.match(/^([A-Za-z_$][\w$]*)\((.*)\)$/);
    if (!match) return;
    var allowed = {
      switchTab: switchTab, switchScreen: switchScreen, goBack: goBack,
      openMemberDetail: openMemberDetail, toggleTask: toggleTask,
      toggleOption: toggleOption, assessNext: assessNext, selectMember: selectMember,
      toggleMed: toggleMed, handleSendOrVoice: handleSendOrVoice,
      openModal: openModal, closeModal: closeModal, logout: logout,
        saveProfile: function(d) { return API.updateProfile(d); },
        savePassword: function() { showToast('修改密码功能即将上线'); },
        sendChat: sendChat,
        submitMetric: function(m) { return API.addMetric(m); },
        addMedication: function(d) { return API.addMedication(d); }
    };
    var fn = allowed[match[1]];
    if (!fn) return;
    var raw = match[2].trim();
    var args = [];
    if (raw) {
      args = raw.split(',').map(function(value) {
        value = value.trim();
        if (value === 'this') return target;
        if (value === 'event') return event;
        if (/^-?\d+$/.test(value)) return Number(value);
        var quoted = value.match(/^['"]([\s\S]*)['"]$/);
        return quoted ? quoted[1] : value;
      });
    }
    fn.apply(window, args);
  });
