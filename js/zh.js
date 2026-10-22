/* 中文 for TT Track & Field (田径运动会): the words on the page, the toasts, the banners, the result cards and the ? panel
   (Kit.lang, from kit/lang.js). The kids' names and the game's name stay in English. The only canvas words are the
   FINISH sign (js/scene.js draws it through Kit.lang.t and redraws it when the language changes). */
(function () {
  const L = Kit.lang;
  L.keep(['TT Track & Field', 'TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'Teddy', 'Tommy', 'Claude Code', 'P · Esc', 'Esc', 'Enter', 'A', 'D', 'W']);

  const EVENTS = { '100 M SPRINT': '100 米跑步', 'LONG JUMP': '跳远', JAVELIN: '标枪', '60 M HURDLES': '60 米跨栏', 'SPORTS DAY': '田径运动会' };
  const TREATS = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const val = (v) => v.replace(/^([\d.]+) S$/, '$1 秒').replace(/^([\d.]+) M$/, '$1 米').replace(/^NO MARK$/, '没有成绩');
  L.add(EVENTS);
  L.add({
    // title
    'Sports day! Run, jump and throw. Tap fast to win gold medals, and call your brother to run with you.': '田径运动会！跑步、跳远、扔标枪。点得越快越能拿金牌，还可以叫兄弟陪你跑。',
    'How many players': '几个人玩', '1 PLAYER': '1 个人', '2 PLAYERS': '2 个人', ATHLETE: '运动员', 'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2',
    'Previous athlete': '上一个运动员', 'Next athlete': '下一个运动员', 'How hard': '难度', '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', ZOMBIE: '僵尸',
    '▶ PLAY': '▶ 开始', 'tap fast to run': '快快按，跑起来', 'jump or throw': '跳或者扔', 'call your brother': '叫兄弟来帮忙',
    '👆 tap the feet fast to run, then jump or throw': '👆 快快点小脚丫跑起来，再跳或者扔', 'built with': '制作工具', 'LOADING…': '加载中…',
    // the event cards
    'PICK AN EVENT': '选一个项目', '← BACK': '← 返回', 'All 4 events. Win the most medals!': '4 个项目全都比，拿最多的奖牌！',
    'Tap fast and dash to the finish!': '快快点，冲到终点！', 'Run, jump at the board, land in the sand!': '跑过去，在起跳板跳，落进沙坑！',
    'Run and throw it far!': '跑过去，扔得远远的！', 'Run and hop over the hurdles!': '边跑边跳过栏架！',
    // pause
    PAUSED: '暂停', '▶ RESUME': '▶ 继续', '🏠 MENU': '🏠 菜单',
    // HUD
    SPEED: '速度', JUMP: '跳', THROW: '扔', SPACE: '空格', 'Left foot': '左脚', 'Right foot': '右脚', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'Call your brother (T)': '叫兄弟来帮忙 (T)', 'High five (T)': '击掌 (T)', 'TAP ME!': '点我！', 'HIGH FIVE!': '击掌！', FOUL: '犯规',
    // banners
    'ON YOUR MARKS': '各就各位', READY: '准备', SET: '预备', 'GO!': '跑！',
    'TAP FAST, AND JUMP OVER EVERY HURDLE!': '快快点，跳过每一个栏架！', 'LEFT, RIGHT, LEFT, RIGHT! FAST!': '左、右、左、右！要快！', 'TAP FAST TO RUN!': '快快点，跑起来！',
    'HOLD JUMP AT THE BOARD, LET GO AT THE GOLD!': '到起跳板按住“跳”，指到金色就松手！', 'TAP FAST, THEN JUMP AT THE WHITE BOARD!': '快快点，到白色起跳板就跳！',
    'HOLD THROW AT THE LINE, LET GO AT THE GOLD!': '到白线按住“扔”，指到金色就松手！', 'TAP FAST, THEN THROW AT THE WHITE LINE!': '快快点，到白线就扔！',
    // toasts and pops
    'TAP ← → FAST TO RUN!': '快快按 ← → 跑起来！', 'TAP YOUR TWO KEYS FAST TO RUN!': '快快按你的两个键跑起来！', 'TAP THE FEET FAST TO RUN!': '快快点小脚丫跑起来！',
    'LEFT, RIGHT, LEFT, RIGHT!': '左、右、左、右！', 'TOO EARLY! RUN CLOSER TO THE LINE.': '太早啦！再跑近一点。',
    'FOUL! YOU STEPPED OVER THE LINE.': '犯规！你踩过线了。', 'FOUL! YOU STEPPED OVER THE BOARD.': '犯规！你踩过起跳板了。',
    'OOPS!': '哎呀！', 'TOO EARLY!': '太早啦！', 'FOUL!': '犯规！', '🙌 HIGH FIVE!': '🙌 击掌！',
    // the results card
    'GOLD MEDAL! YOU WON!': '金牌！你赢啦！', 'SILVER MEDAL! SO CLOSE!': '银牌！就差一点点！', 'BRONZE MEDAL! WELL DONE!': '铜牌！真棒！',
    'NO MEDAL THIS TIME. TRY AGAIN!': '这次没拿到奖牌，再来一次！', 'A TIE! GOLD FOR BOTH!': '平局！两个人都拿金牌！', 'NO MARKS! TRY AGAIN!': '都没有成绩！再来一次！',
    'NO MARK': '没有成绩', '★ NEW BEST! ★': '★ 新纪录！★', '▶ NEXT EVENT': '▶ 下一个项目', '🏆 MEDAL TABLE': '🏆 奖牌榜', '↻ PLAY AGAIN': '↻ 再玩一次',
    '🏅 PICK AN EVENT': '🏅 选一个项目', 'SPORTS DAY RESULTS': '运动会成绩', POINTS: '积分', 'NO MEDALS TODAY. TRY AGAIN!': '今天没有奖牌，再来一次！',
    FINISH: '终点',
    // the ? panel
    '1 player': '1 个人', 'Player 1': '玩家 1', 'Player 2': '玩家 2',
    'run: tap left, right, left, right': '跑步：左、右、左、右快快按', 'jump or throw (NORMAL: hold, let go at the gold)': '跳或者扔（普通：按住，指到金色就松手）',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（2 个人：击掌）', 'pick your athlete (title)': '选运动员（标题页）', 'easy or normal (title)': '简单还是普通（标题页）',
    'start · next': '开始 · 下一个', pause: '暂停', 'sound on / off': '声音开 / 关',
    'EASY: any foot key counts, and you jump or throw at the line by yourself. NORMAL: left, right, left, right (the same foot twice is a weak step), and over the line is a foul.':
      '简单：按哪只脚都算，到了线会自己跳或者扔。普通：要左、右、左、右地按（同一只脚按两次只算小小一步），踩过线就是犯规。',
    "Tap the two feet fast to run, then tap JUMP or THROW. Tap your brother's face to call him.": '快快点两只小脚丫跑起来，再点“跳”或者“扔”。点兄弟的脸可以叫他来。',
  });
  // words with names and numbers in them
  L.rule(/^([\d.]+) ([SM])$/, (m) => val(m));
  L.rule(/^(🐣|🔥) BEST (.+)$/, (m, lv, v) => `${lv} 最好成绩 ${val(v)}`);
  L.rule(/^(🐣|🔥) BEST: (.+) · (\S+)$/, (m, lv, v, who) => `${lv} 最好成绩：${val(v)} · ${who}`);
  L.rule(/^TRY (\d) OF (\d)$/, '第 $1 次（共 $2 次）');
  L.rule(/^EVENT (\d) OF (\d)$/, '第 $1 项（共 $2 项）');
  L.rule(/^EVENT (\d) OF (\d) · TRY (\d) OF (\d)$/, '第 $1 项（共 $2 项）· 第 $3 次（共 $4 次）');
  L.rule(/^(1ST|2ND|3RD|4TH)! ([\d.]+)$/, (m, p, t) => `${{ '1ST': '第 1 名', '2ND': '第 2 名', '3RD': '第 3 名', '4TH': '第 4 名' }[p]}！${t} 秒`);
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^🏆 (\S+): (\d+)$/, '🏆 $1：$2');
  L.rule(/^(\S+) IS HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) IS THE CHAMPION!$/, '$1 是冠军！');
  L.rule(/^(.+) AND (.+) SHARE THE CUP!$/, '$1 和 $2 一起拿冠军！');
  L.rule(/^(\S+) WINS THE DAY! TRY AGAIN!$/, '$1 赢了今天的运动会！再来一次！');
  L.rule(/^(\S+) SAYS: I'LL PACE YOU! RUN WITH ME!$/, '$1 说：我陪你跑！跟上我！');
  L.rule(/^(\S+) SAYS: JUMP!$/, '$1 说：跳！');
  L.rule(/^(\S+) SAYS: (JUMP|THROW) NOW!$/, (m, who, w) => `${who} 说：现在${w === 'JUMP' ? '跳' : '扔'}！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, e, item, who) => `${e} ${who} 送来的${TREATS[item]}！`);
})();
