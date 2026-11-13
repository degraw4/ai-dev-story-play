import { campaignDay, rulesFor, price, mediaCost, productionSummary, publicationPresenter } from './game/rules.js';
import { DIRECTIONS } from './game/content.js';
import {isCareer} from './game/career.js';

export const DIRECTION_LABELS = { coding:'编程', office:'办公', multimodal:'多模态' };

// Copy belongs to the published model, not to a second release schedule.
// Scores and dates always come from the model supplied by the game rules.
const MODEL_DESCRIPTIONS = {
  CloseAI: {
    'TalkGPT 3':'CloseAI 的早期主力，办公是强项。演示中，Sam 让它写一封邮件，现场有人已经开始问能不能接进公司的工作流。',
    'TalkGPT 4':'办公成绩涨了一截。Sam 演示完靠进椅子：“你们刚才看到了吗？”台下的记者还在找回放按钮。',
    'TalkGPT 5':'发布会开始前，Sam 连发了几条意味深长的预告。等到正式演示，观众才看到它处理长文档和表格。',
    'TalkGPT Astra':'CloseAI 给旗舰起了新代号。台上刚展示完办公任务，台下采购就问：原来的订阅包包括这个型号吗？',
  },
  AntiThropic: {
    'Cloud Opus 3':'AntiThropic 用它主打编程。演示里的测试全部通过，开发者打算拿公司项目再试一次。',
    'Cloud Opus 4':'编程榜上的强手。开发者发帖分享使用体验，评论里有人追问：“你的账号是怎么注册成功的？”',
    'Cloud Opus 5':'编程成绩继续提高。有人试着让它处理十年老项目，刚跑到一半，屏幕上弹出了额度提示。',
    'Cloud Fable':'AntiThropic 的新旗舰，编程依然是重点。团队刚批完采购申请，负责人登录时又被要求验证设备。',
  },
  Gloglo: {
    'Geminot 1':'Gloglo 的主力型号，偏重办公和多模态。发布会上，搜索、邮箱和云服务团队分别展示了接入计划。',
    'Geminot 2':'Jeff Damn 离职后，Gloglo 的大团队继续推进发布。邀请函照常发出，只是主持人的名字换了。',
    'Geminot 3':'图片演示由一组介绍，文档演示由另一组介绍。记者问什么时候接入现有产品，主持人请第三组来回答。',
    'Geminot 4':'Gloglo 更新了旗舰，图片和文档演示接连上台。开发者看完发布会，又打开三份产品文档确认接入方式。',
  },
  Meeta: {
    'Drama 2':'Meeta 发布了新模型。Mark 先介绍投入了多少显卡，又展示了一段制作精良的宣传片。',
    'Drama 3':'发布视频和户外广告同时上线。记者问模型能做什么，公关先递来一份印着团队合照的资料。',
    'Drama 4':'高价挖来的研究员陆续到岗。Mark 在台上逐个介绍新成员，台下记者翻着资料找模型的实测结果。',
    'Drama 5':'Meeta 又发布了一版旗舰。宣传片里摆满显卡，开发者先翻运行资料：家里那几张到底带不带得动？',
  },
  DeepPeek: {
    'DeepPeek V2':'DeepPeek 主打低成本，编程表现不错。官网同时列出了模型文件、使用说明和价格。',
    'DeepPeek V3':'DeepPeek 更新了模型文件和技术说明。开发者下载后跑起测试，也顺手算了算使用成本。',
    'DeepPeek R1':'模型和推理成本表一起上线。技术报告写了具体做法，同行最先转发的是价格那一页。',
    'DeepPeek R2':'DeepPeek 发布下一版模型，同步更新技术报告和价格资料。同行收到链接后，先点开了价格页。',
  },
};

export function modelIntroduction(model) {
  const release = model.day === 0 ? '开局已有模型' : `第 ${model.day} 日发布`;
  if (model.company === 'player') {
    const focus = DIRECTION_LABELS[model.focus];
    const score = model.scores.reduce((sum, value) => sum + value, 0);
    const media = model.media ? `这次买了${model.media}的报道。` : '这次没有买媒体报道。';
    return { description:`本公司发布的模型，主攻${focus}，综合 ${score} 分。${media}`, focus, release };
  }
  const highest = model.scores.indexOf(Math.max(...model.scores));
  return {
    description:MODEL_DESCRIPTIONS[model.company]?.[model.name] || '这款模型已经发布，三项成绩列在这条榜单记录里。',
    focus:DIRECTION_LABELS[DIRECTIONS[highest]],
    release,
  };
}

export const EMPLOYEE_TRAITS = {
  avery:'拿到代码先跑测试，不太会写发布稿。', jules:'熟悉文档和表格，一听要临时加会就皱眉。',
  morgan:'擅长整理办公材料，最讨厌“最终版”后面再加数字。', casey:'擅长多模态，开会时总能掏出一张准备好的示例图。',
  alex:'技术一般，认识不少媒体编辑。由他主持发布，买报道能拿优惠价。', rebo:'用户抱怨没额度，他就想按重置。每次花 4 万，完成后评价最多 +0.5。',
  karpathy:'研究底子扎实。开会先问实验跑过没有，再问发布稿是谁写的。', boris:'爱把重复工作写成脚本。参加研发时，每日进度额外 +2。',
  tim:'熟悉训练效率。参加研发时，每日进度额外 +1，不多占设备。', max:'先翻评测题，再看训练计划。评测阶段主攻能力贡献额外 +4。',
};
export function specialAbility(state,id) {
  const description={
    rebo:{name:'重置额度',mode:'主动能力',copy:`花 4 万重置一次额度，${isCareer(state)?'需要1个有效工作日，体力不足时先休整；完成后':'下一游戏日'}评价最多 +0.5，最高 5.0。处理完之前，他不参加方案和研发。`},
    alex:{name:'营销包装',copy:`他有空主持时，发布会默认优先选他。由他主持并购买报道，费用从 ${mediaCost(state,'avery')} 万降为 ${mediaCost(state,'alex')} 万；休整、进修或换其他人主持时不享受这项优惠。`},
    boris:{name:'协作自动化',copy:'他参加研发时，每日推进额外 +2。'},
    tim:{name:'算力效率',copy:'他参加研发时，每日推进额外 +1，不多占设备。'},
    max:{name:'评测专长',copy:'评测阶段给主攻方向额外提供 4 点能力贡献，再按研发公式累计榜分。'},
    karpathy:{name:'研究深度',copy:'三项能力都能用于研发；让他负责方案时，方案初值也按他的当前能力计算。'},
  }[id];
  if(!description)return null;
  const summary=productionSummary(state),participating=summary.activeEmployeeIds.includes(id)&&!['idle','planning','ready'].includes(summary.phaseId);
  const status=!state.employees.includes(id)?'入职后可用':id==='rebo'?'在员工卡主动使用':id==='alex'?(publicationPresenter(state)==='alex'?'当前可主持，购买报道享受优惠':'等待他可主持时享受优惠'):id==='max'?(participating&&summary.phaseId==='evaluation'?'本阶段已计入评测贡献':'进入评测时自动生效'):id==='karpathy'?'方案与研发使用当前三项能力':participating?'本阶段已计入研发速度':'参与研发时自动生效';
  return {mode:'自动特性',...description,status};
}
export const FAREWELLS = {
  avery:'“交接里写了怎么跑测试。这次总该有人看了吧。”', jules:'“会都替我取消了吧，赔偿别让我再填三遍表。”', morgan:'“交接文件请留着版本号。以后要问哪份最新，就得找接手的人了。”',
  casey:'“离职手续签好了。下场演示我就坐观众席了，记得给个能打开的链接。”', alex:'“下次软文找谁打折，你自己去问。”', rebo:'“以后额度不够，别再给我发消息。工单你自己接。”',
  karpathy:'“那我先走了。以后看到你们的新模型，我会先翻技术说明。”', boris:'“脚本都交接了。下回跑不通，先看报错再找我。”', tim:'“赔偿到账了。下一份工作，我还是先看看机器怎么跑，再谈买卡。”', max:'“你最好祈祷下次评测不换题。”',
};
export const CHAPTERS = [
  {day:0,title:'先发一款再说',copy:'小满（公司秘书）：“我是小满。公司开张时只有两个人、四个工位。先选个研发方向，把第一款模型做出来。”'},
  {day:22,title:'该招人还是买卡',copy:'人才市场有人来应聘，采购页也更新了报价。先算够不够付工资，再决定这笔钱花在哪。'},
  {day:50,title:'隔壁又发了',copy:'几家公司轮流发模型，媒体群的截图一张接一张。看看他们这次涨了哪项，再安排自己的下一款。'},
  {day:85,title:'旧截图先别删',copy:'同行还在更新模型。已经发布的成绩都留着，宣传时记得看截图上的日期。'},
  {day:148,title:'最后几天，先把这款发了',copy:'最后可发布日：167。第 168 日结算后进入结局。小满：“做完的模型记得正式发布，光留在研发页不算。”'},
];
// Ending copy follows the actual campaign ending, while industry events keep
// their original profile calendar. Career phase one is not the final deadline.
export function finaleDay(state,classicDay=148){return rulesFor(state).lastDay-(campaignDay(state,168)-campaignDay(state,classicDay));}
export function chapterAt(day,state={campaignProfile:'classic168'}) {
  const final=CHAPTERS.at(-1);
  if(day>=finaleDay(state,final.day))return {...final,day:finaleDay(state,final.day),copy:calendarCopy(final.copy,state)};
  if(isCareer(state)&&day>=112)return {day:day>=224?224:112,title:day>=224?'成熟竞争：下一代还要发':'公开生态：要不要开放权重',copy:day>=224?'小满：同行的新一代已经在排期。先看旧型号还挣多少钱，再决定是补团队、加设备，还是把钱留给下一轮训练。':'小满：现在可以多看看同行公开的模型。咱们也能开放权重攒人气，但别人学走的东西不会还回来，API 收入也会受影响。'};
  const chapter=CHAPTERS.slice(0,-1).findLast(chapter=>day>=campaignDay(state,chapter.day));
  return {...chapter,day:campaignDay(state,chapter.day),copy:calendarCopy(chapter.copy,state)};
}
function calendarCopy(text,state){return text.replace('最后可发布日：167',`最后可发布日：${rulesFor(state).lastDay-1}`).replace(/第\s*(\d+)\s*日/g,(_,day)=>`第 ${[167,168].includes(Number(day))?finaleDay(state,Number(day)):campaignDay(state,Number(day))} 日`);}
const NEWS = [
  [7,'bill-first','先看看这期要付多少钱','小满列出这期工资和设备运行费：“研发还要继续，账单也记得留钱。”'],
  [10,'N02','AntiThropic 开始限制部分账号访问','Dario Amodie 宣布限制部分地区和账号访问。有人收到停用通知，当天订阅费照常扣了；申诉页面要求先登录，结果又回到了停用通知。公告生效时已经发布模型的公司，下期账单会有一次收入调整。'],
  [21,'wall','先把成绩贴上去','小满把已发布型号和成绩贴到墙上。旁边多了一张用户纸条：“新旧型号能放一起吗？别每次只给我一张新海报。”'],
  [24,'N17','Jeff Damn 离开 Gloglo','Gloglo 首席科学家 Jeff Damn 宣布离职。告别邮件发出后，团队群刷了几百条祝福；公司仍有上千名员工，下一场模型发布会按计划准备，只是会议邀请里的主持人一栏暂时空着。'],
  [28,'N01-low','Nvidya 这批设备降价了','每单位设备报价 {price} 万，优惠到第 35 日，运行费照常。Jenson Huang 对采购说：“现在下单最划算，要不要多买几台？”'],
  [30,'N24','CloseAI 宣布新一轮融资','CloseAI 公布新一轮融资。同行老板把新闻链接转给自己的投资人，只发了一个问号。'],
  [32,'N10','Cloud Code 进了终端','AntiThropic 发布编程工具 Cloud Code。演示里，它读代码、改文件、跑完测试；开发者更关心自己的账号能不能登录，额度够跑几次。工具不参加模型榜。'],
  [36,'N14','用 Cloud，先检查设备','AntiThropic 增加设备核验。开发者打开 Cloud 准备修报错，先要确认浏览器和设备信息；核验页面加载时，报错窗口还在旁边等着。'],
  [44,'headlines','三家媒体报道同一场发布会','机器之薪写“评测条件值得注意”，量子味问“老板今天又转了什么”，新智猿的标题则是“刚刚！AI 圈又变天了”。三篇文章引用的是同一份发布资料。'],
  [55,'N21','DeepPeek 更新成本资料，同行重算预算','DeepPeek R1 的技术报告和成本资料上线。链接传进同行群后，财务重新打开预算表，研究员也开始翻技术报告。'],
  [56,'N11','CloseAI 发布 CodeY','CodeY 也开始演示终端编程。媒体把它和 Cloud Code 放在一起比较，开发者先问两件事：能用多久，跑到一半没额度怎么办。工具不参加模型榜。'],
  [59,'N07','AntiThropic 提出蒸馏指控','Dario Amodie 指控部分中国模型蒸馏 Cloud。这是 AntiThropic 的单方说法；消息传开后，各家群里开始比较截图，有人提醒测试条件并不相同。'],
  [60,'N22','Nvidya 股价跌了，设备报价没跟跌','DeepPeek 的成本消息传开后，Nvidya 股价下跌。采购拿着新闻问显卡能不能降价，销售回了句：“您要几张？”买卡仍按采购页的价格。'],
  [61,'N18','Meeta 又开始高价挖人','猎头发来一份 Meeta 的报价，研究员数了两遍数字。第三遍还没数完，自己公司的老板已经打来电话：“你先别急着回复。”'],
  [65,'N25','AntiThropic 也拿到了融资','AntiThropic 公布新融资，投资人获邀看模型演示。普通用户还在等设备核验，受邀来宾已经拿到了测试账号。'],
  [66,'N23','DeepPeek R1 的成本表还在刷屏','新智猿又发了一篇 R1 解读。读者从头翻到尾，发现几家媒体引用的还是同一页成本表，标题倒是一个比一个响。'],
  [72,'N15','Cloud 又要核对付款资料','AntiThropic 增加付款资料核验。用户的订阅费已经扣了，账单地址和邮编还要再填一遍；提交后，页面提示等待审核。'],
  [84,'N01-high','Nvidya 调高设备报价','每单位设备报价涨到 {price} 万，持续至第 90 日。已买的设备不补差价。采购把还没签的订单拿回来，让老板重新确认数量。'],
  [87,'N19','Meeta 的托管试用开始排队','Meeta 的托管试用需要提交申请。开发者填完用途、公司规模和预计用量，收到一封邮件：感谢您对我们的兴趣。'],
  [94,'N20','Meeta 的试用申请还没回信','开发者还在等托管试用名额，Meeta 的猎头先发来私信：“方便聊聊新机会吗？”他回复：能先帮我催一下申请吗？'],
  [98,'N05','CodeY 重置额度，开发者又回来了','CloseAI 给 CodeY 用户重置额度。早上还在群里说“今天就退订”的用户，下午贴出成功运行的截图。有人问退订攻略还发不发，他说：“再等等。”消息发生时已经发布模型的公司，下期订阅收入有一次 −4 万调整。'],
  [128,'N16','AntiThropic 开始检查用户行为','有人输入太快，系统提示操作异常；他放慢速度重新输入，系统仍提示操作异常。打开申诉页，上面写着：请先登录。'],
  [132,'countdown','两家都在打听对方的发布时间','CloseAI 和 AntiThropic 都在预热，正式型号尚未公布。两家的公关分别问记者：“对面定几点？”记者打开两个直播间，先把外卖点了。'],
  [140,'N01-sale','Nvidya 再开优惠价','这批设备每单位 {price} 万，优惠到第 147 日。销售建议趁促销扩机房，小满提醒采购：设备买回来之后，运行费还得照付。'],
  [154,'N26','CloseAI 准备上市','CloseAI 开始准备上市材料。Sam Allman 在看敲钟仪式的视频，财务正催各部门交数据；上市仍在筹备中。'],
  [156,'N27','AntiThropic 也开始准备上市','AntiThropic 紧接着公布上市筹备。投资人询问尽调安排，工作人员专门发了份资料；普通用户的账号申诉还在排队。'],
  [161,'deadline','最后几天，别忘了正式发布','最后可发布日是第 167 日。第 168 日结算后进入结局，当天才做完的项目来不及发布。打开研发页，看看现在这款还差多少。'],
  [167,'last-call','今天是最后一个发布日','已完成的模型今天要正式发布，留在研发页不会入榜。尚未完成的项目会留在最终记录里，不能补发成绩。'],
];
export function rivalCopy(model) {
  const introduction=MODEL_DESCRIPTIONS[model.company]?.[model.name];
  if(introduction)return introduction;
  if (model.company === 'CloseAI') return 'Sam Allman 看完演示靠进椅子：“你们刚才看到了吗？”台下的记者已经开始找回放。';
  if (model.company === 'AntiThropic') return 'Dario Amodie 展示了新模型的编程表现。开发者打开账号准备试用，页面要求重新验证设备。';
  if (model.company === 'Meeta') return 'Mark Zuckerbug 放完宣传片，开始介绍研究团队。记者翻开资料，继续寻找模型的实测结果。';
  if (model.company === 'DeepPeek') return '官网更新了模型文件、技术说明和价格资料。新成绩已经进入榜单。';
  return 'Gloglo 的产品团队分别介绍了图片、文档和表格演示。台下问什么时候接入现有产品，主持人请另一组回答。';
}
export function newsFor(state) {
  const result = NEWS.map(([day,id,title,copy])=>({day:['deadline','last-call'].includes(id)?finaleDay(state,day):campaignDay(state,day),id,title,copy:calendarCopy(copy,state).replace('{price}',String(price({...state,gameDay:campaignDay(state,day)})))})).filter(item=>item.day<=state.gameDay);
  if (!state.models.some(model => model.company === 'player' && model.day <= campaignDay(state,21))) {
    const wall = result.find(news => news.id === 'wall');
    if (wall) wall.copy = '小满留了块空地方准备贴成绩。公司还没发布模型，现在只能先看研发进度。';
  }
  for (const source of CHAPTERS) {
    const day=source.day===148?finaleDay(state,source.day):campaignDay(state,source.day);if(day>state.gameDay)continue;
    const hasModel=state.models.some(model=>model.company==='player'&&model.day<=day);
    result.push({day,id:`chapter-${source.day}`,title:source.title,copy:source.day===22&&!hasModel?'公司还没发布模型，工资已经在付。先把第一款做出来，融资还得看后续的实际成绩。':calendarCopy(source.copy,state)});
  }
  for (const model of state.models.filter(model => model.company !== 'player' && model.day > 0)) result.push({id:model.id,day:model.day,title:`${model.company} 发布 ${model.name}`,copy:rivalCopy(model),model});
  for (const [index, notice] of state.notices.entries()) {
    if (notice.type === 'farewell') result.push({id:`farewell-${index}`,day:notice.day,title:'赔偿已付，员工离职',employeeId:notice.employeeId,compensation:notice.compensation,copy:FAREWELLS[notice.employeeId] || '“赔偿到了，剩下的你们自己接着做吧。”'});
  }
  return result.sort((a,b) => b.day-a.day || a.id.localeCompare(b.id));
}
// The outlets have different habits: methods and reproducibility, workplace
// adoption, and enthusiastic fan coverage. Escalation need not always be layoffs.
const MEDIA_REPORTS = {
  "机器之薪": [
    ["{name}发布：综合{score}分，先看这份评测怎么做", "{name} 的成绩公布了。研究群里有人要截图，有人要设置：提示词、采样参数和重试次数，最好都放在同一页。"],
    ["{name}的{focus}表现：高分之外，失败样例也值得看", "围绕{focus}演示，研究者开始征集失败样例。一位维护测试集的同学留言：成功截图我收到了，报错那几次也发来。"],
    ["再看{name}：同一套题，为什么大家跑出不同结果？", "几组测试准备互相比一比。还没讨论模型能力，群里先核对了一轮型号、输入格式和采样参数；有人的截图连日期都没截进去。"],
    ["{name}引出新讨论：评测到底该算一次，还是最好的一次？", "有人准备多跑几轮 {name}，看看结果是否稳定。组会上最先引发讨论的不是分数，而是那张只留了最好一次结果的表。"],
    ["从{name}到评测方法：那一道总被跳过的题", "讨论 {name} 时，一位研究者翻出团队自己的失败清单。题目不新，错误也不新，只是每次做演示时都被排到了时间不够的部分。"],
    ["{name}刷屏之后，评测圈把“能运行”又写回了要求", "围绕 {name} 的复现计划排满组会。维护者列了三件事：文件能找到，命令能执行，版本能对上。听起来很基础，大家却安静地记了下来。"]
  ],
  "量子味": [
    ["{name}发布了，老板已经把链接转进了工作群", "老板把 {name} 的演示视频甩进群里：“这个能接进我们的流程吗？”工程师回了句“我先试试”。十分钟后，老板追问：“那下周能上线吗？”"],
    ["{name}的{focus}演示进了群，第一道题是公司旧文件", "同事想拿 {name} 试试{focus}任务。共享盘里的文件叫“最终版7”，旁边还有一份“最终版7_不要用”。模型还没接进来，大家先在群里确认了十分钟。"],
    ["{name}来了：技术想试用，法务先问文件传到哪里", "项目组约好试一试 {name}。工程师准备账号，法务问客户资料能否上传，财务问谁来开申请单。三个人都还没碰到模型，已经开了一个会。"],
    ["{name}热度走出技术群，采购在问一件很现实的事", "{name} 的演示转进了采购群。有人问团队账号怎么管，有人问离职后怎么收回权限；老板又贴了一段视频，大家回他：刚才那两个问题先问清楚。"],
    ["{name}刷屏后，最忙的是整理老流程的人", "团队想试 {name}，却发现现有流程只存在一位老同事的脑子里。对方在白板上画到一半，大家终于明白那个定时任务为什么一直不敢关。"],
    ["老板群热议{name}，一张排期表被拉出来重新算", "演示视频在几个老板群转了一圈，有人提议重新估算招聘人数。负责人把文件导入、人工检查和出错重跑也列进表里：试完这些，再谈能省多少人。"]
  ],
  "新智猿": [
    ["刚刚！{name}发布，{focus}圈又开始刷屏了", "{name} 发布，综合成绩 {score} 分！有人贴成绩，有人求体验入口。群管理员刚置顶链接，下一条又在问：地址呢？"],
    ["一夜热议！{name}拿下{score}分，群友的测试题越来越离谱", "{name} 刚亮相，群友就开始凑测试题：祖传代码、手写菜单、十八页的报销规定。有人问能不能正常测，回复是：这就是我的正常工作！"],
    ["{name}刷屏！第一批体验计划，已经卷到家庭群", "有人准备拿 {name} 演示给父母看，父母只问：能把手机上那个弹窗关掉吗？技术群讨论了半小时，终于发现这题比发布会现场的还难！"],
    ["热议升级！{name}发布后，群里连“怎么夸”都吵起来了", "{name} 的成绩图传了一整晚！有人写了长测评，有人只回“好用吗”。长测评作者表示：我那三千字里，真有一句是在回答这个！"],
    ["{name}彻底出圈？同一张图出现在技术群、采购群和家庭群", "同一张 {name} 榜单，技术群看分项，采购群问价格，家庭群问是不是你做的！发图的人只好逐个解释，没给任何一个群发同样的回复。"],
    ["全网追更{name}！大家准备了最难的题，最后先找登录入口", "{name} 发布，{focus}讨论一条接一条！群友整理出一长串刁钻题目，准备开测时，置顶消息还是那句：体验入口看第一条！"]
  ]
};

export function mediaArticle(model,modelRank,models=[model]) {
  if(!model.media)return null;
  // Count only this outlet's articles already published at this model's sequence.
  // Unpaid releases, other outlets and later reports do not change its edition.
  const edition=Math.max(1,models.filter(item=>item.company==='player'&&item.media===model.media&&(item.id===model.id||item.sequence<model.sequence)).length);
  const templates=MEDIA_REPORTS[model.media];
  const fields={name:model.name,focus:DIRECTION_LABELS[model.focus],score:model.scores.reduce((sum,value)=>sum+value,0),place:modelRank===1?'登顶综合榜':`综合榜第 ${modelRank} 名`,edition};
  const fill=text=>text.replace(/\{(name|focus|score|place|edition)\}/g,(_,key)=>String(fields[key]));
  const [headline,body]=templates[Math.min(edition,templates.length)-1];
  let title=fill(headline),copy=fill(body);
  if(edition>templates.length){
    const angles={
      '机器之薪':[
        ['榜单之外，长任务怎么验收','有人准备让它连续完成一组任务。验收表先写好，免得做到一半又换成功标准。'],
        ['复现先从版本号开始','研究者对照测试配置，发现复现计划的第一步是把旧笔记本里的环境找回来。'],
        ['评测开始关心那几次重试','有人建议同时列出首次结果和重试结果。测试脚本的维护者默默加了一列。'],
        ['置信满满的回答，也要查出处','组会准备加一组带引用的题。谁负责核对原文，成了会后最后一个没人认领的任务。']
      ],
      '量子味':[
        ['工作群开始问谁来收尾','团队想拿它跑一段流程，先约定失败后谁接手。没人希望新自动化只会自动把问题转给自己。'],
        ['试用从一份脱敏文件开始','负责人先挑了一份能上传的文件。准备数据花的时间，也记进了试用表。'],
        ['接入之前，先找旧接口的负责人','大家翻了半天通讯录，发现熟悉旧接口的人就在群里，只是一直没被拉进项目会。'],
        ['上线计划里补了一个撤回按钮','工程师保留旧流程，给试用留了退路。业务同事说：这个按钮请做大一点。']
      ],
      '新智猿':[
        ['又火了！群聊开始自制测试题','技术群贡献了难题，生活群贡献了更难的题！有人只想整理照片，先被问家里有几块显卡。'],
        ['刷屏之后，网友决定把旧问题再问一遍','有人翻出半年前的失败截图！老问题又排上队了，这次还特地保留了完整输入。'],
        ['热度拉满！做测评的和等结论的都急了','测评作者想多跑几轮，群友催一句话结论！两边最后约定：先把题目发出来。'],
        ['全员围观！今天最受欢迎的是那条体验链接','群里发了十种解读，大家转得最多的却是入口！管理员决定把链接再往上挪一格。']
      ]
    };
    const followups={
      '机器之薪':['评测条件会和结果一起整理。','这次准备把失败样例也带去组会。','同事提醒：原始结果别只留截图。','准备跑对照的研究者已经开始分工。'],
      '量子味':['先挑一小段流程试，原来的办法还留着。','会后有人把那些没人负责的步骤圈了出来。','团队约好，省下的时间也要扣掉人工检查。','讨论完大家回去找文件，客户还在等原来那个需求。'],
      '新智猿':['群友已经给测试集起好了名字！','入口刚置顶，又有人问了一遍！','有人负责出题，有人负责把题目改得更难！','管理员表示：聊天可以，别把长截图发成十条！']
    };
    const offset=edition-templates.length-1;
    const [angle,detail]=angles[model.media][offset%angles[model.media].length];
    title=`${model.name}：${angle}（第 ${edition} 次报道）`;
    copy=`${model.name} 发布后，${detail} ${followups[model.media][Math.floor(offset/angles[model.media].length)%followups[model.media].length]}`;
  }
  return {id:`media:${model.id}`,day:model.day,kind:'media',model,title,copy:`${model.media} · 第 ${model.day} 日。${model.name} 主攻${fields.focus}，综合成绩 ${fields.score} 分，发布时${fields.place}。${copy}`};
}
export function mediaHeadline(model,modelRank,models=[model]) {return mediaArticle(model,modelRank,models)?.title||`${model.name} 已发布 · 主攻${DIRECTION_LABELS[model.focus]}`;}
export function playerReleaseCopy(model) {
  const lines={
    coding:['演示结束，工程师把运行命令贴了出来。台下第一条提问：“在公司那个老环境里也能跑吗？”','老板要把榜单多放十秒。工程师趁这十秒补了一行：请先在测试分支试用。','观众准备拿自己的项目试。工程师提醒先提交现有修改，台下几个人同时低头按了保存。'],
    office:['模型把会议纪要写好了。老板看了一眼：“把‘还没做完’改成‘持续推进中’。”','一份周报几秒就写好了。台下有人问数据从哪来的，工程师翻开了原表。','发布会演示了自动填表。老板很满意，财务拿着自己的表格排队等试用。'],
    multimodal:['模型读完了演示图片。台下有人递上一张手机照片，工程师说：“这张我回去试试。”','视频里的字幕识别得很顺利。观众问嘈杂的录音能不能用，团队记下了问题。','大屏展示了一张发票识别结果。财务凑近看了看：“金额对了，报销人怎么是老板？”'],
  };
  const serial=Number(model.id?.split('-').at(-1))||1;
  return `${(lines[model.focus]||lines.office)[(serial-1)%3]}${model.media?` ${model.media}已收到这次发布的材料，报道费计在上面的支出里。`:''}`;
}
export const ENDING_COPY = {
  '榜单常青树':'结算时，你的公司排在综合榜第一。你盯着公司名确认了两遍，开始琢磨新闻标题。用户还想问：我的文件，这回能处理好吗？',
  '融资永动机':'公司没有拿下最后的榜首，但融资和现金留住了。老板把融资金额放到汇报第一页，模型排名挪进附录。投资人问接下来做什么，你又打开了项目计划。',
  '明年一定第一':'这次结算，榜首还是别人的。你在白板上列下一次的研发计划，还没写型号，就先把招聘费和训练费算了一遍。',
  '发布会照常':'账上已经是负数，发布稿还写着“资金充足”。小满把电脑转过来，让你先看余额。台上的投影还开着，下一笔钱已经付不出来了。',
};

export function userFeedback(model) {
  // Career releases normally use the frozen comments in managementFeedback.
  // An imported older company can lack that presentation record. Its current
  // issue/policy fields may already have changed through maintenance or opening
  // weights, so they cannot reconstruct what users said at publication time.
  if(model.trainingPlan){
    const scores=DIRECTIONS.map((direction,index)=>`${DIRECTION_LABELS[direction]} ${model.scores[index]}`).join('、');
    return {id:`feedback:${model.id}`,day:model.day,modelId:model.id,title:`发布反馈 · ${model.name}`,copy:`这款旧型号没有保留发布时的用户留言，以下是第 ${model.day} 日的正式成绩：${scores}。`,impact:model.releaseFeedback||null};
  }
  const byDirection={
    coding:[
      '演示里测试全绿。我把报错贴过去，它先建议我升级订阅。',
      '新型号我记住了，昨天那个 bug 今天能修吗？',
      '代码写了一屏，问怎么运行，又把 README 发了一遍。',
      '我只改两行，它说额度用完了。重试也算一次？',
      '让它修测试，修复思路总结了三遍，测试还是红的。',
    ],
    office:[
      '周报确实写得快，里面那个不存在的客户我自己删了。',
      '让它帮我填表，它写了份怎么填表的说明。',
      '文件传上去了。模型在想，我的会已经开完了。',
      '格式挺整齐，引用的那份报告能发我看看吗？',
      '同一份材料又得传一遍？我只是换了个型号。',
    ],
    multimodal:[
      '照片里的小字这次读对了，剩下那张手写的我再试试。',
      '我让它看报错截图，它夸我的界面很好看。报错呢？',
      '视频才看到一半就没额度了，后半段我自己看？',
      '发票上的 8 识别成 3。我让它再看一遍，它说：您说得对，是 5。',
      '先把图里的金额读对，再给我讲设计风格吧。',
    ],
  };
  const quotes=byDirection[model.focus]||byDirection.office;
  const serial=Number(model.id?.split('-').at(-1))||1;
  return {id:`feedback:${model.id}`,day:model.day,modelId:model.id,title:`发布反馈 · ${model.name}`,copy:`用户：“${quotes[(serial-1)%quotes.length]}”`,impact:model.releaseFeedback||null};
}
