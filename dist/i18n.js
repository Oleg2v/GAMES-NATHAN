export const LOCALES = ['ru', 'en', 'he'];
export const COPY = {
 ru: {
  pageTitle:'NATHAN — Уличный разнос',description:'Пиксельный экшен с Натаном. Город, лес и завод. Удары, броски, ярость и аркадные усиления.',
  startMobile:'НАЧАТЬ ИГРУ',startHintMobile:'ДВИЖЕНИЕ СЛЕВА · УДАРЫ СПРАВА · ПРЕДМЕТЫ ВНИЗУ',mobileHint:'На телефоне играй горизонтально. Все кнопки — на экране.',fullscreenExit:'Выйти из полноэкранного режима',rotateTitle:'ПОВЕРНИ ТЕЛЕФОН',rotateText:'Игра на паузе. Поверни телефон горизонтально, затем нажми «Продолжить».',rotateMenu:'ВЕРНУТЬСЯ В МЕНЮ',
  brandSubtitle:'УЛИЧНЫЙ РАЗНОС',brandAria:'NATHAN — главное меню',edition:'ПИКСЕЛЬНЫЙ ЭКШЕН',volume:'ВЫП. 01',language:'Язык игры',
  sound:'ЗВУК',soundOn:'ВКЛ',soundOff:'ВЫКЛ',soundEnable:'Включить звук',soundDisable:'Выключить звук',fullscreen:'На весь экран',fullscreenError:'Полноэкранный режим недоступен в этом браузере.',
  arcade:'АРКАДНЫЙ РЕЖИМ',arena:'Игровая арена',player:'ИГРОК 01',record:'РЕКОРД',pause:'Пауза',menu:'В МЕНЮ',
  gameAria:'Игра Натан. WASD или стрелки — движение, J — удар рукой, K — ногой, E или L — бросок, Q — ярость, C — присесть, пробел — рывок, 1–5 — предметы, Escape или P — пауза.',
  portraitAlt:'Пиксельный Натан — крупный бородатый мужчина в чёрной футболке',heroMetrics:'195 СМ · 140 КГ · ОДИН НАТАН',heroTitle:'НИ ШАГУ<br><em>НАЗАД.</em>',heroIntro:'Три района. Сотни проблем.<br>Разговор будет коротким.',
  loading:'ЗАГРУЗКА…',prepare:'Готовим арену',loadFailed:'Не удалось загрузить графику. Обнови страницу.',start:'НАЧАТЬ РАЗНОС',startLevel:'НАЧАТЬ: {level}',startHint:'WASD — ДВИЖЕНИЕ · J / K — УДАРЫ · E — БРОСОК',routeLine:'ГОРОД → ЛЕС → ЗАВОД',tagline:'ЖМИ. БЕЙ. ПОВТОРЯЙ.',arenaMenu:'ВЫБЕРИ МАРШРУТ. НАЧНИ РАЗНОС.',
  loadoutTitle:'КАРМАНЫ НАТАНА',itemHelp:'КЛАВИШИ 1–5 · УСИЛЕНИЯ НА 120 СЕК.',routeTitle:'ТРИ МЕСТА. ОДИН ПЛАН.',routeHelp:'ВЫБОР СТАРТОВОГО УРОВНЯ',shift:'СМЕНА 03',
  fiction:'Все эффекты предметов вымышлены и существуют только в игре.',controls:'КАК ИГРАТЬ',touch:'Сенсорное управление',up:'Вверх',down:'Вниз',left:'Влево',right:'Вправо',punch:'РУКА',kick:'НОГА',dodge:'РЫВОК',throw:'БРОСОК',special:'ЯРОСТЬ',movement:'движение',pauseControl:'пауза',itemsControl:'предметы',
  controlIntro:'Двигайся по арене вверх и вниз, чтобы оказаться на одной линии с противником. Держи J или K для серии ударов.',
  controlCombos:'Три попадания рукой подряд завершаются мощным добиванием — держи J. Удар ногой прерывает эту серию. Пробел даёт короткий рывок с защитой от ударов.',
  crouch:'ПРИСЕСТЬ',controlCrouch:'Держи C, чтобы присесть и уклоняться от обычных ударов в голову. В приседе скорость ниже. Удары босса всё ещё опасны.',
  controlThrow:'Подойди вплотную и нажми E или L: Натан схватит противника и бросит его в остальных.',
  controlSpecial:'Попадания наполняют ярость. На 100 нажми Q для мощного удара по окружающим. Предметы — клавиши 1–5 или карточки ниже.',
  health:'Здоровье Натана',score:'Счёт',wave:'ВОЛНА {wave} / 3',enemies:'ПРОТИВНИКОВ: {count}',combo:'КОМБО',force:'СИЛА',speed:'СКОРОСТЬ',slowmo:'СЛОУ-МО',heavy:'ТЯЖЁЛЫЙ ВЕС',light:'ЛЁГКИЙ НА ХОДУ',
  arenaRun:'{level} / СИЛА {damage} / {weight} / J + K — КОМБО · E — БРОСОК · Q — ЯРОСТЬ',seconds:'{n}с',inPocket:'В КАРМАНЕ: {count}',instant:'МГНОВЕННО',oneTwenty:'120 СЕК.',itemAria:'{name}: {description}. Клавиша {key}',stageAria:'Начать уровень {number}: {name}. {subtitle}',
  rage:'ЯРОСТЬ',rageReady:'ЯРОСТЬ ГОТОВА · Q',specialNotReady:'Ярость: {rage} из 100. Наноси удары для зарядки.',specialReady:'Ярость готова. Нажми Q или эту кнопку.',fps:'{fps} КАДР/С',localArcade:'АРКАДА',healthStatus:'Здоровье {hp} из {max}',
  pausedKicker:'ПАУЗА',pausedTitle:'ПЕРЕДЫШКА.',pausedText:'Соберись. Улица подождёт.',pausedButton:'ПРОДОЛЖИТЬ',
  levelclearKicker:'УРОВЕНЬ ПРОЙДЕН',levelclearTitle:'ЧИСТАЯ РАБОТА.',levelclearText:'Счёт: {score}\nДальше — {next}. +30 здоровья и пополнение карманов.',levelclearButton:'СЛЕДУЮЩИЙ УРОВЕНЬ',
  gameoverKicker:'ЕЩЁ ОДНА ПОПЫТКА',gameoverTitle:'НАТАН УПАЛ.',gameoverText:'Но это не конец. Используй рывок, броски, усиления и шаурму.',gameoverButton:'ПОПРОБОВАТЬ СНОВА',
  victoryKicker:'ВСЕ УРОВНИ ПРОЙДЕНЫ',victoryTitle:'РАЗНОС ЗАВЕРШЁН.',victoryText:'Счёт: {score} · Побеждено: {kills}\nГород, лес и завод теперь знают Натана.',victoryButton:'ЕЩЁ РАЗ',
  levels:[{name:'ГОРОД',subtitle:'Асфальт помнит всех.'},{name:'ЛЕС',subtitle:'Здесь никто не услышит комбо.'},{name:'ЗАВОД',subtitle:'Тяжёлая промышленность.'}],
  items:[{name:'Виванс 20',description:'+20 к силе · 120 сек',effect:'СИЛА +20'},{name:'Виванс 30',description:'+30 к силе · 120 сек',effect:'СИЛА +30'},{name:'Шмаль',description:'Слоу-мо и удары ×1,25 · 120 сек',effect:'СЛОУ-МО · УДАР ×1,25'},{name:'Оземпик',description:'Стройнее и скорость ×1,7 · 120 сек',effect:'СКОРОСТЬ ×1,7'},{name:'Шаурма',description:'+45 здоровья',effect:'ЗДОРОВЬЕ +45'}]
 },
 en: {
  pageTitle:'NATHAN — Street Rampage',description:'Pixel action starring Nathan. City, forest and factory. Punches, throws, rage and arcade power-ups.',
  startMobile:'START GAME',startHintMobile:'MOVE ON THE LEFT · FIGHT ON THE RIGHT · ITEMS BELOW',mobileHint:'Play in landscape on your phone. All controls are on screen.',fullscreenExit:'Exit full screen',rotateTitle:'TURN YOUR PHONE',rotateText:'The game is paused. Turn your phone sideways, then tap Resume.',rotateMenu:'BACK TO MENU',
  brandSubtitle:'STREET RAMPAGE',brandAria:'NATHAN — main menu',edition:'PIXEL BEAT ’EM UP',volume:'VOL. 01',language:'Game language',
  sound:'SOUND',soundOn:'ON',soundOff:'OFF',soundEnable:'Turn sound on',soundDisable:'Turn sound off',fullscreen:'Full screen',fullscreenError:'Full-screen mode is unavailable in this browser.',
  arcade:'ARCADE MODE',arena:'Game arena',player:'PLAYER 01',record:'BEST',pause:'Pause',menu:'MAIN MENU',
  gameAria:'Nathan game. WASD or arrows to move, J to punch, K to kick, E or L to throw, Q for rage, C to crouch, Space to dash, 1–5 for items, Escape or P to pause.',
  portraitAlt:'Pixel Nathan — a large bearded man wearing a black T-shirt',heroMetrics:'195 CM · 140 KG · ONE NATHAN',heroTitle:'NO STEP<br><em>BACK.</em>',heroIntro:'Three places. A hundred problems.<br>This conversation will be short.',
  loading:'LOADING…',prepare:'Preparing the arena',loadFailed:'Graphics could not load. Refresh the page.',start:'START THE RAMPAGE',startLevel:'START: {level}',startHint:'WASD — MOVE · J / K — ATTACK · E — THROW',routeLine:'CITY → FOREST → FACTORY',tagline:'PRESS. FIGHT. REPEAT.',arenaMenu:'PICK YOUR ROUTE. START THE RAMPAGE.',
  loadoutTitle:'NATHAN’S POCKETS',itemHelp:'KEYS 1–5 · POWER-UPS LAST 120 SEC.',routeTitle:'THREE PLACES. ONE PLAN.',routeHelp:'CHOOSE A STARTING LEVEL',shift:'SHIFT 03',
  fiction:'All item effects are fictional and exist only in this game.',controls:'HOW TO PLAY',touch:'Touch controls',up:'Up',down:'Down',left:'Left',right:'Right',punch:'PUNCH',kick:'KICK',dodge:'DASH',throw:'THROW',special:'RAGE',movement:'move',pauseControl:'pause',itemsControl:'items',
  controlIntro:'Move up and down the arena to line up with your opponent. Hold J or K for repeated attacks.',
  controlCombos:'Three connected punches end with a powerful finisher — hold J. A kick breaks this chain. Space gives a short dash with protection from hits.',
  crouch:'CROUCH',controlCrouch:'Hold C to crouch and duck ordinary high punches. Movement is slower while crouching. Boss attacks can still hit you.',
  controlThrow:'Get close and press E or L: Nathan grabs the opponent and throws him into the others.',
  controlSpecial:'Hits charge rage. At 100, press Q for a powerful area attack. Use items with keys 1–5 or the cards below.',
  health:'Nathan’s health',score:'Score',wave:'WAVE {wave} / 3',enemies:'ENEMIES: {count}',combo:'COMBO',force:'POWER',speed:'SPEED',slowmo:'SLOW-MO',heavy:'HEAVYWEIGHT',light:'LIGHT ON HIS FEET',
  arenaRun:'{level} / POWER {damage} / {weight} / J + K — COMBO · E — THROW · Q — RAGE',seconds:'{n}s',inPocket:'IN POCKET: {count}',instant:'INSTANT',oneTwenty:'120 SEC.',itemAria:'{name}: {description}. Key {key}',stageAria:'Start level {number}: {name}. {subtitle}',
  rage:'RAGE',rageReady:'RAGE READY · Q',specialNotReady:'Rage: {rage} out of 100. Land hits to charge it.',specialReady:'Rage is ready. Press Q or this button.',fps:'{fps} FPS',localArcade:'ARCADE',healthStatus:'Health {hp} out of {max}',
  pausedKicker:'PAUSED',pausedTitle:'TAKE A BREATH.',pausedText:'Get ready. The street can wait.',pausedButton:'RESUME',
  levelclearKicker:'LEVEL CLEARED',levelclearTitle:'CLEAN WORK.',levelclearText:'Score: {score}\nNext — {next}. +30 health and restocked pockets.',levelclearButton:'NEXT LEVEL',
  gameoverKicker:'ONE MORE TRY',gameoverTitle:'NATHAN IS DOWN.',gameoverText:'It is not over. Use dashes, throws, power-ups and shawarma.',gameoverButton:'TRY AGAIN',
  victoryKicker:'ALL LEVELS CLEARED',victoryTitle:'RAMPAGE COMPLETE.',victoryText:'Score: {score} · Defeated: {kills}\nThe city, forest and factory now know Nathan.',victoryButton:'PLAY AGAIN',
  levels:[{name:'CITY',subtitle:'The asphalt remembers everyone.'},{name:'FOREST',subtitle:'No one can hear your combo here.'},{name:'FACTORY',subtitle:'Heavy industry. Heavier hits.'}],
  items:[{name:'Vyvanse 20',description:'+20 power · 120 sec',effect:'POWER +20'},{name:'Vyvanse 30',description:'+30 power · 120 sec',effect:'POWER +30'},{name:'Weed',description:'Slow motion and hits ×1.25 · 120 sec',effect:'SLOW-MO · HIT ×1.25'},{name:'Ozempic',description:'Slimmer and speed ×1.7 · 120 sec',effect:'SPEED ×1.7'},{name:'Shawarma',description:'+45 health',effect:'HEALTH +45'}]
 },
 he: {
  pageTitle:'NATHAN — בלגן ברחובות',description:'משחק אקשן בפיקסלים עם נתן. עיר, יער ומפעל. אגרופים, הטלות, זעם ושדרוגי ארקייד.',
  startMobile:'מתחילים לשחק',startHintMobile:'תנועה משמאל · מכות מימין · חפצים למטה',mobileHint:'בטלפון משחקים לרוחב. כל הפקדים נמצאים על המסך.',fullscreenExit:'יציאה ממסך מלא',rotateTitle:'מסובבים את הטלפון',rotateText:'המשחק מושהה. סובבו את הטלפון לרוחב ואז לחצו על המשך.',rotateMenu:'חזרה לתפריט',
  brandSubtitle:'בלגן ברחובות',brandAria:'NATHAN — תפריט ראשי',edition:'אקשן בפיקסלים',volume:'פרק 01',language:'שפת המשחק',
  sound:'צליל',soundOn:'פעיל',soundOff:'כבוי',soundEnable:'הפעלת צליל',soundDisable:'כיבוי צליל',fullscreen:'מסך מלא',fullscreenError:'מצב מסך מלא אינו זמין בדפדפן הזה.',
  arcade:'מצב ארקייד',arena:'זירת המשחק',player:'שחקן 01',record:'שיא',pause:'השהיה',menu:'לתפריט הראשי',
  gameAria:'המשחק של נתן. WASD או החצים לתנועה, J לאגרוף, K לבעיטה, E או L להטלה, Q לזעם, C לכריעה, רווח לזינוק, 1–5 לחפצים, Escape או P להשהיה.',
  portraitAlt:'נתן בפיקסלים — גבר גדול ומזוקן בחולצת טריקו שחורה',heroMetrics:'195 ס״מ · 140 ק״ג · נתן אחד',heroTitle:'אף צעד<br><em>לאחור.</em>',heroIntro:'שלושה מקומות. מאה בעיות.<br>השיחה הזאת תהיה קצרה.',
  loading:'טוען…',prepare:'מכינים את הזירה',loadFailed:'לא ניתן לטעון את הגרפיקה. יש לרענן את הדף.',start:'מתחילים בבלגן',startLevel:'מתחילים: {level}',startHint:'WASD — תנועה · J / K — מכות · E — הטלה',routeLine:'עיר ← יער ← מפעל',tagline:'לוחצים. נלחמים. חוזרים.',arenaMenu:'בוחרים מסלול. מתחילים בבלגן.',
  loadoutTitle:'הכיסים של נתן',itemHelp:'מקשים 1–5 · שדרוגים ל־120 שניות',routeTitle:'שלושה מקומות. תוכנית אחת.',routeHelp:'בחירת שלב פתיחה',shift:'משמרת 03',
  fiction:'כל השפעות החפצים דמיוניות וקיימות רק במשחק.',controls:'איך משחקים',touch:'פקדי מגע',up:'למעלה',down:'למטה',left:'שמאלה',right:'ימינה',punch:'אגרוף',kick:'בעיטה',dodge:'זינוק',throw:'הטלה',special:'זעם',movement:'תנועה',pauseControl:'השהיה',itemsControl:'חפצים',
  controlIntro:'נעים למעלה ולמטה בזירה כדי להתיישר מול היריב. מחזיקים J או K לרצף מכות.',
  controlCombos:'שלושה אגרופים שפוגעים ברצף מסתיימים במכת סיום חזקה — מחזיקים J. בעיטה קוטעת את הרצף. מקש הרווח מפעיל זינוק קצר עם הגנה ממכות.',
  crouch:'כריעה',controlCrouch:'מחזיקים C כדי לכרוע ולהתחמק מאגרופים רגילים לראש. התנועה איטית יותר בכריעה. מכות של הבוס עדיין יכולות לפגוע.',
  controlThrow:'מתקרבים ולוחצים E או L: נתן תופס את היריב ומטיל אותו על האחרים.',
  controlSpecial:'פגיעות ממלאות את מד הזעם. כשהוא מגיע ל־100, לוחצים Q למכה חזקה שפוגעת ביריבים מסביב. חפצים מפעילים במקשים 1–5 או בכרטיסים למטה.',
  health:'הבריאות של נתן',score:'ניקוד',wave:'גל {wave} / 3',enemies:'יריבים: {count}',combo:'קומבו',force:'כוח',speed:'מהירות',slowmo:'הילוך איטי',heavy:'משקל כבד',light:'קל על הרגליים',
  arenaRun:'{level} / כוח {damage} / {weight} / J + K — קומבו · E — הטלה · Q — זעם',seconds:'{n} שנ׳',inPocket:'בכיס: {count}',instant:'מיידי',oneTwenty:'120 שניות',itemAria:'{name}: {description}. מקש {key}',stageAria:'התחלת שלב {number}: {name}. {subtitle}',
  rage:'זעם',rageReady:'הזעם מוכן · Q',specialNotReady:'זעם: {rage} מתוך 100. פוגעים ביריבים כדי למלא את המד.',specialReady:'הזעם מוכן. לחצו Q או על הכפתור הזה.',fps:'{fps} תמונות/שנ׳',localArcade:'ארקייד',healthStatus:'בריאות {hp} מתוך {max}',
  pausedKicker:'השהיה',pausedTitle:'לוקחים אוויר.',pausedText:'מתארגנים. הרחוב יכול לחכות.',pausedButton:'ממשיכים',
  levelclearKicker:'השלב הושלם',levelclearTitle:'עבודה נקייה.',levelclearText:'ניקוד: {score}\nהבא — {next}. 30 נקודות בריאות נוספות ומילוי הכיסים.',levelclearButton:'לשלב הבא',
  gameoverKicker:'עוד ניסיון אחד',gameoverTitle:'נתן נפל.',gameoverText:'זה עוד לא נגמר. השתמשו בזינוקים, הטלות, שדרוגים ושווארמה.',gameoverButton:'מנסים שוב',
  victoryKicker:'כל השלבים הושלמו',victoryTitle:'הבלגן הושלם.',victoryText:'ניקוד: {score} · יריבים שהובסו: {kills}\nהעיר, היער והמפעל כבר מכירים את נתן.',victoryButton:'משחקים שוב',
  levels:[{name:'עיר',subtitle:'האספלט זוכר את כולם.'},{name:'יער',subtitle:'כאן אף אחד לא ישמע את הקומבו.'},{name:'מפעל',subtitle:'תעשייה כבדה. מכות כבדות יותר.'}],
  items:[{name:'ויואנס 20',description:'תוספת 20 כוח · 120 שניות',effect:'כוח +20'},{name:'ויואנס 30',description:'תוספת 30 כוח · 120 שניות',effect:'כוח +30'},{name:'גראס',description:'הילוך איטי ומכות פי 1.25 · 120 שניות',effect:'הילוך איטי · מכה ×1.25'},{name:'אוזמפיק',description:'רזה יותר ומהירות פי 1.7 · 120 שניות',effect:'מהירות ×1.7'},{name:'שווארמה',description:'תוספת 45 בריאות',effect:'בריאות +45'}]
 }
};
export function getCopy(locale) { return COPY[locale] || COPY.ru; }
export function translate(locale,key,values={}) {
 const value=getCopy(locale)[key];
 if(typeof value!=='string') return key;
 return value.replace(/\{(\w+)\}/g,(_,name)=>String(values[name]??''));
}

