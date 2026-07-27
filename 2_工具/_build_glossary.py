import json

comparison = {
    '书名': {
        'Four Against Darkness': '四战黑',
        'Four Against the Abyss': '四战渊',
        'Four Against the Netherworld': '四战冥界',
    },
    '职业': {
        'Warrior': '战士',
        'Cleric': '牧师',
        'Rogue': '盗贼',
        'Wizard': '法师',
        'Barbarian': '野蛮人',
        'Elf': '精灵',
        'Dwarf': '矮人',
        'Halfling': '半身人',
    },
    '怪物分类': {
        'Vermin': '害虫',
        'Minion': '爪牙',
        'Boss / Boss Monster': '首领',
        'Weird Monster': '奇异怪物',
        'Wandering Monster': '游荡怪物',
        'Final Boss': '最终首领',
    },
    '具体怪物': {
        'Goblin': '哥布林（地精）',
        'Hobgoblin': '大型哥布林',
        'Orc': '兽人',
        'Orc Berserker': '兽人蛮兵',
        'Troll': '巨魔',
        'Ogre': '食人魔',
        'Giant': '巨人',
        'Kobold': '狗头人',
        'Skeleton': '骷髅',
        'Zombie': '僵尸',
        'Mummy': '木乃伊',
        'Medusa': '美杜莎',
        'Minotaur': '牛头怪',
        'Chimera': '奇美拉',
        'Giant Spider': '巨蛛',
        'Giant Centipede': '巨型蜈蚣',
        'Chaos Lord': '混沌领主',
        'Dragon / Wyrmling': '龙 / 幼龙',
        'Iron Eater': '铁食者',
        'Catoblepas': '卡托布莱帕斯',
        'Invisible Imp': '隐形小精灵',
        'Mushroom Man': '蘑菇人',
        'Rat Swarm': '鼠群',
        'Vampire Bat': '吸血蝙蝠',
        'Vampire Toad': '吸血蟾蜍',
        'Skeleton Rat': '骷髅鼠',
    },
    '法术': {
        'Bless': '祝福术',
        'Fireball': '火球术',
        'Lightning Bolt': '闪电箭',
        'Hypnotism': '催眠术',
        'Teleport': '逃脱术',
        'Shield': '防护术',
    },
    '装备与物品': {
        'Light armor': '轻甲',
        'Heavy armor': '重甲',
        'Shield': '盾牌',
        'One-handed weapon': '单手武器',
        'Two-handed weapon': '双手武器',
        'Light one-handed weapon': '轻型单手武器',
        'Bow': '弓',
        'Sling': '投石索',
        'Arrow': '箭矢',
        'Crushing weapon': '重击武器',
        'Slashing weapon': '挥砍武器',
        'Healing potion': '治疗药水',
        'Holy water': '圣水',
        'Lantern': '提灯',
        'Rope': '绳子',
        'Rations': '口粮',
        'Bandages': '绷带',
        'Lockpicks': '开锁工具',
        'Spellbook': '法术书',
        'Scroll': '卷轴',
    },
    '魔法物品': {
        'Wand of Hypnotism': '催眠魔杖',
        'Ring of Teleport': '传送戒指',
        'Fool\'s Gold': '愚人金',
        'Magic Weapon': '魔法武器',
        'Healing Potion': '治疗药水',
        'Staff of Fireball': '火球法杖',
    },
    '游戏机制': {
        'Attack Roll': '攻击投掷 / 攻击检定',
        'Defense Roll': '防御投掷 / 防御检定',
        'Level-Up Roll / XP Roll': '升级投掷 / 经验值投掷',
        'Save Versus': '豁免检定',
        'Treasure Roll': '宝藏投掷',
        'Morale Check': '士气检定',
        'Reaction': '反应（检定）',
        'Marching Order': '行进顺序 / 行军顺序',
        'Explosive Six Rule': '六六大顺规则',
        'Critical Fail (natural 1)': '大失败',
        'Hit Points (HP)': '生命值',
        'Level (L)': '等级',
        'Gold Pieces (gp)': '金币',
    },
    '房间与地形': {
        'Entrance Room': '起始房间',
        'Room Contents Table': '房间内容表',
        'Special Feature': '特色功能',
        'Special Event': '特殊事件',
        'Fountain': '喷泉',
        'Blessed Shrine': '祝福神殿',
        'Armory': '军械库',
        'Cursed Altar': '诅咒祭坛',
        'Statue': '雕像',
        'Puzzle Room': '谜题房间',
        'Secret Door': '暗门',
        'Hidden Treasure': '隐藏的宝藏',
        'Secret Passage': '秘密通道',
        'Corridor': '走廊',
        'Dead End': '死胡同',
    },
    '其他术语': {
        'Party': '队伍 / 小队',
        'Solo': '单人（游戏）',
        'Cooperative / Co-op': '合作（游戏）',
        'Campaign': '战役',
        'Adventure': '冒险',
        'Quest': '任务',
        'Clue': '线索',
        'Epic Reward': '史诗奖励',
        'Dungeoneer': '地下城探险者',
        'Non-player character (NPC)': '非玩家角色',
        'Dungeon Master (DM)': '地下城城主',
        'Gamemaster (GM)': '游戏主持人',
        'Oracle': '神谕',
        'Chaos Factor (CF)': '混沌因子',
    },
    '职业特性': {
        'Frenzy / Rage Attack': '狂怒攻击',
        'Lucky Point': '幸运点',
        'Heal (Cleric)': '治愈术',
        'Smell Treasure (Dwarf)': '嗅探宝藏',
        'Disarm Trap (Rogue)': '解除陷阱',
    },
    '反应结果': {
        'Flee': '逃跑',
        'Fight': '战斗',
        'Fight to the Death': '血战到底',
        'Bribe': '贿赂（索要贿赂）',
        'Peaceful Coexistence': '和平共处',
        'Offer Food and Rest': '提供食物和休息',
        'Puzzle': '谜题',
        'Quest': '任务',
        'Magic Challenge': '魔法挑战',
    },
}

with open('c:/Users/qiujian.shi/Desktop/test-skill/_术语对照表.json', 'w', encoding='utf-8') as f:
    json.dump(comparison, f, ensure_ascii=False, indent=2)

with open('c:/Users/qiujian.shi/Desktop/test-skill/_术语对照表.md', 'w', encoding='utf-8') as f:
    f.write('# 四战黑系列 中英术语对照表\n\n')
    f.write('> 来源：对比 `0_基础_Four Against Darkness.pdf`（英文原版）与 `0_四战黑_基础规则工具书-自译版.pdf`（自译版）\n\n')
    f.write('> 自译版中包含了译者标注的"原石翻译"注释，指出与官方中文版（原石桌游）的翻译差异\n\n')

    for category, terms in comparison.items():
        f.write(f'## {category}\n\n')
        f.write('| English | 中文翻译 |\n')
        f.write('|---------|----------|\n')
        for en, cn in terms.items():
            f.write(f'| {en} | {cn} |\n')
        f.write('\n')

    f.write('---\n\n')
    f.write('## 自译版与原石桌游版的翻译差异（摘录）\n\n')
    f.write('| 术语 | 自译版 | 原石桌游版（译者标注） |\n')
    f.write('|------|--------|------------------------|\n')
    f.write('| Frenzy次数 | 每局游戏一次 | 每局游戏1+等级/2次（已向作者确认新版规则） |\n')
    f.write('| Frenzy目标 | 仅对抗首领 | 任何怪物 |\n')
    f.write('| Frenzy伤害 | 造成2次伤害 | 造成双倍伤害 |\n')
    f.write('| 半身人烹饪 | 有（补充自原石） | 原石版新增规则 |\n')
    f.write('| 重甲交换 | 不可交换 | 原石补充强调 |\n')
    f.write('| 巨魔斩碎 | 需要挥砍武器 | 原石补充说明必须使用挥砍武器 |\n')
    f.write('| 铁食者宝藏 | 无宝藏 | 宝藏投掷无需修正 |\n')
    f.write('| 攻击首领伤害 | (d6+修正)/等级=击杀数 | (d6+修正)超过等级=1点伤害，每溢出1倍等级额外+1伤害 |\n')
    f.write('| 最终头领规则 | 最终头领不会出现在走廊 | 原石补充说明 |\n')
    f.write('| 升级投掷小兵 | -1修正 | 有 |\n')
    f.write('| 3线索升级 | 获得一次升级投掷 | 原石补充规则 |\n')
    f.write('| 野蛮人文盲原因 | 不识字且害怕魔法 | 质疑和惧怕魔法（不仅是文盲） |\n')

print('Done!')