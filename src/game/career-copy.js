// Fictional workplace jokes. Selection depends on existing posts, never on the experiment RNG.
// Small, concrete reactions to completed work. Results and costs stay in the
// surrounding factual receipt; these lines must fit every trigger in a pool.
const lines={
  clean:[
    '同一条样本终于不用换三个文件名参加训练了。',
    '去重脚本跑完。那份“最终版_真的最终版”也查出一批重复。',
    '坏样本单独放好了，请不要再整个文件夹拖回训练目录。',
    '把容易出错的例子留作回归。下次谁说“我这能跑”，先跑这一包。',
    '给数据补了来源和日期。三个月后的自己应该会感谢今天。',
    '删重复数据用了半天，解释为什么数据量变小又用了半天。'],
  supplement:[
    '新语料接进去了。这次文件名、编码和路径总算一次对上。',
    '补的样本跑完了。负责标注的同事说，下次宣传也请提一下他们。',
    '多补了一批材料。现在模型读过的文件，比老板读过的周报多了。',
    '样本不是从发布会视频里截的。是同事一条条整理的。',
    '新数据进了训练目录，旧版本还留着。谁再叫它“垃圾文件”就让谁恢复。',
    '这批语料用上了。提需求的人终于不用每天问“我传的那包呢”。'],
  experiment:[
    '涨了。先别动配置，我要把这次到底怎么跑的记下来。',
    '刚才那条曲线是真的。截图发了，随机种子也发了。',
    '加跑有提升，大家围着屏幕看了一会。老板问能不能拍合照。',
    '终于跑出提升了。那个一直留着的实验分支可以合并了。',
    '这回不用对着曲线猜了。结果在这，配置也在这。',
    '报结果时老板先问涨了多少。我先回答了，然后才敢说花了多少。'],
  failure:[
    '没涨。日志先别删，下一个试这条路线的人少熬一晚。',
    '跑完了，分没上去。显卡倒是很暖和。',
    '同事问能不能再跑一遍。我把同一份配置和结果都发给了他。',
    '猜想没成立。白板上的箭头擦了，训练费退不回来。',
    '结果不好看，还是贴出来了。省得下周有人把同一招再提一次。',
    '老板问有没有好消息：有，这次没有把“还在跑”拖到明天。'],
  fix:[
    '原来的复现样例又跑了一遍，这项终于过了。',
    '修完了。那段临时绕路的说明可以少写一条。',
    '谢谢把输入和日志一起发来的人。比一句“它又不行了”好找多了。',
    '补了回归测试。下次谁改到这里，至少会先看到红灯。',
    '修好了，型号名还用原来的。先别为了发公告又起一个名字。',
    '关掉这张问题单之前又检查了一遍。怕它明早换个标题回来。'],
  promotion:[
    '改完职位名称，下一条消息就是“那这个你来带吧”。',
    '升职了。工资多了，同事找我看方案的次数也多了。',
    '邮件签名改好了，工位还是靠插座的那个。挺好。',
    '老板让我讲讲成长经验。我说，先把报错看完。',
    '今天收到两条祝贺，三条代码审查请求。谢谢大家。',
    '头衔换了。提方案前先跑个实验这件事，倒是没变。'],
  contract:[
    '收到了，交付清单也对过了。这次不用约个会问附件少了哪份。',
    '验收没问题，款付了。麻烦把使用说明也留一份给我们。',
    '交付包看过了。感谢没把最后一个文件命名成“新建文件夹”。',
    '我们这边确认完成。先到这里，新增需求下次另算。',
    '收货。这版我们存好了，下回提需求会带上版本号。',
    '验收通过。这回“已完成”后面没有跟一个“但是”。'],
  award:[
    '本公司获奖了。获奖感言念到第三页，工程师已经在找自己的名字。',
    '本公司这次拿到了奖。团队在转发结果，官网正在调整奖项图标大小。',
    '奖项有了归属。获奖团队合照时，最后排的人还抱着笔记本。',
    '本公司上了获奖名单。老板想把奖放前台，团队想先拍一张群合照。',
    '本公司获奖。群里先刷了恭喜，随后有人问：今晚还开例会吗？',
    '获奖型号又被点了一次名。给它写安装说明的人也值得被点一次名。'],
  'award-missed':[
    '本公司本届未获奖，老板把获奖感言存成了“下次用”。',
    '本公司本届未获奖。同行的成绩先记下，下代计划会上少说一句“差不多”。',
    '本公司本届未获奖，小满提醒：祝贺别人不需要报销。',
    '本公司本届未获奖。庆功蛋糕还没订，这笔倒是省了。',
    '本公司本届未获奖。工程师在看分项差距，老板在问下届哪天。',
    '本公司本届未获奖。直播关了，刚才没跑完的测试还得接着跑。']
};
export function eventLine(state,type,key){
  const pool=lines[type];
  const recent=state.career.posts.filter(p=>pool.some(line=>p.text.includes(line))).slice(-3).map(p=>pool.findIndex(line=>p.text.includes(line)));
  const offset=[...String(key)].reduce((n,ch)=>n+ch.charCodeAt(0),0)%pool.length;
  const index=Array.from({length:pool.length},(_,i)=>(offset+i)%pool.length).find(i=>!recent.includes(i));
  return pool[index??offset];
}

// The deadline and optional score promise are already frozen by postSocial.
// Copy must describe that contract; a steady post still promises a date.
export function preheatPostCopy(name,campaign){
  return `${name} 正在研发，计划最迟第${campaign.untilDay}日（含当天）发布。${campaign.bold?`综合成绩目标至少${campaign.promise}分。欢迎届时把这条帖翻出来。`:'这次不承诺成绩，分数等正式评测。'}`;
}
export function preheatMissCopy(name,campaign,day,score){
  const missed=[];
  if(day>campaign.untilDay)missed.push(`第${day}日才发布，晚于预热承诺的第${campaign.untilDay}日`);
  if(campaign.promise&&score<campaign.promise)missed.push(`综合成绩${score}分，低于承诺的${campaign.promise}分`);
  return `社区把预热帖翻出来了：${name}${missed.join('；')}。原帖和正式发布记录都还在，可以对照。`;
}

// Seven scheduled releases per rival. Company voice follows its own release
// history, not the player's success or the experiment RNG. These are remarks,
// not extra product features, scores, prices or rollout promises.
const rivalRemarks={
  CloseAI:[
    '我们很高兴宣布这个消息。演示留短一点，型号名字请留完整。',
    '这次先贴正式成绩。宣传图上那个巨大箭头，只负责指向表格。',
    '大家问得最多的还是：我现在用的是哪一版？这条公告请连型号一起转发。',
    '发布稿写了“感谢所有反馈”。负责整理反馈的人希望这句话后面能附上工单号。',
    '想比较进步的话，请把上一代也留在表里。换了封面不算一次能力提升。',
    '演示结束后，问题可以继续问。工程师尤其欢迎带输入和结果的问题。',
    '发布图可以换成新封面。接着用旧型号的人，也请在反馈里写明版本。',
  ],
  AntiThropic:[
    '请把适用范围和限制一起读完。限制部分没有折叠成一个小星号。',
    '正式成绩见上方。请不要把“本次测试”在转发时省略掉。',
    '发布说明先写已知边界。市场同事问，能不能先写一句比较开心的。',
    '比较结果时，请一并写明任务条件。只圈最大的那个数字不算完整引用。',
    '欢迎提交失败样例。最好附上输入，只有“它还是不会”很难排查。',
    '文案审阅意见：把“保证”删掉，留下能复现的部分。标题长度又少了两个字。',
    '这次仍请保留完整型号。旧测试记录不用改名，新的结论另开一列。',
  ],
  Gloglo:[
    '请认准完整型号。团队给演示起的内部昵称，不是正式名称。',
    '研究团队想把表格放大，市场团队想把标题放大。幻灯片就这么大，大家再商量一下。',
    '演示材料请写版本。只写“最新模型”，过几周就会变成一道考古题。',
    '发布稿的意见请直接改在文档里。不要再发一个文件，名字叫“最终意见汇总最终”。',
    '产品群在转发公告，研究群在转发测试条件。请把两条放在一起看。',
    '内部分享会请留出提问时间。介绍组织架构的那几页可以稍微快一点。',
    '这一轮的发布记录就在这里。下次要找，搜型号比搜“重磅”更快。',
  ],
  Meeta:[
    '权重在这，使用条件也在。别把“能下载”转述成“随便怎么用”。',
    '欢迎复现。遇到问题请带上环境，显卡型号比“我电脑挺好的”更有用。',
    '本地运行和托管服务是两回事。下载完以后，不必在权重文件里找登录按钮。',
    '资料请按版本留着。不要把上次保存的说明改个文件名，就当作这次的。',
    '想做对比可以直接报完整型号。只写“某开源模型”，我们也不知道你测的是哪款。',
    '欢迎交流运行条件。显存、精度和上下文长度请一起说，别只报一个“能跑”。',
    '权重已经公开。感谢帮忙查说明的人，有时少一条报错比多一张宣传图更管用。',
  ],
  DeepPeek:[
    '问题请直接列，不必先写恭喜。',
    '复现请注明运行环境。',
    '型号写在标题里，测试条件请看资料。',
    '反馈请附输入和配置。',
    '新旧型号请分别记录，别覆盖上次的结果。',
    '对比请用完整版本名。',
    '资料按这一版保存。后续讨论可引用本条。',
  ],
};
const rivalReplies={
  CloseAI:['用户：收到。发布会上那段视频先放一边，我想试自己的文件。','开发者：旧版本的结果我留着了，新的一列还空着。','用户：这回转发带了完整型号，省得群里再问“哪个”。'],
  AntiThropic:['开发者：边界看到了，我先拿自己的失败样例试。','用户：限制段落也请放在发布页，别只截第一段给我。','开发者：先对齐输入，再聊谁领先。'],
  Gloglo:['用户：完整型号复制好了。我不准备靠记忆区分简称。','开发者：请把这个名字也留在配置示例里，谢谢。','用户：终于能把群里的“那个新的”换成具体名字了。'],
  Meeta:['社区维护者：先照说明跑一遍。有安装问题就在这一版下面记。','开发者：权重和运行条件都收下了，托管申请另外看。','社区维护者：做对比时会注明来源，截图里也留型号。'],
};
export function rivalReleaseRemark(state,model){
  const previous=state.models.filter(m=>m.company===model.company&&m.day>0).length;
  const remarks=rivalRemarks[model.company]??['正式发布记录已更新。'];
  const replies=rivalReplies[model.company];
  return {text:remarks[previous%remarks.length],reply:replies?.[Math.min(2,Math.floor(previous/3))]??null};
}

// Each employee can reach these two ranks once. Keep their reactions tied to
// their established interests; the surrounding receipt supplies real rewards.
const promotionRemarks={
  avery:['升职邮件收到了。测试里的红色不会因为换了头衔就变绿，我先看完。','以后有人只发一张报错截图，我还是得先问输入是什么。'],
  jules:['邮件签名我自己改。庆祝可以，别临时再加一个会。','交接表里的负责人得写具体名字。“负责人负责”这五个字不算填完。'],
  morgan:['职位名称可以更新，文件先别全部重命名。我刚理顺哪个是最终版。','谁来接哪份材料先写清楚。我不想靠最后修改时间猜负责人。'],
  casey:['庆祝截图我来选。演示角落里的版本号别裁掉，那块也有用。','下次演示想多留一点时间给大家自己试，别光看我选的几张图。'],
  alex:['签名能改了。发布稿里的成绩先别跟着改，那是另一张表。','宣传我愿意讲，做不到的发布日期别让我现场编。'],
  rebo:['谢谢祝贺。职位升了，评论区问额度的消息可没少。','新头衔写好了。大家要问恢复时间，我还是得先看实际排期。'],
  karpathy:['谢谢大家。要讲成长经验的话，我想从一个能跑通的小例子开始。','之后讲方案先画清楚每一步，别用一张大箭头代替整个过程。'],
  boris:['邮件签名先放着。我想把手头这段重复操作写成脚本。','以后交接别只说“按顺序点”。顺序写下来，能自动跑的就别靠记性。'],
  tim:['谢谢。祝贺图片先别发原尺寸，群里已经占了不少空间。','评估新方案前，我还是想先看资源占用。名字里的“大”不是免费来的。'],
  max:['升职可以庆祝，回归测试那几题还是得再看一遍。','以后看成绩先问用的哪套题。换了头衔，也不能把不同测试混成一张榜。'],
};
export function promotionReaction(state,task){
  return promotionRemarks[task.employeeId]?.[task.tier===3?1:0]??eventLine(state,'promotion',task.id);
}

// Recruitment is once per employee in the current rules. A greeting introduces
// their interests; it does not grant a bonus or promise a service outcome.
const hiringRemarks={
  morgan:'今天入职。共享文档发我一份，我先把大家正在用的版本认全。',
  casey:'大家好，我是Casey。手头有图片或演示材料的话，先给我看看。',
  alex:'入职了。发布时需要对外沟通可以找我，媒体报价也一起看，先别急着付钱。',
  rebo:'今天来报到。用户说额度用完了先叫我，恢复时间得看实际安排。',
  karpathy:'新同事好。方案可以慢慢讲，我想先看一个跑过的实验。',
  boris:'电脑开好了。那些要反复点的步骤发我，我看看能不能写成脚本。',
  tim:'到岗了。先看看训练怎么跑、显存用在哪，不急着申请新卡。',
  max:'今天加入团队。评测用哪套题？我想先熟悉题目，再看训练计划。',
};
export function hiringPostCopy(employeeId){
  return hiringRemarks[employeeId]??'今天加入团队，先和大家认识一下。';
}

const fundingRemarks={
  seed:'小满把到账通知存好，问下一轮训练准备花多少。',
  specialist:'投资人圈出了分项第一的成绩。宣传稿请保留“分项”两个字。',
  overall:'综合榜第一的截图存好了。小满提醒，下一张工资单还是按原日期来。',
};
export function fundingPostCopy(id,amount){
  return `${amount} 万融资已到账。${fundingRemarks[id]??'小满已记入公司账本。'}`;
}

// Eight recurring subjects evolve across the three 112-day phases. This is
// calendar-only presentation: no RNG, extra posts, economic writes or counters.
// Current model/service facts are supplied by the rules at the time of posting;
// the resulting text is then stored on the post, rather than rebuilt on read.
export function officePostCopy(state,subscription){
  const phase=Math.max(0,Math.min(2,(state.career.phase??1)-1));
  const topic=Math.floor(Math.max(0,state.gameDay-3)/14)%8;
  const owned=state.models.filter(m=>m.company==='player'),latest=owned.at(-1);
  const source=owned.find(m=>m.id===subscription?.modelId);
  const open=owned.filter(m=>m.policy==='open');
  const issues=owned.reduce((n,m)=>n+(m.issues??[]).filter(issue=>!issue.resolved).length,0);
  const people=state.employees.length,study=state.career.study;
  const nextBill=(Math.floor(state.gameDay/7)+1)*7;
  const posts=[
    // Machine time: sharing a small rig -> coordinating people -> old and new work.
    ['avery',[
      `机房现在是${state.compute}单位设备。谁要加跑，先在排期上写名字。别跟我说“就试一下”。`,
      `现在${people}个人共用${state.compute}单位设备。排期写在一处就好，群里说过不算预约成功。`,
      source?`${source.name}还在承担订阅。新一轮训练再着急，也别把服务配置当临时实验文件改了。`:'还没有型号承担订阅。机器再忙，也得腾出时间把第一款正式发出去。'
    ]],
    // Handover: local files -> a colleague's task -> preserving old versions.
    ['jules',[
      '共享目录建好了。拜托别把训练数据、发布图和午饭菜单都叫“新建文件夹”。',
      study?`${study.label}还没做完。要问进度就看任务记录，别把负责人的消息框当进度条。`:'交接时请写运行命令，不要只发“按老办法”。老办法没有保存按钮。',
      latest?`${latest.name}的资料请按版本放。要查旧型号的时候，“这个应该就是最新版”一点忙也帮不上。`:'准备资料时就带上日期吧。等到真有好多型号，没人会记得哪份叫“最后一版”。'
    ]],
    // Money: leave a reserve -> distinguish hiring from spare desks -> service source.
    ['小满',[
      `第${nextBill}日要付账，当前现金${state.cash}万。老板问宣传图用什么颜色，我说先留一块地方写预算。`,
      `公司现在${people}个人，${state.seats}个工位。空椅子不发工资，招满了可就要发。`,
      source?`当前订阅收入靠的是${source.name}。发布图可以按新旧排序，收钱这件事得看实际是谁在撑。`:'旧型号收入不能凭空补进预算。目前还没有订阅来源，下一张工资单倒是已经有日期了。'
    ]],
    // Versions: pick a usable name -> record what was actually shipped -> compare generations.
    ['jules',[
      state.project?`这款暂时叫${state.project.name}。名字先定住吧，光改演示文件名我已经够忙了。`:'起型号名之前先定做哪款。群里已经有三个备选名字，还没有一份训练计划。',
      `我们已经正式发了${owned.length}款。发布材料请写完整型号，别让我猜“昨天那个”和“上次那个”分别是谁。`,
      source&&latest&&source.id!==latest.id?`最新是${latest.name}，当前订阅靠的是${source.name}。介绍新版本时记得给老版本留个位置，它还在挣工资钱。`:latest?`${latest.name}是最新发布的。这款资料按版本留着了，下次对比别又问我有没有截图。`:'还没正式发布，就先别开“下一代叫什么”的会了。'
    ]],
    // Bugs: useful reports -> actual unresolved work -> don't declare all versions fixed.
    ['avery',[
      '报错请把输入也留着。只有一张红色截图，我只能判断它心情不好。',
      !owned.length?'还没正式发布。验证时把输入和结果一起留好，别只保存一张“测试通过”的截图。':issues?`已发布型号还有${issues}项问题没处理。谁接哪项写清楚，别让“我以为你在修”再出现一次。`:'已发布型号没有挂着的已知问题。回归样例照样留着，别因为今天全绿就把测试删了。',
      issues?`已发布型号一共还有${issues}项未解决问题。发下一代不会把这些工单自动关掉，别替用户点“已处理”。`:'目前发布记录里没有未解决问题。下一次改配置，还是先跑回归；我不想因为这条帖子被翻旧账。'
    ]],
    // Shared knowledge: making instructions -> open/closed choice -> actual reproduction history.
    ['avery',[
      '运行说明写到第七步了。老板问能不能叫“一键启动”，我说可以，先把前六步做完。',
      open.length?`已有${open.length}款开放权重。运行说明是写给外面的人看的，“路径你知道的”这句得删。`:'公司还没有开放权重的型号。我们照样可以学同行的公开资料，引用时别只写“网上找的”。',
      state.career.learned.length?`公司已经复现过${state.career.learned.length}款公开模型。环境和来源一起留着，别让下个人再从安装报错学起。`:'复现清单还是空的。收藏同行仓库不算做完，别把星标数写进进度汇报。'
    ]],
    // People: small-team roles -> handover ownership -> continued staffing constraints.
    ['小满',[
      people<=2?`现在${people}个人，开会不用订会议室。谁离开工位拿杯水，会议就自动休会。`:`公司已经${people}个人了。新同事先拉进项目群，别只拉进订餐群。`,
      people>2?`${people}个人做事，交接表写“负责人：大家”可不行。我总不能给“大家”发催办消息。`:people===2?'到现在还是2个人。一个人去做辅助任务，另一个人的排期就得跟着重算，别只看任务花多少钱。':people===1?'现在只有1名研发员工。让他去做辅助任务，主线就得等；别把两份排期都写成今天。':'公司现在没有研发员工。先把招聘名单找出来吧，下款不能只靠我替您催进度。',
      people>2?`团队有${people}个人了，临时拉会之前先看谁在忙。把所有人叫来听“没什么事”，也占工作时间。`:`公司还是${people}个人，老任务和新模型都得有人管。别因为日历翻到后期，就假装我们多了一个支持团队。`
    ]],
    // Planning: first shipment -> maintaining the pipeline -> ending without a false deadline.
    ['jules',[
      owned.length?'第一款已经发过了。下一场演示的样例别照搬，上次坐第一排的人这次还会来。':'先把第一款做完发布吧。会邀请谁已经讨论三轮了，模型还没出现在榜上。',
      state.project?`${state.project.name}还在项目里。宣传要等实际进度，别先把日期写死，再让我去改所有邀请函。`:'这会儿没有在研项目。老板在问下一场发布会几点，我先问下一款做什么。',
      state.project?`${state.project.name}还没正式发布。最后阶段别光改标题，该做的、该验的和发布那一步都要留时间。`:'最后阶段先翻一遍正式发布记录。能拿出来比较的是那些已经发布的型号，不是文件夹里的“最终完成版”。'
    ]],
  ];
  const [speaker,copy]=posts[topic];
  // Do not make a dismissed employee report on the current company's work.
  const who=speaker==='小满'||state.employees.includes(speaker)?speaker:'小满';
  return [who,copy[phase]];
}
