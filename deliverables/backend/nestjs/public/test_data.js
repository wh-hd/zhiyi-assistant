/**
 * 智医助手 — 模拟后端返回数据（test data）
 * 后端开发完成后删除此文件，改用真实 API 返回数据
 */
window.TEST_DATA = {
  "user": {
    "name": "晓琳",
    "avatarText": "晓",
    "greeting": "早上好，晓琳",
    "greetingSub": "今天家人都还好吗？",
    "profileTag": "家庭健康管理师",
    "stats": [
      {
        "value": "3",
        "label": "家庭成员"
      },
      {
        "value": "28",
        "label": "健康记录"
      },
      {
        "value": "12",
        "label": "咨询次数"
      }
    ]
  },
  "home": {
    "healthScore": {
      "label": "家庭健康评分",
      "value": 82,
      "badge": "良好"
    },
    "statsRow": [
      {
        "value": "4人",
        "label": "在管成员",
        "variant": "default"
      },
      {
        "value": "3/4",
        "label": "今日用药",
        "variant": "secondary"
      },
      {
        "value": "2件",
        "label": "待办事项",
        "variant": "tertiary"
      }
    ],
    "familyMembers": [
      {
        "avatarText": "爸",
        "name": "爸爸",
        "status": "血压偏高",
        "statusType": "warn",
        "avatarColor": "var(--primary)"
      },
      {
        "avatarText": "妈",
        "name": "妈妈",
        "status": "健康良好",
        "statusType": "ok",
        "avatarColor": "var(--tertiary)"
      },
      {
        "avatarText": "宝",
        "name": "宝宝",
        "status": "1岁·健康",
        "statusType": "ok",
        "avatarColor": "var(--secondary)"
      }
    ],
    "tasks": [
      {
        "title": "提醒爸爸测量血压",
        "detail": "08:00 · 已设置闹钟",
        "iconBg": "rgba(208,128,104,.1)",
        "iconStroke": "#D08068",
        "icon": "<path d=\"M3 12h4l3-8 4 16 3-8h4\"/>"
      },
      {
        "title": "妈妈服用维生素D",
        "detail": "09:00 · 随早餐服用",
        "iconBg": "rgba(216,149,117,.1)",
        "iconStroke": "#D89575",
        "icon": "<rect x=\"3\" y=\"8\" width=\"18\" height=\"8\" rx=\"4\"/>"
      }
    ]
  },
  "consult": {
    "messages": [
      {
        "type": "ai",
        "avatarColor": "var(--primary)",
        "avatarIcon": "<path d=\"M12 2a3 3 0 00-3 3v1H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-2V5a3 3 0 00-3-3zM10 5a2 2 0 114 0v1h-4V5z\"/>",
        "text": "您好！我是智医助手AI。请描述您或家人的健康问题，我会为您提供健康咨询建议。"
      },
      {
        "type": "user",
        "avatarColor": "var(--secondary)",
        "avatarText": "我",
        "text": "我爸爸今早上血压150/95，头有点晕，需要马上去医院吗？"
      },
      {
        "type": "ai",
        "avatarColor": "var(--primary)",
        "avatarIcon": "<path d=\"M12 2a3 3 0 00-3 3v1H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2h-2V5a3 3 0 00-3-3zM10 5a2 2 0 114 0v1h-4V5z\"/>",
        "text": "根据您描述的症状，血压150/95属于轻度偏高，头晕可能是血压波动引起的。建议：先在家休息观察30分钟，保持安静环境。若头晕持续或血压超过160/100，请及时就医。",
        "statusTag": "暂无风险"
      }
    ]
  },
  "archive": {
    "members": [
      {
        "avatarText": "张",
        "avatarColor": "var(--primary)",
        "name": "张明 · 爸爸",
        "detail": "48岁 · 高血压 · 定期复查中",
        "dotColor": "var(--primary)",
        "action": "screen:member-detail",
        "memberIdx": 0
      },
      {
        "avatarText": "李",
        "avatarColor": "var(--tertiary)",
        "name": "李芳 · 妈妈",
        "detail": "45岁 · 健康状态良好",
        "dotColor": "var(--primary)",
        "action": "screen:member-detail",
        "memberIdx": 1
      },
      {
        "avatarText": "明",
        "avatarColor": "var(--secondary)",
        "name": "张小明 · 儿子",
        "detail": "12岁 · 生长发育期 · 关注营养",
        "dotColor": "var(--tertiary)",
        "action": "screen:member-detail",
        "memberIdx": 2
      }
    ],
    "events": [
      {
        "text": "张明完成血压测量 128/85",
        "time": "2小时前"
      },
      {
        "text": "张小明体重记录 42kg",
        "time": "昨天"
      }
    ]
  },
  "meds": {
    "medications": [
      {
        "time": "08:00",
        "timeColor": "var(--primary)",
        "name": "缬沙坦 80mg",
        "detail": "张明 · 降压药 · 每日一次",
        "taken": true
      },
      {
        "time": "12:30",
        "timeColor": "var(--primary)",
        "name": "二甲双胍 500mg",
        "detail": "张明 · 降糖药 · 饭后服用",
        "taken": true
      },
      {
        "time": "20:00",
        "timeColor": "var(--tertiary)",
        "name": "阿托伐他汀 20mg",
        "detail": "张明 · 降脂药 · 晚餐后服用",
        "taken": false
      },
      {
        "time": "09:00",
        "timeColor": "var(--primary)",
        "name": "维生素 D 软胶囊",
        "detail": "李芳 · 补充剂 · 随早餐服用",
        "taken": true
      }
    ],
    "adherence": {
      "label": "本周服药依从性",
      "percent": "85%",
      "desc": "本周共28次，已服用24次，漏服4次"
    }
  },
  "metrics": {
    "metrics": [
      {
        "label": "血压（收缩压/舒张压）",
        "value": "128 / 85",
        "unit": "mmHg · 正常偏高",
        "unitType": "warn"
      },
      {
        "label": "体重",
        "value": "65.2",
        "unit": "kg · BMI 23.1",
        "unitType": "default"
      },
      {
        "label": "空腹血糖",
        "value": "5.6",
        "unit": "mmol/L · 正常范围",
        "unitType": "ok"
      },
      {
        "label": "静息心率",
        "value": "72",
        "unit": "bpm · 正常",
        "unitType": "ok"
      }
    ],
    "trend": {
      "label": "血压趋势（近7天）",
      "systolic": {
        "color": "#3D8A5A",
        "label": "收缩压",
        "points": "0,65 47,58 94,62 141,52 188,56 235,48 282,53 330,50"
      },
      "diastolic": {
        "color": "#D89575",
        "label": "舒张压",
        "points": "0,82 47,76 94,79 141,72 188,75 235,68 282,73 330,70"
      }
    },
    "records": [
      {
        "text": "血压 128/85 mmHg · 张明",
        "time": "今天 09:00"
      },
      {
        "text": "体重 65.2 kg · 张明",
        "time": "昨天 08:30"
      }
    ]
  },
  "memberDetail": {
    "members": [
      {
        "name": "张明",
        "avatarText": "张",
        "avatarColor": "var(--primary)",
        "info": "48岁 · 男 · 爸爸",
        "statusLabel": "需关注",
        "statusType": "warn",
        "metrics": [
          {
            "label": "血压",
            "value": "128/85",
            "unit": "mmHg · 正常偏高",
            "unitType": "warn"
          },
          {
            "label": "体重",
            "value": "72.5",
            "unit": "kg · BMI 23.8",
            "unitType": "default"
          },
          {
            "label": "空腹血糖",
            "value": "5.8",
            "unit": "mmol/L · 正常",
            "unitType": "ok"
          },
          {
            "label": "静息心率",
            "value": "76",
            "unit": "bpm · 正常",
            "unitType": "ok"
          }
        ],
        "medications": [
          {
            "name": "缬沙坦 80mg",
            "detail": "降压药 · 每日一次 · 08:00"
          },
          {
            "name": "二甲双胍 500mg",
            "detail": "降糖药 · 每日两次 · 12:30 / 19:00"
          }
        ],
        "timeline": [
          {
            "time": "2026-07-08 09:00",
            "title": "血压记录",
            "desc": "收缩压 128 / 舒张压 85 mmHg — 正常偏高，建议持续监测",
            "type": "warn"
          },
          {
            "time": "2026-07-07 14:00",
            "title": "血糖记录",
            "desc": "空腹血糖 5.8 mmol/L — 正常范围",
            "type": "default"
          },
          {
            "time": "2026-07-05 10:00",
            "title": "医院复诊",
            "desc": "高血压定期复查，医生建议继续服药并保持低盐饮食",
            "type": "default"
          },
          {
            "time": "2026-07-01 08:00",
            "title": "用药调整",
            "desc": "缬沙坦剂量由 40mg 调整为 80mg · 每日一次",
            "type": "warn"
          }
        ]
      },
      {
        "name": "李芳",
        "avatarText": "李",
        "avatarColor": "var(--tertiary)",
        "info": "45岁 · 女 · 妈妈",
        "statusLabel": "健康良好",
        "statusType": "ok",
        "metrics": [
          {
            "label": "血压",
            "value": "118/75",
            "unit": "mmHg · 正常",
            "unitType": "ok"
          },
          {
            "label": "体重",
            "value": "58.0",
            "unit": "kg · BMI 21.5",
            "unitType": "default"
          },
          {
            "label": "空腹血糖",
            "value": "5.2",
            "unit": "mmol/L · 正常",
            "unitType": "ok"
          },
          {
            "label": "静息心率",
            "value": "70",
            "unit": "bpm · 正常",
            "unitType": "ok"
          }
        ],
        "medications": [
          {
            "name": "维生素 D 软胶囊",
            "detail": "补充剂 · 每日一次 · 09:00 · 随早餐服用"
          }
        ],
        "timeline": [
          {
            "time": "2026-07-08 09:00",
            "title": "血压记录",
            "desc": "收缩压 118 / 舒张压 75 mmHg — 正常范围",
            "type": "default"
          },
          {
            "time": "2026-07-06 08:30",
            "title": "体重记录",
            "desc": "体重 58.0 kg — BMI 21.5，处于正常范围",
            "type": "default"
          },
          {
            "time": "2026-07-03 15:00",
            "title": "年度体检",
            "desc": "各项指标正常，建议保持现有健康习惯",
            "type": "default"
          }
        ]
      },
      {
        "name": "张小明",
        "avatarText": "明",
        "avatarColor": "var(--secondary)",
        "info": "12岁 · 男 · 儿子",
        "statusLabel": "成长关注",
        "statusType": "ok",
        "metrics": [
          {
            "label": "身高",
            "value": "152",
            "unit": "cm · 正常发育",
            "unitType": "ok"
          },
          {
            "label": "体重",
            "value": "42.0",
            "unit": "kg · BMI 18.2",
            "unitType": "default"
          },
          {
            "label": "视力",
            "value": "5.0/4.8",
            "unit": "正常 · 关注",
            "unitType": "warn"
          },
          {
            "label": "心率",
            "value": "82",
            "unit": "bpm · 正常",
            "unitType": "ok"
          }
        ],
        "medications": [],
        "timeline": [
          {
            "time": "2026-07-07 08:00",
            "title": "体重记录",
            "desc": "体重 42.0 kg — 生长发育正常",
            "type": "default"
          },
          {
            "time": "2026-07-04 10:00",
            "title": "视力检查",
            "desc": "左眼 5.0 / 右眼 4.8 — 建议注意用眼卫生",
            "type": "warn"
          },
          {
            "time": "2026-06-28 14:00",
            "title": "学校体检",
            "desc": "常规体检完成，各项指标正常",
            "type": "default"
          }
        ]
      }
    ]
  },
  "assessReport": {
    "score": 78,
    "grade": "良好",
    "summary": "您的家庭健康管理整体状况良好，部分维度仍有提升空间。建议关注慢性病管理和预防保健。",
    "dimensions": [
      {
        "label": "慢性病管理",
        "score": 72,
        "level": "mid"
      },
      {
        "label": "日常习惯",
        "score": 85,
        "level": "high"
      },
      {
        "label": "心理健康",
        "score": 80,
        "level": "high"
      },
      {
        "label": "预防保健",
        "score": 68,
        "level": "mid"
      }
    ],
    "risks": [
      "慢性病管理评分偏低，建议加强血压、血糖的日常监测与记录",
      "预防保健维度有待提升，建议定期体检并关注家庭成员疫苗接种"
    ],
    "suggestions": [
      {
        "title": "建立规律监测习惯",
        "desc": "每日固定时间测量血压并记录，有助于及时发现异常波动"
      },
      {
        "title": "完善预防保健档案",
        "desc": "记录家庭成员的体检计划和疫苗接种情况，设置定期提醒"
      },
      {
        "title": "关注家人心理健康",
        "desc": "定期与家人沟通情绪状态，营造温暖的家庭氛围"
      }
    ],
    "recommendations": [
      {
        "title": "AI 健康咨询",
        "desc": "获取个性化健康管理建议",
        "target": "consult",
        "iconBg": "rgba(61,138,90,.1)",
        "iconStroke": "#3D8A5A",
        "icon": "<path d=\"M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z\"/>"
      },
      {
        "title": "家庭健康档案",
        "desc": "查看和管理全家健康数据",
        "target": "archive",
        "iconBg": "rgba(212,166,74,.1)",
        "iconStroke": "#D4A64A",
        "icon": "<path d=\"M3 7V19a2 2 0 002 2h14a2 2 0 002-2V7M3 7L5 3h14l2 4M9 11h6\"/>"
      }
    ]
  }
};
