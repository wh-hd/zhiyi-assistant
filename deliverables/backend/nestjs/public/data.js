/**
 * 智医助手 — 静态配置数据（file:// 双击打开兼容层）
 * 与 data.json 内容一致，仅用于 file:// 协议降级
 */
window.APP_DATA = {
  "app": {
    "name": "智医助手",
    "subtitle": "AI 家庭健康管理",
    "statusBarTime": "9:41"
  },
  "tabs": [
    {
      "key": "home",
      "label": "首页",
      "icon": "<path d=\"M3 12L12 4L21 12V20C21 20.5 20.5 21 20 21H15V14H9V21H4C3.5 21 3 20.5 3 20V12Z\" stroke-linejoin=\"round\"/>"
    },
    {
      "key": "consult",
      "label": "咨询",
      "icon": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01\" stroke-linecap=\"round\"/>"
    },
    {
      "key": "archive",
      "label": "档案",
      "icon": "<path d=\"M3 7V19C3 20 4 21 5 21H19C20 21 21 20 21 19V7\" stroke-linejoin=\"round\"/><path d=\"M3 7L5 3H19L21 7\" stroke-linejoin=\"round\"/><path d=\"M9 11H15\"/>"
    },
    {
      "key": "profile",
      "label": "我的",
      "icon": "<circle cx=\"12\" cy=\"8\" r=\"4\"/><path d=\"M4 21C4 17 7.5 14 12 14C16.5 14 20 17 20 21\" stroke-linecap=\"round\"/>"
    }
  ],
  "tabScreenMap": {
    "home": "home",
    "consult": "consult",
    "archive": "archive",
    "profile": "profile",
    "assess": "home",
    "meds": "home",
    "metrics": "home",
    "assess-report": "home",
    "member-detail": "archive",
    "add-member": "archive",
    "add-med": "home",
    "record-metric": "home",
    "settings": "profile",
    "about": "profile"
  },
  "screenOrder": [
    "screen-home",
    "screen-assess",
    "screen-assess-report",
    "screen-consult",
    "screen-archive",
    "screen-member-detail",
    "screen-add-member",
    "screen-meds",
    "screen-add-med",
    "screen-metrics",
    "screen-record-metric",
    "screen-profile",
    "screen-settings",
    "screen-about"
  ],
  "assessment": {
    "pageTitle": "家庭健康自评",
    "estimatedTime": "约需 30 秒",
    "initialIndex": 2,
    "questions": [
      {
        "q": "你最担心家人的哪些健康问题？",
        "sub": "可多选",
        "options": [
          "儿童成长发育",
          "老人日常照护",
          "心理健康情绪",
          "慢性病管理"
        ]
      },
      {
        "q": "家人目前有哪些慢性病管理需求？",
        "sub": "可多选",
        "options": [
          "高血压管理",
          "糖尿病管理",
          "高血脂管理",
          "暂无慢性病"
        ]
      },
      {
        "q": "你最希望获得哪些健康服务？",
        "sub": "可多选",
        "options": [
          "定期健康提醒",
          "家庭健康报告",
          "在线健康咨询",
          "就医绿色通道"
        ]
      },
      {
        "q": "你认为家庭健康管理最大的困难是什么？",
        "sub": "可多选",
        "options": [
          "信息不统一",
          "坚持困难",
          "缺乏专业指导",
          "时间精力不足"
        ]
      }
    ],
    "initialSelected": [
      2
    ]
  },
  "addMember": {
    "pageTitle": "添加成员",
    "relations": [
      "爸爸",
      "妈妈",
      "配偶",
      "儿子",
      "女儿",
      "其他"
    ],
    "genders": [
      "男",
      "女"
    ],
    "healthConditions": [
      "高血压",
      "糖尿病",
      "高血脂",
      "心脏病",
      "无慢性病"
    ]
  },
  "addMed": {
    "pageTitle": "添加用药",
    "members": [
      "爸爸",
      "妈妈",
      "儿子"
    ],
    "frequencies": [
      "每日一次",
      "每日两次",
      "每日三次",
      "按需服用"
    ],
    "methods": [
      "饭前",
      "饭后",
      "睡前",
      "随时"
    ]
  },
  "recordMetric": {
    "pageTitle": "记录指标",
    "types": [
      {
        "key": "bp",
        "label": "血压",
        "iconBg": "rgba(208,128,104,.1)",
        "iconStroke": "#D08068",
        "icon": "<path d=\"M3 12h4l3-8 4 16 3-8h4\"/>"
      },
      {
        "key": "weight",
        "label": "体重",
        "iconBg": "rgba(216,149,117,.1)",
        "iconStroke": "#D89575",
        "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>"
      },
      {
        "key": "glucose",
        "label": "血糖",
        "iconBg": "rgba(212,166,74,.1)",
        "iconStroke": "#D4A64A",
        "icon": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 7v5l3 2\"/>"
      },
      {
        "key": "hr",
        "label": "心率",
        "iconBg": "rgba(61,138,90,.1)",
        "iconStroke": "#3D8A5A",
        "icon": "<path d=\"M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z\"/>"
      }
    ],
    "measurers": [
      "爸爸",
      "妈妈",
      "儿子"
    ],
    "glucoseTypes": [
      "空腹",
      "餐后2小时"
    ]
  },
  "settings": {
    "pageTitle": "设置",
    "notifications": [
      {
        "label": "用药提醒通知",
        "enabled": true
      },
      {
        "label": "健康任务通知",
        "enabled": true
      },
      {
        "label": "健康报告推送",
        "enabled": false
      }
    ],
    "privacy": [
      {
        "label": "健康数据授权管理",
        "type": "arrow",
        "toast": "授权管理功能开发中"
      },
      {
        "label": "匿名化数据分享",
        "type": "toggle",
        "enabled": false
      }
    ],
    "data": [
      {
        "label": "导出健康数据",
        "type": "arrow",
        "toast": "数据导出功能开发中"
      },
      {
        "label": "清除本地缓存",
        "type": "arrow",
        "value": "23.5MB",
        "toast": "缓存已清除"
      }
    ],
    "account": [
      {
        "label": "修改密码",
        "type": "arrow",
        "toast": "修改密码功能开发中"
      },
      {
        "label": "微信绑定",
        "type": "value",
        "value": "已绑定"
      },
      {
        "label": "退出登录",
        "type": "logout"
      }
    ],
    "version": "v1.0.0"
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
      {
        "label": "客服邮箱",
        "value": "support@zhiyi.health",
        "toast": "客服邮箱已复制"
      },
      {
        "label": "官方网站",
        "value": "www.zhiyi.health",
        "toast": "官方网站已复制"
      },
      {
        "label": "用户协议",
        "value": "",
        "toast": "用户协议"
      }
    ],
    "copyright": "© 2024 智医助手 保留所有权利"
  },
  "home": {
    "quickActions": [
      {
        "label": "AI 咨询",
        "target": "consult",
        "bgColor": "rgba(61,138,90,.1)",
        "strokeColor": "#3D8A5A",
        "icon": "<path d=\"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z\"/>"
      },
      {
        "label": "用药提醒",
        "target": "meds",
        "bgColor": "rgba(216,149,117,.1)",
        "strokeColor": "#D89575",
        "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/><circle cx=\"8\" cy=\"12\" r=\"1.5\" fill=\"#D89575\"/><line x1=\"12\" y1=\"10\" x2=\"12\" y2=\"14\"/>"
      },
      {
        "label": "指标记录",
        "target": "metrics",
        "bgColor": "rgba(208,128,104,.1)",
        "strokeColor": "#D08068",
        "icon": "<path d=\"M3 12h4l3-8 4 16 3-8h4\"/>"
      },
      {
        "label": "健康自评",
        "target": "assess",
        "bgColor": "rgba(212,166,74,.1)",
        "strokeColor": "#D4A64A",
        "icon": "<path d=\"M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4\"/>"
      }
    ]
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
    "summary": {
      "title": "家庭健康概览",
      "desc": "3位成员 · 档案完整度 85% · 2项待跟进"
    }
  },
  "meds": {
    "pageTitle": "用药提醒",
    "summary": {
      "title": "今日用药进度",
      "taken": 3,
      "total": 4
    }
  },
  "metrics": {
    "pageTitle": "健康指标",
    "currentLabel": "当前指标",
    "recordsLabel": "最近记录"
  },
  "profile": {
    "pageTitle": "我的",
    "menuItems": [
      {
        "text": "家庭健康档案",
        "action": "screen:archive",
        "iconBg": "rgba(61,138,90,.1)",
        "iconStroke": "#3D8A5A",
        "icon": "<path d=\"M3 7V19a2 2 0 002 2h14a2 2 0 002-2V7M3 7L5 3h14l2 4M9 11h6\"/>"
      },
      {
        "text": "健康自评记录",
        "action": "screen:assess",
        "iconBg": "rgba(212,166,74,.1)",
        "iconStroke": "#D4A64A",
        "icon": "<rect x=\"5\" y=\"3\" width=\"14\" height=\"18\" rx=\"2\"/><path d=\"M9 8h6M9 12h6M9 16h4\"/>"
      },
      {
        "text": "用药管理",
        "action": "screen:meds",
        "iconBg": "rgba(216,149,117,.1)",
        "iconStroke": "#D89575",
        "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>"
      },
      {
        "text": "设置",
        "action": "screen:settings",
        "iconBg": "rgba(139,139,136,.1)",
        "iconStroke": "#8B8B88",
        "icon": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.4 1a7 7 0 00-2.5-1.4L14 3h-4l-.1 2.5a7 7 0 00-2.5 1.4l-2.4-1-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.4-1a7 7 0 002.5 1.4L10 21h4l.1-2.5a7 7 0 002.5-1.4l2.4 1 2-3.4-2-1.5c0-.4.1-.9.1-1.3z\"/>"
      },
      {
        "text": "关于我们",
        "action": "screen:about",
        "iconBg": "rgba(61,138,90,.1)",
        "iconStroke": "#3D8A5A",
        "icon": "<circle cx=\"12\" cy=\"12\" r=\"10\"/><path d=\"M12 16v-4M12 8h.01\"/>"
      }
    ]
  },
  "memberDetail": {
    "pageTitle": "健康档案"
  },
  "assessReport": {
    "pageTitle": "自评报告"
  }
};
